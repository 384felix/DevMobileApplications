import { useEffect, useState } from 'react';
import { Page, Navbar, NavRight, Block, List, ListItem, Link, f7 } from 'framework7-react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../js/firebase';
import './sudoku-list.css';
import ProfileButton from '../components/ProfileButton.jsx';

function getSolvedStorageKey(uid) {
    return `sudokuSolved_v1:${uid || 'anon'}`;
}

function readSolvedMap(uid) {
    try {
        const raw = localStorage.getItem(getSolvedStorageKey(uid));
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function normalizeDifficulty(diff) {
    if (diff === 'medium' || diff === 'hard') return diff;
    return 'easy';
}

function countFilledFromString(str) {
    if (!str || typeof str !== 'string') return 0;
    let n = 0;
    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch >= '1' && ch <= '9') n++;
    }
    return n;
}

function buildSaveDocId(uid, difficulty, puzzleIndex) {
    if (!uid) return null;
    if (!Number.isFinite(puzzleIndex)) return null;
    return `${uid}_offline_${difficulty}_${puzzleIndex}`;
}

function readCachedSaves(uid) {
    if (!uid) return {};
    try {
        const raw = localStorage.getItem(`sudokuSavesCache_v1:${uid}`);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed.data || {} : {};
    } catch {
        return {};
    }
}

