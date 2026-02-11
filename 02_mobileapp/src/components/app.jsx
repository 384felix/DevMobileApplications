import React, { useEffect, useRef, useState } from 'react';

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
import LoadingScreen from '../pages/loading.jsx';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { Network } from '@capacitor/network';

const MyApp = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [incomingCount, setIncomingCount] = useState(0);
  const [online, setOnline] = useState(false);
  const [appVisible, setAppVisible] = useState(typeof document !== 'undefined' ? !document.hidden : true);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [minimumSplashDone, setMinimumSplashDone] = useState(false);
  const onlineInitRef = useRef(false);
  const cacheInFlightRef = useRef(false);
  const presenceUidRef = useRef(null);
  const authInitHandledRef = useRef(false);
  const lastViewUrlRef = useRef({
    'view-sudoku': '/start/',
    'view-friends': '/friends/',
    'view-leaderboard': '/leaderboard/',
  });

  // ✅ Dark Mode State (persistiert)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const pushStateRoot = import.meta.env.BASE_URL?.startsWith('/') ? import.meta.env.BASE_URL : '/';

  const f7params = {
    name: 'Sudoku',
    theme: 'auto',
    pushState: true,
    pushStateRoot,

    colors: {
      primary: '#2b93bf',
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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setMinimumSplashDone(true);
    }, 900);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const buildSaveDocId = (uid, difficulty, puzzleIndex) => {
    if (!uid) return null;
    if (!Number.isFinite(puzzleIndex)) return null;
    return `${uid}_offline_${difficulty}_${puzzleIndex}`;
  };

  const cacheSudokuSaves = async (uid) => {
    if (!uid || cacheInFlightRef.current) return;
    cacheInFlightRef.current = true;
    try {
      const difficulties = ['easy', 'medium', 'hard'];
      const data = {};
      await Promise.all(
        difficulties.flatMap((difficulty) =>
          Array.from({ length: 10 }, (_, idx) => idx).map(async (idx) => {
            const docId = buildSaveDocId(uid, difficulty, idx);
            if (!docId) return;
            const snap = await getDoc(doc(db, 'sudokuSaves', docId));
            if (!snap.exists()) return;
            const d = snap.data() || {};
            if (!data[difficulty]) data[difficulty] = {};
            data[difficulty][String(idx)] = {
              puzzleStr: d.puzzleStr || '',
              gridStr: d.gridStr || '',
              solved: !!d.solved,
              updatedAt: d.updatedAt?.toMillis ? d.updatedAt.toMillis() : null,
            };
          })
        )
      );
      const payload = { updatedAt: Date.now(), data };
      localStorage.setItem(`sudokuSavesCache_v1:${uid}`, JSON.stringify(payload));
    } catch (e) {
      console.error('[cacheSudokuSaves] failed', e);
    } finally {
      cacheInFlightRef.current = false;
    }
  };

  // ✅ Wenn man vom Tab weg und zurück geht, Profil-Page schließen
  useEffect(() => {
    f7ready(() => {
      const viewIds = ['view-sudoku', 'view-friends', 'view-leaderboard'];
      const views = viewIds
        .map((id) => f7.views.get(`#${id}`))
        .filter(Boolean);

      const handleRouteChange = (viewId, route) => {
        const url = route?.url;
        if (url && !url.startsWith('/profile/')) {
          lastViewUrlRef.current[viewId] = url;
        }
      };

      const handleTabShow = (tabEl) => {
        if (!tabEl?.id) return;
        const view = f7.views.get(`#${tabEl.id}`);
        if (!view) return;
        const currentUrl = view.router?.currentRoute?.url || '';
        if (currentUrl.startsWith('/profile/')) {
          const target = lastViewUrlRef.current[tabEl.id] || view.router?.history?.[0] || '/';
          view.router.navigate(target, { reloadCurrent: true, ignoreCache: true });
        }
      };

      views.forEach((view) => {
        view.router.on('routeChange', (route) => handleRouteChange(view.el?.id, route));
      });
      f7.on('tabShow', handleTabShow);

      return () => {
        views.forEach((view) => {
          view.router.off('routeChange');
        });
        f7.off('tabShow', handleTabShow);
      };
    });
  }, []);

  // ✅ Nach Login/Logout immer zurück ins Sudoku-Menü
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setAuthReady(true);
      f7ready(() => {
        if (!authInitHandledRef.current) {
          authInitHandledRef.current = true;
          return;
        }
        f7.views.main?.router.navigate('/sudoku-menu/', { reloadCurrent: true, ignoreCache: true });
      });
    });
    return () => unsub();
  }, []);

  // ✅ Online/Offline Status global
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

  // ✅ App-Sichtbarkeit für Presence
  useEffect(() => {
    const updateVisibility = () => setAppVisible(!document.hidden);
    const markHidden = () => setAppVisible(false);

    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    window.addEventListener('pagehide', markHidden);

    return () => {
      document.removeEventListener('visibilitychange', updateVisibility);
      window.removeEventListener('pagehide', markHidden);
    };
  }, []);

  // ✅ Presence in Firestore: Online nur wenn eingeloggt + Netz + App sichtbar
  useEffect(() => {
    const currentUid = user?.uid || null;
    const previousUid = presenceUidRef.current;

    if (previousUid && previousUid !== currentUid) {
      setDoc(doc(db, 'users', previousUid), { online: false, lastSeen: serverTimestamp() }, { merge: true }).catch((e) =>
        console.error('[presence] mark previous user offline failed', e)
      );
    }

    presenceUidRef.current = currentUid;
    if (!currentUid) return;

    const shouldBeOnline = online && appVisible;
    setDoc(doc(db, 'users', currentUid), { online: shouldBeOnline, lastSeen: serverTimestamp() }, { merge: true }).catch((e) =>
      console.error('[presence] update failed', e)
    );
  }, [user, online, appVisible]);

  // ✅ Presence-Heartbeat: lastSeen regelmäßig aktualisieren, solange der Nutzer wirklich online ist
  useEffect(() => {
    const uid = user?.uid || null;
    const shouldBeOnline = !!uid && online && appVisible;
    if (!shouldBeOnline) return;

    const ref = doc(db, 'users', uid);
    const intervalId = window.setInterval(() => {
      setDoc(ref, { online: true, lastSeen: serverTimestamp() }, { merge: true }).catch((e) =>
        console.error('[presence] heartbeat failed', e)
      );
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [user, online, appVisible]);

  // ✅ Beim Unmount sicher offline setzen
  useEffect(() => {
    return () => {
      const uid = presenceUidRef.current;
      if (!uid) return;
      setDoc(doc(db, 'users', uid), { online: false, lastSeen: serverTimestamp() }, { merge: true }).catch((e) =>
        console.error('[presence] unmount offline failed', e)
      );
    };
  }, []);

  // ✅ Online/Offline Toast nur bei Statuswechsel
  useEffect(() => {
    if (!user) return;
    if (!onlineInitRef.current) {
      onlineInitRef.current = true;
      return;
    }
    f7.toast
      .create({
        text: online ? 'Online' : 'Offline',
        closeTimeout: 1500,
      })
      .open();
  }, [online, user]);

  useEffect(() => {
    if (!user || !online) return;
    cacheSudokuSaves(user.uid);
  }, [user, online]);

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

  if (!authReady || !minimumSplashDone) {
    return <LoadingScreen />;
  }

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

        <View id="view-sudoku" main tab tabActive url="/start/" />
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
