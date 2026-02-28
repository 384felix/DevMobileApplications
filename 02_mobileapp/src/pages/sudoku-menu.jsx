import { Page, Navbar, NavRight, Block, Button, f7 } from 'framework7-react';
import { useEffect, useState } from 'react';
import ProfileButton from '../components/ProfileButton.jsx';
import { auth, db } from '../js/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function SudokuMenuPage() {
    const [lastPlayed, setLastPlayed] = useState(null);
    const [user, setUser] = useState(null);
    const [progress, setProgress] = useState({ easy: 0, medium: 0, hard: 0 });

    useEffect(() => {
        try {
            const raw = localStorage.getItem('sudokuLastPlayed');
            setLastPlayed(raw ? JSON.parse(raw) : null);
        } catch {
            setLastPlayed(null);
        }
    }, []);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
        return () => unsub();
    }, []);

    useEffect(() => {
        const countFromLocal = (uid) => {
            try {
                const raw = localStorage.getItem(`sudokuSolved_v1:${uid || 'anon'}`);
                const map = raw ? JSON.parse(raw) : {};
                const out = { easy: 0, medium: 0, hard: 0 };
                Object.keys(map || {}).forEach((k) => {
                    if (!map[k]) return;
                    const [diff] = k.split(':');
                    if (diff === 'easy' || diff === 'medium' || diff === 'hard') out[diff] += 1;
                });
                setProgress({
                    easy: Math.min(10, out.easy),
                    medium: Math.min(10, out.medium),
                    hard: Math.min(10, out.hard),
                });
            } catch {
                setProgress({ easy: 0, medium: 0, hard: 0 });
            }
        };

        if (!user) {
            countFromLocal(null);
            return;
        }

        (async () => {
            try {
                const snap = await getDoc(doc(db, 'users', user.uid, 'sudokuProgress', 'summary'));
                if (!snap.exists()) {
                    countFromLocal(user.uid);
                    return;
                }
                const data = snap.data() || {};
                const offline = data.offline || {};
                const count = (diff) => Math.min(10, Object.keys(offline[diff] || {}).length);
                setProgress({
                    easy: count('easy'),
                    medium: count('medium'),
                    hard: count('hard'),
                });
            } catch {
                countFromLocal(user.uid);
            }
        })();
    }, [user]);

    const lastPlayedLabel = (() => {
        if (!lastPlayed) return 'Keine';
        if (lastPlayed.mode === 'daily') return `Tägliches Sudoku (${lastPlayed.date || ''})`;
        if (lastPlayed.mode === 'offline') {
            const diff =
                lastPlayed.difficulty === 'easy'
                    ? 'Easy'
                    : lastPlayed.difficulty === 'medium'
                        ? 'Medium'
                        : lastPlayed.difficulty === 'hard'
                            ? 'Hard'
                            : 'Sudoku';
            const idx = Number.isFinite(lastPlayed.index) ? `${lastPlayed.index + 1}` : '';
            return `${diff}${idx}`;
        }
        return 'Keine';
    })();

    const goToSudoku = (query) => {
        // - Wechselt direkt zum Sudoku-Brett (z. B. tägliches Sudoku)
        f7.views.main?.router.navigate('/sudoku/', { query });
    };

    const continueToSudoku = (selection) => {
        try {
            sessionStorage.setItem('sudokuSelection', JSON.stringify(selection));
        } catch {
            // ignore
        }
        f7.views.main?.router.navigate('/sudoku/', { reloadCurrent: true, ignoreCache: true });
    };

    const canContinueLast = (() => {
        if (!lastPlayed) return false;
        if (lastPlayed.mode === 'daily') return true;
        if (lastPlayed.mode === 'offline') {
            const hasDiff = ['easy', 'medium', 'hard'].includes(lastPlayed.difficulty);
            return hasDiff && Number.isFinite(lastPlayed.index);
        }
        return false;
    })();

    const continueLastPlayed = () => {
        if (!lastPlayed) return;
        if (lastPlayed.mode === 'daily') {
            continueToSudoku({ mode: 'daily' });
            return;
        }
        if (lastPlayed.mode === 'offline') {
            const difficulty = ['easy', 'medium', 'hard'].includes(lastPlayed.difficulty)
                ? lastPlayed.difficulty
                : 'easy';
            const index = Number.isFinite(lastPlayed.index) ? lastPlayed.index : 0;
            continueToSudoku({ mode: 'offline', difficulty, puzzleIndex: String(index) });
        }
    };

    const goToList = (difficulty) => {
        // - Öffnet die Liste der Offline-Sudokus für die gewählte Schwierigkeit
        console.log('[SudokuMenu] MENU select difficulty:', difficulty);
        f7.views.main?.router.navigate(`/sudoku-list/?difficulty=${difficulty}`);
    };

    return (
        <Page name="sudoku-menu">
            <Navbar title="Sudoku Menü">
                <NavRight>
                    <ProfileButton />
                </NavRight>
            </Navbar>
            <div className="sudoku-menu-layout">
                {/* - Zentrale Auswahl für Daily / Offline */}
                <Block strong inset className="sudoku-menu-card">
                    <div className="sudoku-menu-section-title">Tägliches Sudoku</div>
                    <Button fill onClick={() => goToSudoku({ mode: 'daily' })}>
                        Starten
                    </Button>

                    <div className="sudoku-menu-section-title sudoku-menu-section-title--offline">Offline Sudokus</div>
                    <div className="sudoku-menu-difficulties">
                        <Button outline onClick={() => goToList('easy')}>
                            Easy
                        </Button>
                        <Button outline onClick={() => goToList('medium')}>
                            Medium
                        </Button>
                        <Button outline onClick={() => goToList('hard')}>
                            Hard
                        </Button>
                    </div>
                    <div className="sudoku-menu-progress">
                        <div className="sudoku-menu-progress__row">
                            <span>Easy</span>
                            <span>{progress.easy}/10</span>
                        </div>
                        <div className="sudoku-menu-progress__bar"><span style={{ width: `${progress.easy * 10}%` }} /></div>
                        <div className="sudoku-menu-progress__row">
                            <span>Medium</span>
                            <span>{progress.medium}/10</span>
                        </div>
                        <div className="sudoku-menu-progress__bar"><span style={{ width: `${progress.medium * 10}%` }} /></div>
                        <div className="sudoku-menu-progress__row">
                            <span>Hard</span>
                            <span>{progress.hard}/10</span>
                        </div>
                        <div className="sudoku-menu-progress__bar"><span style={{ width: `${progress.hard * 10}%` }} /></div>
                    </div>

                    <div className="sudoku-menu-last-line">Zuletzt bearbeitet: {lastPlayedLabel}</div>
                    <Button
                        small
                        outline
                        className="sudoku-menu-continue-btn"
                        disabled={!canContinueLast}
                        onClick={continueLastPlayed}
                    >
                        Fortsetzen
                    </Button>
                </Block>
            </div>
        </Page>
    );
}
