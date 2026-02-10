import React, { useEffect, useMemo, useState } from 'react';
import {
  Page,
  Navbar,
  Block,
  BlockTitle,
  List,
  ListInput,
  ListButton,
  Button,
  f7,
} from 'framework7-react';

import { auth, db } from '../js/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';

import { doc, getDoc, runTransaction, setDoc, serverTimestamp } from 'firebase/firestore';
import { Network } from '@capacitor/network';

const AVATAR_IDS = Array.from({ length: 10 }, (_, i) => `Avatar_${String(i + 1).padStart(2, '0')}`);

function avatarUrlFromId(avatarId) {
  if (!avatarId) return '';
  return `${import.meta.env.BASE_URL}Avatars/${avatarId}.png`;
}

const ProfilePage = () => {
  const [mode, setMode] = useState('login'); // 'login' | 'register'

  // Login/Register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regUsernameStatus, setRegUsernameStatus] = useState('idle'); // idle|checking|available|taken|invalid

  // User
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Online
  const [online, setOnline] = useState(true);

  // Profil-Daten (USERNAME ONLY)
  const [profileLoading, setProfileLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profile, setProfile] = useState({
    username: '',
    avatarId: AVATAR_IDS[0],
  });

  // ---- Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser || null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ---- Online Listener
  useEffect(() => {
    let listener;

    const initNetwork = async () => {
      try {
        const status = await Network.getStatus();
        setOnline(status.connected);

        listener = await Network.addListener('networkStatusChange', (s) => {
          setOnline(s.connected);
        });
      } catch (e) {
        const update = () => setOnline(navigator.onLine);
        update();
        window.addEventListener('online', update);
        window.addEventListener('offline', update);

        return () => {
          window.removeEventListener('online', update);
          window.removeEventListener('offline', update);
        };
      }
    };

    const cleanupFallback = initNetwork();

    return () => {
      if (listener) listener.remove();
      if (typeof cleanupFallback === 'function') cleanupFallback();
    };
  }, []);

  // Presence (online/offline in Firestore) wird global in components/app.jsx gepflegt.

  const loadProfileFromFirebase = async (firebaseUser) => {
    if (!firebaseUser) return;
    const ref = doc(db, 'users', firebaseUser.uid);
    setProfileLoading(true);
    try {
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        setProfile({
          username: data.username || '',
          avatarId: AVATAR_IDS.includes(data.avatarId) ? data.avatarId : AVATAR_IDS[0],
        });
      } else {
        setProfile({ username: '', avatarId: AVATAR_IDS[0] });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProfileLoading(false);
    }
  };

  // ---- Profil laden aus Firestore: users/{uid}
  useEffect(() => {
    if (!user) {
      setProfile({ username: '', avatarId: AVATAR_IDS[0] });
      return;
    }
    loadProfileFromFirebase(user);
  }, [user]);

  const canSaveProfile = useMemo(() => {
    if (!user) return false;
    if (!profile.username.trim()) return false;
    return true;
  }, [user, profile.username]);

  // ---- Login/Register/Logout
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      f7.dialog.alert('Bitte E-Mail und Passwort eingeben.');
      return;
    }
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await loadProfileFromFirebase(cred.user);
      f7.toast.create({ text: 'Login erfolgreich ✅', closeTimeout: 1500 }).open();
    } catch (err) {
      f7.dialog.alert(err.message, 'Login fehlgeschlagen');
    }
  };

  const normalizeUsername = (raw) => (raw || '').trim().toLowerCase();

  // Live Username-Check beim Registrieren
  useEffect(() => {
    if (mode !== 'register') return;
    const usernameLower = normalizeUsername(regUsername);

    if (!usernameLower) {
      setRegUsernameStatus('idle');
      return;
    }

    if (!/^[a-z0-9._]{3,20}$/.test(usernameLower)) {
      setRegUsernameStatus('invalid');
      return;
    }

    let cancelled = false;
    setRegUsernameStatus('checking');

    const t = setTimeout(async () => {
      try {
        const unameRef = doc(db, 'usernames', usernameLower);
        const snap = await getDoc(unameRef);
        if (cancelled) return;
        setRegUsernameStatus(snap.exists() ? 'taken' : 'available');
      } catch (e) {
        if (!cancelled) setRegUsernameStatus('idle');
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [mode, regUsername]);

  const handleRegister = async () => {
    const usernameLower = normalizeUsername(regUsername);
    if (!usernameLower) {
      f7.dialog.alert('Bitte einen Username eingeben.');
      return;
    }
    if (!/^[a-z0-9._]{3,20}$/.test(usernameLower)) {
      f7.dialog.alert('Username muss 3–20 Zeichen haben und darf nur a-z, 0-9, . oder _ enthalten.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      f7.dialog.alert('Bitte E-Mail und Passwort eingeben.');
      return;
    }
    if (password.length < 6) {
      f7.dialog.alert('Passwort muss mindestens 6 Zeichen haben.');
      return;
    }
    if (password !== password2) {
      f7.dialog.alert('Passwörter stimmen nicht überein.');
      return;
    }
    try {
      // 1) Vorab prüfen, ob Username frei ist (kein User anlegen, wenn belegt)
      const precheckRef = doc(db, 'usernames', usernameLower);
      const precheckSnap = await getDoc(precheckRef);
      if (precheckSnap.exists()) {
        f7.dialog.alert('Dieser Username ist leider schon vergeben. Bitte wähle einen anderen.');
        return;
      }

      // 2) User anlegen, danach Username reservieren (Transaktion)
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const userRef = doc(db, 'users', cred.user.uid);
      const unameRef = doc(db, 'usernames', usernameLower);

      await runTransaction(db, async (tx) => {
        const unameSnap = await tx.get(unameRef);
        if (unameSnap.exists()) {
          throw new Error('USERNAME_TAKEN');
        }
        tx.set(unameRef, { uid: cred.user.uid, createdAt: serverTimestamp() }, { merge: true });
        tx.set(
          userRef,
          {
            email: cred.user.email || '',
            username: regUsername.trim(),
            usernameLower,
            avatarId: AVATAR_IDS[0],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });
      f7.toast.create({ text: 'Registrierung erfolgreich ✅', closeTimeout: 1800 }).open();
      setMode('login');
      setPassword2('');
      setRegUsername('');
    } catch (err) {
      if ((err?.message || '').includes('USERNAME_TAKEN')) {
        // User wieder löschen, falls zwischenzeitlich vergeben wurde
        try {
          if (auth.currentUser) await auth.currentUser.delete();
        } catch (e) {
          console.error('Failed to delete user after username taken', e);
        }
        f7.dialog.alert('Dieser Username ist leider schon vergeben. Bitte wähle einen anderen.');
        return;
      }
      f7.dialog.alert(err.message, 'Registrierung fehlgeschlagen');
    }
  };

  const handleLogout = async () => {
    const uid = auth.currentUser?.uid || user?.uid || null;
    try {
      if (uid) {
        await setDoc(
          doc(db, 'users', uid),
          { online: false, lastSeen: serverTimestamp() },
          { merge: true }
        );
      }
    } catch (e) {
      console.error('[profile] logout offline update error', e);
    } finally {
      await signOut(auth);
      setEmail('');
      setPassword('');
      setPassword2('');
      setMode('login');
      setProfile({ username: '', avatarId: AVATAR_IDS[0] });
    }
  };

  // ---- Profil speichern (Username eindeutig via usernames/{usernameLower})
  const saveProfile = async () => {
    if (!user) return;

    const usernameRaw = (profile.username || '').trim();
    if (!usernameRaw) {
      f7.dialog.alert('Bitte einen Username eintragen.');
      return;
    }

    const usernameLower = usernameRaw.toLowerCase();

    // erlaubt: a-z 0-9 _ .  |  Länge: 3-20
    if (!/^[a-z0-9._]{3,20}$/.test(usernameLower)) {
      f7.dialog.alert(
        'Username muss 3–20 Zeichen haben und darf nur a-z, 0-9, . oder _ enthalten.'
      );
      return;
    }

    setSavingProfile(true);

    try {
      const userRef = doc(db, 'users', user.uid);
      const newUnameRef = doc(db, 'usernames', usernameLower);

      await runTransaction(db, async (tx) => {
        // 1) User-Dokument lesen (um alten Username zu kennen)
        const userSnap = await tx.get(userRef);
        const current = userSnap.exists() ? userSnap.data() : {};
        const oldUsernameLower = current.usernameLower || null;

        // 2) Wenn Username sich geändert hat: prüfen/reservieren
        if (!oldUsernameLower || oldUsernameLower !== usernameLower) {
          const unameSnap = await tx.get(newUnameRef);

          // Wenn existiert und gehört nicht mir → Name vergeben
          if (unameSnap.exists() && unameSnap.data()?.uid !== user.uid) {
            throw new Error('USERNAME_TAKEN');
          }

          // neuen Namen reservieren (oder bestätigen, falls er schon mir gehört)
          tx.set(
            newUnameRef,
            { uid: user.uid, createdAt: serverTimestamp() },
            { merge: true }
          );

          // alten Namen freigeben (wenn vorhanden)
          if (oldUsernameLower) {
            const oldUnameRef = doc(db, 'usernames', oldUsernameLower);
            const oldSnap = await tx.get(oldUnameRef);
            if (oldSnap.exists() && oldSnap.data()?.uid === user.uid) {
              tx.delete(oldUnameRef);
            }
          }
        }

        // 3) users/{uid} updaten
        tx.set(
          userRef,
          {
            username: usernameRaw,
            usernameLower,
            email: user.email || '',
            avatarId: AVATAR_IDS.includes(profile.avatarId) ? profile.avatarId : AVATAR_IDS[0],
            updatedAt: serverTimestamp(),
            createdAt: current.createdAt || serverTimestamp(),
          },
          { merge: true }
        );
      });

      f7.toast.create({ text: 'Profil gespeichert ✅', closeTimeout: 1500 }).open();
    } catch (e) {
      console.error(e);

      if ((e?.message || '').includes('USERNAME_TAKEN')) {
        f7.dialog.alert('Dieser Username ist leider schon vergeben. Bitte wähle einen anderen.');
        return;
      }

      f7.dialog.alert(e.message || String(e), 'Speichern fehlgeschlagen');
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) {
    return (
      <Page name="profile">
        <Navbar title="Profil" />
        <Block strong inset>Lade...</Block>
      </Page>
    );
  }

  return (
    <Page name="profile">
      <Navbar title="Profil" backLink="Zurück" />

      {!user ? (
        <>
          <BlockTitle>{mode === 'login' ? 'Einloggen' : 'Konto erstellen'}</BlockTitle>

          <Block strong inset style={{ display: 'flex', gap: 10 }}>
            <Button fill={mode === 'login'} outline={mode !== 'login'} onClick={() => setMode('login')}>
              Login
            </Button>
            <Button fill={mode === 'register'} outline={mode !== 'register'} onClick={() => setMode('register')}>
              Registrieren
            </Button>
          </Block>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === 'login') {
                handleLogin();
              } else {
                handleRegister();
              }
            }}
          >
            <List strong inset dividersIos>
              <ListInput
                label="E-Mail"
                type="email"
                placeholder="name@beispiel.de"
                value={email}
                onInput={(e) => setEmail(e.target.value)}
                clearButton
              />
              {mode === 'register' && (
                <ListInput
                  label="Username *"
                  type="text"
                  placeholder="z.B. flizzmaster"
                  value={regUsername}
                  onInput={(e) => setRegUsername(e.target.value)}
                  clearButton
                />
              )}
              <ListInput
                label="Passwort"
                type="password"
                placeholder="••••••••"
                value={password}
                onInput={(e) => setPassword(e.target.value)}
                clearButton
              />
              {mode === 'register' && (
                <ListInput
                  label="Passwort wiederholen"
                  type="password"
                  placeholder="••••••••"
                  value={password2}
                  onInput={(e) => setPassword2(e.target.value)}
                  clearButton
                />
              )}
            </List>

            <Block>
              {mode === 'register' && (
                <div style={{ marginBottom: 8, opacity: 0.7, fontSize: 13 }}>
                  {regUsernameStatus === 'idle' && 'Bitte Username eingeben.'}
                  {regUsernameStatus === 'checking' && 'Username wird geprüft…'}
                  {regUsernameStatus === 'available' && 'Username ist frei ✅'}
                  {regUsernameStatus === 'taken' && 'Username ist vergeben ❌'}
                  {regUsernameStatus === 'invalid' &&
                    'Username: 3–20 Zeichen, nur a-z, 0-9, . oder _'}
                </div>
              )}
              <Button fill type="submit">
                {mode === 'login' ? 'Einloggen' : 'Registrieren'}
              </Button>
            </Block>
          </form>
        </>
      ) : (
        <>
          <BlockTitle>Dein Konto</BlockTitle>

          {/* Online Status */}
          <Block strong inset style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: online ? 'var(--f7-color-green)' : 'var(--f7-color-red)',
                display: 'inline-block',
              }}
            />
            <span>{online ? 'Online' : 'Offline'}</span>
          </Block>

          {/* Header Card */}
          <Block strong inset style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <img
              src={avatarUrlFromId(profile.avatarId)}
              alt="Avatar"
              style={{ width: 56, height: 56, borderRadius: 999, objectFit: 'cover' }}
            />

            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>
                {profile.username?.trim() ? profile.username : 'Noch kein Username'}
              </div>
              <div style={{ opacity: 0.7, fontSize: 13 }}>{user.email}</div>
              {profileLoading && <div style={{ marginTop: 6, opacity: 0.6 }}>Profil wird geladen…</div>}
            </div>
          </Block>

          <BlockTitle>Profil bearbeiten</BlockTitle>
          <List strong inset dividersIos>
            <ListInput
              label="Username *"
              type="text"
              placeholder="z.B. flizzmaster"
              value={profile.username}
              onInput={(e) => setProfile((p) => ({ ...p, username: e.target.value }))}
              clearButton
            />

          </List>

          <BlockTitle>Avatar auswählen</BlockTitle>
          <Block strong inset>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
              {AVATAR_IDS.map((avatarId) => {
                const selected = profile.avatarId === avatarId;
                return (
                  <button
                    key={avatarId}
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, avatarId }))}
                    style={{
                      border: selected ? '2px solid var(--f7-theme-color)' : '1px solid var(--f7-color-gray)',
                      borderRadius: 999,
                      padding: 2,
                      background: 'transparent',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    aria-label={`Avatar ${avatarId}`}
                  >
                    <img
                      src={avatarUrlFromId(avatarId)}
                      alt={avatarId}
                      style={{ width: 48, height: 48, borderRadius: 999, objectFit: 'cover' }}
                    />
                  </button>
                );
              })}
            </div>
          </Block>

          <Block>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button fill onClick={saveProfile} disabled={!canSaveProfile || savingProfile}>
                {savingProfile ? 'Speichere…' : 'Profil speichern'}
              </Button>

              <Button outline onClick={() => f7.views.main?.router.navigate('/sudoku/')}>
                Zum Sudoku
              </Button>

              <Button fill color="red" onClick={handleLogout}>
                Logout
              </Button>
            </div>

          </Block>
        </>
      )}
    </Page>
  );
};

export default ProfilePage;
