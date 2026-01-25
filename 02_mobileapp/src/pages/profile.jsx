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

// 🔥 Firebase Auth + Firestore
import { auth, db } from '../js/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

// 🌐 Network (Capacitor)
import { Network } from '@capacitor/network';

const ProfilePage = () => {
  // Mode: Login oder Register
  const [mode, setMode] = useState('login'); // 'login' | 'register'

  // Login/Register Eingabefelder
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Optional: Passwort wiederholen (nur UI-Sicherheit)
  const [password2, setPassword2] = useState('');

  // Firebase-User
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🌐 Online/Offline
  const [online, setOnline] = useState(true);

  // 👤 Kundendaten-Form
  const [customer, setCustomer] = useState({
    company: '',
    contactName: '',
    customerEmail: '',
    phone: '',
    notes: '',
  });

  const canSaveCustomer = useMemo(() => {
    if (!user) return false;
    if (!customer.company.trim()) return false;
    if (!customer.contactName.trim()) return false;
    return true;
  }, [user, customer]);

  // ✅ Firebase Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ✅ Online/Offline Listener (Capacitor Network)
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
        // Fallback (Web)
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

  // 🔐 LOGIN
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      f7.dialog.alert('Bitte E-Mail und Passwort eingeben.');
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);

      f7.toast
        .create({
          text: 'Login erfolgreich ✅',
          closeTimeout: 1500,
        })
        .open();
    } catch (err) {
      f7.dialog.alert(err.message, 'Login fehlgeschlagen');
    }
  };

  // 🆕 REGISTER
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

      f7.toast
        .create({
          text: 'Registrierung erfolgreich ✅ (eingeloggt)',
          closeTimeout: 1800,
        })
        .open();

      setMode('login');
      setPassword2('');
    } catch (err) {
      f7.dialog.alert(err.message, 'Registrierung fehlgeschlagen');
    }
  };

  // 🚪 LOGOUT
  const handleLogout = async () => {
    await signOut(auth);
    setEmail('');
    setPassword('');
    setPassword2('');
    setMode('login');
    setCustomer({
      company: '',
      contactName: '',
      customerEmail: '',
      phone: '',
      notes: '',
    });
  };

  // 💾 Kundendaten speichern
  const saveCustomer = async () => {
    if (!user) {
      f7.dialog.alert('Bitte zuerst einloggen.');
      return;
    }
    if (!canSaveCustomer) {
      f7.dialog.alert('Bitte mindestens Firma und Kontaktperson ausfüllen.');
      return;
    }

    try {
      await addDoc(collection(db, 'customers'), {
        company: customer.company.trim(),
        contactName: customer.contactName.trim(),
        email: customer.customerEmail.trim(),
        phone: customer.phone.trim(),
        notes: customer.notes.trim(),

        ownerUid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      f7.toast
        .create({ text: 'Kundendaten gespeichert ✅', closeTimeout: 1500 })
        .open();

      setCustomer({
        company: '',
        contactName: '',
        customerEmail: '',
        phone: '',
        notes: '',
      });
    } catch (err) {
      console.error(err);
      f7.dialog.alert(err.message, 'Speichern fehlgeschlagen');
    }
  };

  // ⏳ Während Firebase prüft
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
          <BlockTitle>
            {mode === 'login' ? 'Einloggen' : 'Konto erstellen'}
          </BlockTitle>

          {/* Umschalter */}
          <Block strong inset style={{ display: 'flex', gap: 10 }}>
            <Button
              fill={mode === 'login'}
              outline={mode !== 'login'}
              onClick={() => setMode('login')}
            >
              Login
            </Button>
            <Button
              fill={mode === 'register'}
              outline={mode !== 'register'}
              onClick={() => setMode('register')}
            >
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
              <>
                <ListButton title="Einloggen" onClick={handleLogin} />
                <div style={{ marginTop: 10, opacity: 0.7, fontSize: 13 }}>
                  Konto-Zugriff via Firebase Auth
                </div>
              </>
            ) : (
              <>
                <ListButton title="Registrieren" onClick={handleRegister} />
                <div style={{ marginTop: 10, opacity: 0.7, fontSize: 13 }}>
                  Mindestlänge Passwort: 6 Zeichen
                </div>
              </>
            )}
          </Block>
        </>
      ) : (
        <>
          <BlockTitle>Dein Konto</BlockTitle>

          {/* 🌐 Statusanzeige */}
          <Block
            strong
            inset
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: online
                  ? 'var(--f7-color-green)'
                  : 'var(--f7-color-red)',
                display: 'inline-block',
              }}
            />
            <span>{online ? 'Online' : 'Offline'}</span>
          </Block>

          <Block strong inset>
            <p>
              Eingeloggt als:<br />
              <b>{user.email}</b>
            </p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button fill onClick={() => f7.views.main?.router.navigate('/sudoku/')}>
                Zum Sudoku
              </Button>

              <Button fill color="red" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </Block>

          <BlockTitle>Kundendaten speichern</BlockTitle>

          <List strong inset dividersIos>
            <ListInput
              label="Firma *"
              type="text"
              placeholder="Muster GmbH"
              value={customer.company}
              onInput={(e) =>
                setCustomer((p) => ({ ...p, company: e.target.value }))
              }
              clearButton
            />
            <ListInput
              label="Kontaktperson *"
              type="text"
              placeholder="Max Mustermann"
              value={customer.contactName}
              onInput={(e) =>
                setCustomer((p) => ({ ...p, contactName: e.target.value }))
              }
              clearButton
            />
            <ListInput
              label="E-Mail"
              type="email"
              placeholder="kontakt@muster.de"
              value={customer.customerEmail}
              onInput={(e) =>
                setCustomer((p) => ({ ...p, customerEmail: e.target.value }))
              }
              clearButton
            />
            <ListInput
              label="Telefon"
              type="tel"
              placeholder="+49 ..."
              value={customer.phone}
              onInput={(e) =>
                setCustomer((p) => ({ ...p, phone: e.target.value }))
              }
              clearButton
            />
            <ListInput
              label="Notizen"
              type="textarea"
              placeholder="Zusätzliche Infos…"
              value={customer.notes}
              onInput={(e) =>
                setCustomer((p) => ({ ...p, notes: e.target.value }))
              }
              resizable
            />
          </List>

          <Block>
            <ListButton
              title="Kundendaten speichern"
              onClick={saveCustomer}
              disabled={!canSaveCustomer}
            />
          </Block>
        </>
      )}
    </Page>
  );
};

export default ProfilePage;
