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

const ProfilePage = () => {
  const [mode, setMode] = useState('login'); // 'login' | 'register'

  // Login/Register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');

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
    avatarUrl: '',
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

  // ---- Online-Status in Firestore schreiben (users/{uid})
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    setDoc(
      ref,
      { online, lastSeen: serverTimestamp() },
      { merge: true }
    ).catch((e) => console.error('[profile] online status update error', e));
  }, [user, online]);

  // ---- Bei App-Hintergrund/Close als offline markieren
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid);

    const setOffline = () => {
      setDoc(ref, { online: false, lastSeen: serverTimestamp() }, { merge: true }).catch((e) =>
        console.error('[profile] offline status update error', e)
      );
    };

    const handleVisibility = () => {
      if (document.hidden) setOffline();
    };

    window.addEventListener('beforeunload', setOffline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('beforeunload', setOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      setOffline();
    };
  }, [user]);

  // ---- Profil laden aus Firestore: users/{uid}
  useEffect(() => {
    if (!user) return;

    const ref = doc(db, 'users', user.uid);

    (async () => {
      setProfileLoading(true);
      try {
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();
          setProfile({
            username: data.username || '',
            avatarUrl: data.avatarUrl || '',
          });
        } else {
          setProfile({ username: '', avatarUrl: '' });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setProfileLoading(false);
      }
    })();
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
      await signInWithEmailAndPassword(auth, email.trim(), password);
      f7.toast.create({ text: 'Login erfolgreich ✅', closeTimeout: 1500 }).open();
    } catch (err) {
      f7.dialog.alert(err.message, 'Login fehlgeschlagen');
    }
  };

  const handleRegister = async () => {
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
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await setDoc(
        doc(db, 'users', cred.user.uid),
        {
          email: cred.user.email || '',
          username: '',
          usernameLower: '',
          avatarUrl: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      f7.toast.create({ text: 'Registrierung erfolgreich ✅', closeTimeout: 1800 }).open();
      setMode('login');
      setPassword2('');
    } catch (err) {
      f7.dialog.alert(err.message, 'Registrierung fehlgeschlagen');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setEmail('');
    setPassword('');
    setPassword2('');
    setMode('login');
    setProfile({ username: '', avatarUrl: '' });
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
            avatarUrl: current.avatarUrl || profile.avatarUrl || '',
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

          <List strong inset dividersIos>
            <ListInput
              label="E-Mail"
              type="email"
              placeholder="name@beispiel.de"
              value={email}
              onInput={(e) => setEmail(e.target.value)}
              clearButton
            />
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
            {mode === 'login' ? (
              <ListButton title="Einloggen" onClick={handleLogin} />
            ) : (
              <ListButton title="Registrieren" onClick={handleRegister} />
            )}
          </Block>
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
            {/* Avatar (optional URL) */}
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt="Avatar"
                style={{ width: 56, height: 56, borderRadius: 999, objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 18,
                  background: 'var(--f7-theme-color)',
                  color: '#fff',
                }}
              >
                @
              </div>
            )}

            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>
                {profile.username?.trim() ? `@${profile.username}` : 'Noch kein Username'}
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

            <ListInput
              label="Avatar URL (optional)"
              type="url"
              placeholder="https://..."
              value={profile.avatarUrl}
              onInput={(e) => setProfile((p) => ({ ...p, avatarUrl: e.target.value }))}
              clearButton
            />
          </List>

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

            <div style={{ marginTop: 10, opacity: 0.7, fontSize: 13 }}>
              Username ist eindeutig (Collection <b>usernames</b>). Groß/Klein ist egal: wir vergleichen immer <b>lowercase</b>.
            </div>
          </Block>
        </>
      )}
    </Page>
  );
};

export default ProfilePage;
