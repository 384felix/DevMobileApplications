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
  ToolbarPane,
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

const MyApp = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // ✅ Dark Mode State (persistiert)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  // =========================
  // ✅ HIER werden die App-Farben gesetzt (LIGHT / Basis-Theme)
  // - Framework7 nutzt "primary" für Buttons, aktive Tabs, Links, Toggles etc.
  // - Diese Farbe gilt sowohl in Light als auch Dark, solange du sie nicht per CSS überschreibst.
  // =========================
  const f7params = {
    name: 'My second app',
    theme: 'auto',

    colors: {
      // ✅ statt rosarot: dunkelblau (modern, gut lesbar)
      // Alternative grau: '#4b5563'
      primary: '#1e3a8a', // dunkelblau
    },

    store,
    routes,
  };

  // ✅ Framework7 initial ready + initial DarkMode anwenden
  useEffect(() => {
    f7ready(() => {
      // =========================
      // ✅ HIER wird Dark Mode EIN/AUS geschaltet (global)
      // - Wenn true => Framework7 setzt Dark-Styles und ".dark" Klasse
      // - Wenn false => Light Mode
      // =========================
      f7.setDarkMode(darkMode);
    });
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

            {/* ✅ Dark Mode Toggle (später gerne in Settings-Tab verschieben) */}
            <List strong inset>
              <ListButton
                title={darkMode ? 'Dark Mode: AN' : 'Dark Mode: AUS'}
                onClick={() => setDarkMode((v) => !v)}
              />
            </List>
          </Page>
        </View>
      </Panel>

      {/* Views/Tabs */}
      <Views tabs className="safe-areas">
        <Toolbar tabbar icons bottom>
          <ToolbarPane>
            <Link tabLink="#view-home" tabLinkActive iconIos="f7:house_fill" iconMd="material:home" text="Home" />
            <Link tabLink="#view-login" iconIos="f7:person_crop_circle" iconMd="material:login" text="Login" />
            <Link tabLink="#view-settings" iconIos="f7:gear" iconMd="material:settings" text="Settings" />
            <Link tabLink="#view-sudoku" iconIos="f7:gamecontroller" iconMd="material:games" text="Sudoku" />
          </ToolbarPane>
        </Toolbar>

        <View id="view-home" main tab tabActive url="/" />
        <View id="view-login" name="login" tab url="/login/" />
        <View id="view-settings" name="settings" tab url="/settings/" />
        <View id="view-sudoku" name="sudoku" tab url="/sudoku/" />
      </Views>

      {/* Popup */}
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

      {/* LoginScreen */}
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
