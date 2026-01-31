import React, { useEffect, useState } from 'react';

import {
  f7,
  f7ready,
  App,
  Panel,
  Views,
  View,
  Popup,
  Page,
  Navbar,
  Toolbar,
  NavRight,
  Link,
  Block,
  LoginScreen,
  LoginScreenTitle,
  List,
  ListInput,
  ListButton,
  BlockFooter,
} from 'framework7-react';

import routes from '../js/routes';
import store from '../js/store';
import { auth, db } from '../js/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

const MyApp = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [incomingCount, setIncomingCount] = useState(0);

  // ✅ Dark Mode State (persistiert)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  const f7params = {
    name: 'Sudoku',
    theme: 'auto',
    pushState: true,
    pushStateRoot: '/',

    colors: {
      primary: '#1e3a8a', // dunkelblau
    },

    store,
    routes,
  };

  // ✅ Framework7 initial ready + initial DarkMode anwenden
  useEffect(() => {
    f7ready(() => {
      f7.setDarkMode(darkMode);
    });
  }, []);

  // ✅ Nach Login/Logout immer zurück ins Sudoku-Menü
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => {
      f7ready(() => {
        f7.views.main?.router.navigate('/sudoku-menu/', { reloadCurrent: true, ignoreCache: true });
      });
    });
    return () => unsub();
  }, []);

  // ✅ Roter Punkt bei neuen Freundschaftsanfragen
  useEffect(() => {
    let unsub = null;
    const offAuth = onAuthStateChanged(auth, (u) => {
      if (unsub) {
        unsub();
        unsub = null;
      }
      setIncomingCount(0);
      if (!u) return;
      const q = query(
        collection(db, 'friendRequests'),
        where('toUid', '==', u.uid),
        where('status', '==', 'pending')
      );
      unsub = onSnapshot(q, (snap) => setIncomingCount(snap.size));
    });
    return () => {
      if (unsub) unsub();
      offAuth();
    };
  }, []);

  // ✅ Bei Änderung Dark Mode sofort anwenden + speichern
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    f7ready(() => {
      f7.setDarkMode(darkMode);
    });
  }, [darkMode]);

  const alertLoginData = () => {
    f7.dialog.alert(`Username: ${username}<br>Password: ${password}`, () => {
      f7.loginScreen.close();
    });
  };

  return (
    <App {...f7params}>
      {/* Left panel */}
      <Panel left cover dark>
        <View>
          <Page>
            <Navbar title="Left Panel" />
            <Block>Left panel content goes here</Block>
          </Page>
        </View>
      </Panel>

      {/* Right panel */}
      <Panel right reveal dark>
        <View>
          <Page>
            <Navbar title="Right Panel" />
            <Block>Right panel content goes here</Block>

            {/* ✅ Dark Mode Toggle (optional) */}
            <List strong inset>
              <ListButton
                title={darkMode ? 'Dark Mode: AN' : 'Dark Mode: AUS'}
                onClick={() => setDarkMode((v) => !v)}
              />
            </List>
          </Page>
        </View>
      </Panel>

      {/* ✅ Views/Tabs */}
      <Views tabs className="safe-areas">
        <Toolbar tabbar icons bottom>
          <Link
            tabLink="#view-sudoku"
            tabLinkActive
            iconIos="f7:gamecontroller"
            iconMd="material:games"
            text="Sudoku"
          />
          <Link
            tabLink="#view-friends"
            iconIos="f7:person_2"
            iconMd="material:people"
            text="Freunde"
            className="friends-tab"
            badge={incomingCount > 0 ? ' ' : ''}
            badgeColor="red"
          />
          <Link
            tabLink="#view-leaderboard"
            iconIos="f7:rosette"
            iconMd="material:emoji_events"
            text="Rangliste"
          />
        </Toolbar>

        <View id="view-sudoku" main tab tabActive url="/sudoku-menu/" />
        <View id="view-friends" tab url="/friends/" />
        <View id="view-leaderboard" tab url="/leaderboard/" />
      </Views>

      {/* Popup (optional) */}
      <Popup id="my-popup">
        <View>
          <Page>
            <Navbar title="Popup">
              <NavRight>
                <Link popupClose>Close</Link>
              </NavRight>
            </Navbar>
            <Block>
              <p>Popup content goes here.</p>
            </Block>
          </Page>
        </View>
      </Popup>

      {/* LoginScreen (optional, kannst du später entfernen) */}
      <LoginScreen id="my-login-screen">
        <View>
          <Page loginScreen>
            <LoginScreenTitle>Login</LoginScreenTitle>
            <List form>
              <ListInput
                type="text"
                name="username"
                placeholder="Your username"
                value={username}
                onInput={(e) => setUsername(e.target.value)}
              />
              <ListInput
                type="password"
                name="password"
                placeholder="Your password"
                value={password}
                onInput={(e) => setPassword(e.target.value)}
              />
            </List>
            <List>
              <ListButton title="Sign In" onClick={alertLoginData} />
              <BlockFooter>
                Some text about login information.<br />
                Click &quot;Sign In&quot; to close Login Screen
              </BlockFooter>
            </List>
          </Page>
        </View>
      </LoginScreen>
    </App>
  );
};

export default MyApp;
