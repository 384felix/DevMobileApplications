import React, { useState } from 'react';
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

const LoginPage = () => {
  // ✅ Demo-Login-State (später durch echten API-Call ersetzen)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // ✅ "loggedIn" nur demohaft in localStorage
  const [loggedIn, setLoggedIn] = useState(() => {
    return localStorage.getItem('loggedIn') === 'true';
  });

  const handleLogin = () => {
    // ✅ Minimaler Demo-Check
    if (!email.trim() || !password.trim()) {
      f7.dialog.alert('Bitte E-Mail und Passwort eingeben.');
      return;
    }

    // ✅ Hier würdest du später z.B. fetch('/api/login') machen
    localStorage.setItem('loggedIn', 'true');
    localStorage.setItem('userEmail', email.trim());
    setLoggedIn(true);

    f7.toast
      .create({
        text: 'Demo-Login erfolgreich ✅',
        closeTimeout: 1500,
      })
      .open();
  };

  const handleLogout = () => {
    localStorage.removeItem('loggedIn');
    localStorage.removeItem('userEmail');
    setLoggedIn(false);
    setEmail('');
    setPassword('');
  };

  const userEmail = localStorage.getItem('userEmail') || '';

  return (
    <Page name="login">
      <Navbar title="Login" />

      {!loggedIn ? (
        <>
          <BlockTitle>Einloggen</BlockTitle>

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
          </List>

          <Block>
            <ListButton title="Einloggen" onClick={handleLogin} />
            <div style={{ marginTop: 10, opacity: 0.7, fontSize: 13 }}>
              Demo: Login wird nur lokal gespeichert (localStorage). Später ersetzt du das durch Backend/Auth.
            </div>
          </Block>
        </>
      ) : (
        <>
          <BlockTitle>Du bist eingeloggt</BlockTitle>

          <Block strong inset>
            <p>
              Eingeloggt als: <b>{userEmail}</b>
            </p>

            <Button fill onClick={handleLogout}>
              Logout
            </Button>
          </Block>
        </>
      )}
    </Page>
  );
};

export default LoginPage;