export default function SudokuListPage(props) {
    const [user, setUser] = useState(null);
    const [solvedMap, setSolvedMap] = useState({});
    const [solvedSummary, setSolvedSummary] = useState({});
    const [progressMap, setProgressMap] = useState({});
    const [difficulty, setDifficulty] = useState(
        normalizeDifficulty(props?.f7route?.query?.difficulty)
    );
    const label = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
    const items = Array.from({ length: 10 }, (_, i) => i);

    useEffect(() => {
        // - Merkt sich, wer eingeloggt ist (für "Gelöst"-Anzeige)
        const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
        return () => unsub();
    }, []);

    useEffect(() => {
        // - Lokaler Speicher: gelöste Sudokus pro User
        console.log('[SudokuList] user uid:', user?.uid || 'anon');
        setSolvedMap(readSolvedMap(user?.uid));
    }, [user]);

    useEffect(() => {
        const fetchSummary = async () => {
            if (!user) {
                setSolvedSummary({});
                setProgressMap({});
                return;
            }
            try {
                const summaryRef = doc(db, 'users', user.uid, 'sudokuProgress', 'summary');
                const snap = await getDoc(summaryRef);
                setSolvedSummary(snap.exists() ? snap.data()?.offline || {} : {});
            } catch (e) {
                console.error('Failed to load summary', e);
                setSolvedSummary({});
            }
        };
        fetchSummary();
    }, [user]);

    const refreshSummary = async () => {
        if (!user) {
            setSolvedSummary({});
            setProgressMap({});
            return;
        }
        try {
            const summaryRef = doc(db, 'users', user.uid, 'sudokuProgress', 'summary');
            const snap = await getDoc(summaryRef);
            setSolvedSummary(snap.exists() ? snap.data()?.offline || {} : {});
        } catch (e) {
            console.error('Failed to load summary', e);
            setSolvedSummary({});
        }
    };

    const refreshProgress = async () => {
        if (!user) {
            setProgressMap({});
            return;
        }
        if (!navigator.onLine) {
            const cached = readCachedSaves(user.uid);
            const results = {};
            items.forEach((idx) => {
                const entry = cached?.[difficulty]?.[String(idx)];
                if (!entry) return;
                const puzzleFilled = countFilledFromString(entry.puzzleStr);
                const gridFilled = countFilledFromString(entry.gridStr);
                const inProgress = !entry.solved && gridFilled > puzzleFilled;
                results[idx] = { inProgress: !!inProgress, solved: !!entry.solved };
            });
            setProgressMap(results);
            return;
        }
        try {
            const results = {};
            await Promise.all(
                items.map(async (idx) => {
                    const docId = buildSaveDocId(user.uid, difficulty, idx);
                    if (!docId) return;
                    const snap = await getDoc(doc(db, 'sudokuSaves', docId));
                    if (!snap.exists()) return;
                    const data = snap.data() || {};
                    const puzzleFilled = countFilledFromString(data.puzzleStr);
                    const gridFilled = countFilledFromString(data.gridStr);
                    const inProgress = !data.solved && gridFilled > puzzleFilled;
                    results[idx] = { inProgress: !!inProgress, solved: !!data.solved };
                })
            );
            setProgressMap(results);
        } catch (e) {
            console.error('Failed to load progress', e);
            const cached = readCachedSaves(user.uid);
            const results = {};
            items.forEach((idx) => {
                const entry = cached?.[difficulty]?.[String(idx)];
                if (!entry) return;
                const puzzleFilled = countFilledFromString(entry.puzzleStr);
                const gridFilled = countFilledFromString(entry.gridStr);
                const inProgress = !entry.solved && gridFilled > puzzleFilled;
                results[idx] = { inProgress: !!inProgress, solved: !!entry.solved };
            });
            setProgressMap(results);
        }
    };

    useEffect(() => {
        // - Liest die Schwierigkeit aus der URL (?difficulty=hard)
        const raw = props?.f7route?.query?.difficulty;
        const norm = normalizeDifficulty(raw);
        console.log('[SudokuList] route difficulty:', raw, '=>', norm);
        setDifficulty(norm);
    }, [props?.f7route?.query?.difficulty]);

    const refreshSolved = () => {
        setSolvedMap(readSolvedMap(user?.uid));
    };

    useEffect(() => {
        refreshProgress();
    }, [user, difficulty]);

    const handleBackToMenu = (e) => {
        if (e?.preventDefault) e.preventDefault();
        const router = f7.views.main?.router;
        if (!router) return;
        router.navigate('/sudoku-menu/', { reloadCurrent: true, ignoreCache: true });
    };

    return (
        <Page
            name="sudoku-list"
            onPageBeforeIn={(e) => {
                // - Seite wird angezeigt: Status-Liste aktualisieren
                console.log('[SudokuList] onPageBeforeIn');
                refreshSolved();
                refreshSummary();
                refreshProgress();
            }}
        >
            <Navbar title={`Sudokus ${label}`}>
                <Link slot="left" iconF7="chevron_left" aria-label="Zurück" onClick={handleBackToMenu} />
                <NavRight>
                    <ProfileButton />
                </NavRight>
            </Navbar>
            <Block strong inset>
                <List inset>
                    {items.map((idx) => {
                        const solvedByFirebase = !!solvedSummary?.[difficulty]?.[String(idx)];
                        const solvedBySave = !!progressMap?.[idx]?.solved;
                        const isSolved = user ? (solvedByFirebase || solvedBySave) : !!solvedMap[`${difficulty}:${idx}`];
                        const isInProgress = user ? !!progressMap?.[idx]?.inProgress : false;
                        const statusLabel = isSolved ? 'Gelöst' : isInProgress ? 'In Bearbeitung' : 'Ungelöst';
                        const statusClass = isSolved ? 'solved' : isInProgress ? 'in-progress' : 'unsolved';
                        return (
                            <ListItem
                                key={`${difficulty}-${idx}`}
                                title={`Sudoku ${idx + 1}`}
                                after={
                                    <span className={`sudoku-status ${statusClass}`}>
                                        {statusLabel}
                                    </span>
                                }
                                link
                                className={`sudoku-list-item ${statusClass}`}
                                onClick={(e) => {
                                    // - Auswahl eines konkreten Sudokus (Index 0..9)
                                    console.log('[SudokuList] click puzzle', { difficulty, idx });
                                    if (e?.preventDefault) e.preventDefault();
                                    try {
                                        sessionStorage.setItem(
                                            'sudokuSelection',
                                            JSON.stringify({ mode: 'offline', difficulty, puzzleIndex: String(idx) })
                                        );
                                    } catch {
                                        // ignore
                                    }
                                    f7.views.main?.router.navigate(
                                        `/sudoku/?mode=offline&difficulty=${difficulty}&puzzleIndex=${idx}`,
                                        { reloadCurrent: true, ignoreCache: true }
                                    );
                                }}
                            />
                        );
                    })}
                </List>
            </Block>
        </Page>
    );
}
