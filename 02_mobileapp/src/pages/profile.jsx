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

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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

  // Profil-Daten
  const [profileLoading, setProfileLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profile, setProfile] = useState({
    displayName: '',
    avatarUrl: '', // erstmal URL; Upload kommt als nächster Schritt
  });

  // ---- Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
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
            displayName: data.displayName || '',
            avatarUrl: data.avatarUrl || '',
          });
        } else {
          // initiales Profil anlegen (optional)
          await setDoc(
            ref,
            {
              email: user.email || '',
              displayName: '',
              avatarUrl: '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
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
    if (!profile.displayName.trim()) return false;
    return true;
  }, [user, profile]);

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
      await createUserWithEmailAndPassword(auth, email.trim(), password);
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
    setProfile({ displayName: '', avatarUrl: '' });
  };

  // ---- Profil speichern
  const saveProfile = async () => {
    if (!user) return;
    if (!canSaveProfile) {
      f7.dialog.alert('Bitte mindestens einen Anzeigenamen eintragen.');
      return;
    }

    setSavingProfile(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          email: user.email || '',
          displayName: profile.displayName.trim(),
          avatarUrl: profile.avatarUrl.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      f7.toast.create({ text: 'Profil gespeichert ✅', closeTimeout: 1500 }).open();
    } catch (e) {
      console.error(e);
      f7.dialog.alert(e.message || String(e), 'Speichern fehlgeschlagen');
    } finally {
      setSavingProfile(false);
    }
  };

  const initials = useMemo(() => {
    const name = profile.displayName.trim();
    if (!name) return '🙂';
    const parts = name.split(' ').filter(Boolean);
    const a = parts[0]?.[0] || '';
    const b = parts[1]?.[0] || '';
    return (a + b).toUpperCase() || '🙂';
  }, [profile.displayName]);

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
            {/* Avatar */}
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
                {initials}
              </div>
            )}

            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>
                {profile.displayName?.trim() ? profile.displayName : 'Noch kein Anzeigename'}
              </div>
              <div style={{ opacity: 0.7, fontSize: 13 }}>{user.email}</div>
              {profileLoading && <div style={{ marginTop: 6, opacity: 0.6 }}>Profil wird geladen…</div>}
            </div>
          </Block>

          <BlockTitle>Profil bearbeiten</BlockTitle>
          <List strong inset dividersIos>
            <ListInput
              label="Anzeigename *"
              type="text"
              placeholder="z.B. Felix"
              value={profile.displayName}
              onInput={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
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
              Nächster Schritt: Avatar Upload über Firebase Storage (statt URL). Sag Bescheid, dann bauen wir das ein.
            </div>
          </Block>

          <BlockTitle>Stats (später)</BlockTitle>
          <Block strong inset style={{ opacity: 0.8 }}>
            - Gelöste Sudokus<br />
            - Bestzeiten pro Difficulty<br />
            - Streak / tägliche Challenge
          </Block>
        </>
      )}
    </Page>
  );
};

export default ProfilePage;
