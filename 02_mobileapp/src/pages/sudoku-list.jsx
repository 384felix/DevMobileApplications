import { useEffect, useState } from 'react';
import { Page, Navbar, NavRight, Block, List, ListItem, f7 } from 'framework7-react';
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

export default function SudokuListPage(props) {
    const [user, setUser] = useState(null);
    const [solvedMap, setSolvedMap] = useState({});
    const [solvedSummary, setSolvedSummary] = useState({});
    const [difficulty, setDifficulty] = useState(
        normalizeDifficulty(props?.f7route?.query?.difficulty)
    );
    const label = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

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

    const items = Array.from({ length: 10 }, (_, i) => i);

    return (
        <Page
            name="sudoku-list"
            onPageBeforeIn={(e) => {
                // - Seite wird angezeigt: Status-Liste aktualisieren
                console.log('[SudokuList] onPageBeforeIn');
                refreshSolved();
                refreshSummary();
            }}
        >
            <Navbar title={`Sudokus ${label}`} backLink="Zurück">
                <NavRight>
                    <ProfileButton />
                </NavRight>
            </Navbar>
            <Block strong inset>
                <List inset>
                    {items.map((idx) => {
                        const solvedByFirebase = !!solvedSummary?.[difficulty]?.[String(idx)];
                        const isSolved = user ? solvedByFirebase : !!solvedMap[`${difficulty}:${idx}`];
                        return (
                            <ListItem
                                key={`${difficulty}-${idx}`}
                                title={`Sudoku ${idx + 1}`}
                                after={
                                    <span className={`sudoku-status ${isSolved ? 'solved' : 'open'}`}>
                                        {isSolved ? 'Gelöst' : 'Offen'}
                                    </span>
                                }
                                link
                                className={`sudoku-list-item ${isSolved ? 'solved' : 'open'}`}
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
