/*
 * Datei: app.jsx
 * Inhalt: Diese Datei definiert die Hauptstruktur der gesamten App.
 *         Hier befinden sich die Tab-Navigation, globale Statuswerte,
 *         Ladeverhalten, Online-Erkennung und die allgemeine
 *         Presence-Logik für angemeldete Nutzer.
 */

import { useEffect, useRef, useState } from 'react';
import { f7, f7ready, App, Views, View, Toolbar, Link } from 'framework7-react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { Network } from '@capacitor/network';

import routes from '../js/routes';
import { auth, db } from '../js/firebase';
import LoadingScreen from '../pages/loading.jsx';

function buildSaveDocId(uid, difficulty, puzzleIndex) {
  if (!uid || !Number.isFinite(puzzleIndex)) return null;
  return `${uid}_offline_${difficulty}_${puzzleIndex}`;
}

export default function MyApp() {
  const [incomingCount, setIncomingCount] = useState(0);
  const [online, setOnline] = useState(false);
  const [appVisible, setAppVisible] = useState(typeof document !== 'undefined' ? !document.hidden : true);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [minimumSplashDone, setMinimumSplashDone] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  const onlineInitRef = useRef(false);
  const cacheInFlightRef = useRef(false);
  const presenceUidRef = useRef(null);
  const authInitHandledRef = useRef(false);
  const lastViewUrlRef = useRef({
    'view-sudoku': '/start/',
    'view-friends': '/friends/',
    'view-leaderboard': '/leaderboard/',
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
    routes,
  };

  // Dark Mode wird lokal gespeichert und beim Start sofort angewendet.
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

  // Speichert bekannte Sudoku-Stände lokal, damit die Listen- und Spielseiten auch offline weiterarbeiten können.
  const cacheSudokuSaves = async (uid) => {
    if (!uid || cacheInFlightRef.current) return;
    cacheInFlightRef.current = true;

    try {
      const data = {};
      const difficulties = ['easy', 'medium', 'hard'];

      await Promise.all(
        difficulties.flatMap((difficulty) =>
          Array.from({ length: 10 }, (_, idx) => idx).map(async (idx) => {
            const docId = buildSaveDocId(uid, difficulty, idx);
            if (!docId) return;

            const snap = await getDoc(doc(db, 'sudokuSaves', docId));
            if (!snap.exists()) return;

            const saveData = snap.data() || {};
            if (!data[difficulty]) data[difficulty] = {};
            data[difficulty][String(idx)] = {
              puzzleStr: saveData.puzzleStr || '',
              gridStr: saveData.gridStr || '',
              solved: !!saveData.solved,
              updatedAt: saveData.updatedAt?.toMillis ? saveData.updatedAt.toMillis() : null,
            };
          })
        )
      );

      localStorage.setItem(`sudokuSavesCache_v1:${uid}`, JSON.stringify({ updatedAt: Date.now(), data }));
    } catch {
      // Der Cache ist optional und darf die App nicht beeinträchtigen.
    } finally {
      cacheInFlightRef.current = false;
    }
  };

  // Beim Wechsel zwischen Tabs soll die Profilseite nicht versehentlich in einem Fremd-Tab "stehen bleiben".
  useEffect(() => {
    f7ready(() => {
      const viewIds = ['view-sudoku', 'view-friends', 'view-leaderboard'];
      const views = viewIds.map((id) => f7.views.get(`#${id}`)).filter(Boolean);

      const handleRouteChange = (viewId, route) => {
        const url = route?.url;
        if (url && !url.startsWith('/profile/')) {
          lastViewUrlRef.current[viewId] = url;
        }
      };

      const routeHandlers = views.map((view) => {
        const handler = (route) => handleRouteChange(view.el?.id, route);
        view.router.on('routeChange', handler);
        return { view, handler };
      });

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

      f7.on('tabShow', handleTabShow);

      return () => {
        routeHandlers.forEach(({ view, handler }) => {
          view.router.off('routeChange', handler);
        });
        f7.off('tabShow', handleTabShow);
      };
    });
  }, []);

  // Nach Login oder Logout geht die App zurück ins Sudoku-Menü.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser || null);
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

  useEffect(() => {
    let listener;
    let cleanupFallback = null;

    const initNetwork = async () => {
      try {
        const status = await Network.getStatus();
        setOnline(status.connected);

        listener = await Network.addListener('networkStatusChange', (nextStatus) => {
          setOnline(nextStatus.connected);
        });
      } catch {
        const update = () => setOnline(navigator.onLine);
        update();
        window.addEventListener('online', update);
        window.addEventListener('offline', update);

        cleanupFallback = () => {
          window.removeEventListener('online', update);
          window.removeEventListener('offline', update);
        };
      }
    };

    initNetwork();

    return () => {
      if (listener) listener.remove();
      if (cleanupFallback) cleanupFallback();
    };
  }, []);

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

  // Presence in Firestore: online nur dann, wenn die App sichtbar ist und eine Verbindung besteht.
  useEffect(() => {
    const currentUid = user?.uid || null;
    const previousUid = presenceUidRef.current;

    if (previousUid && previousUid !== currentUid) {
      setDoc(doc(db, 'users', previousUid), { online: false, lastSeen: serverTimestamp() }, { merge: true }).catch(() => {});
    }

    presenceUidRef.current = currentUid;
    if (!currentUid) return;

    const shouldBeOnline = online && appVisible;
    setDoc(doc(db, 'users', currentUid), { online: shouldBeOnline, lastSeen: serverTimestamp() }, { merge: true }).catch(() => {});
  }, [user, online, appVisible]);

  useEffect(() => {
    const uid = user?.uid || null;
    if (!uid || !online || !appVisible) return;

    const ref = doc(db, 'users', uid);
    const intervalId = window.setInterval(() => {
      setDoc(ref, { online: true, lastSeen: serverTimestamp() }, { merge: true }).catch(() => {});
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [user, online, appVisible]);

  useEffect(() => {
    return () => {
      const uid = presenceUidRef.current;
      if (!uid) return;
      setDoc(doc(db, 'users', uid), { online: false, lastSeen: serverTimestamp() }, { merge: true }).catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!onlineInitRef.current) {
      onlineInitRef.current = true;
      return;
    }

    f7.toast.create({
      text: online ? 'Online' : 'Offline',
      closeTimeout: 1500,
    }).open();
  }, [online, user]);

  useEffect(() => {
    if (!user || !online) return;
    cacheSudokuSaves(user.uid);
  }, [user, online]);

  // Zeigt offene Freundschaftsanfragen direkt am Tab an.
  useEffect(() => {
    let unsub = null;

    const offAuth = onAuthStateChanged(auth, (nextUser) => {
      if (unsub) {
        unsub();
        unsub = null;
      }

      setIncomingCount(0);
      if (!nextUser) return;

      const requestsQuery = query(
        collection(db, 'friendRequests'),
        where('toUid', '==', nextUser.uid),
        where('status', '==', 'pending')
      );
      unsub = onSnapshot(requestsQuery, (snap) => setIncomingCount(snap.size));
    });

    return () => {
      if (unsub) unsub();
      offAuth();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    f7ready(() => {
      f7.setDarkMode(darkMode);
    });
  }, [darkMode]);

  if (!authReady || !minimumSplashDone) {
    return <LoadingScreen />;
  }

  return (
    <App {...f7params}>
      {/* Drei Hauptbereiche der App: Spiel, Freunde und Rangliste. */}
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
    </App>
  );
}
