import { useEffect, useState } from 'react';
import { Page, Navbar, Block, List, ListItem, f7 } from 'framework7-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../js/firebase';
import './sudoku-list.css';

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
    const [difficulty, setDifficulty] = useState(
        normalizeDifficulty(props?.f7route?.query?.difficulty)
    );
    const label = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
        return () => unsub();
    }, []);

    useEffect(() => {
        setSolvedMap(readSolvedMap(user?.uid));
    }, [user]);

    useEffect(() => {
        setDifficulty(normalizeDifficulty(props?.f7route?.query?.difficulty));
    }, [props?.f7route?.query?.difficulty]);

    const refreshSolved = () => {
        setSolvedMap(readSolvedMap(user?.uid));
    };

    const items = Array.from({ length: 10 }, (_, i) => i);

    return (
        <Page
            name="sudoku-list"
            onPageBeforeIn={(e) => {
                const nextDiff = normalizeDifficulty(e?.detail?.route?.query?.difficulty);
                setDifficulty(nextDiff);
                refreshSolved();
            }}
        >
            <Navbar title={`Sudokus ${label}`} backLink="Zurück" />
            <Block strong inset>
                <List inset>
                    {items.map((idx) => {
                        const isSolved = !!solvedMap[`${difficulty}:${idx}`];
                        return (
                            <ListItem
                                key={`${difficulty}-${idx}`}
                                title={`Sudoku ${idx + 1}`}
                                after={
                                    <span className={`sudoku-status ${isSolved ? 'solved' : 'open'}`}>
                                        {isSolved ? 'Gelöst' : 'Offen'}
                                    </span>
                                }
                                link={`/sudoku/?mode=offline&difficulty=${difficulty}&puzzleIndex=${idx}`}
                                className={`sudoku-list-item ${isSolved ? 'solved' : 'open'}`}
                                onClick={() => {
                                    try {
                                        sessionStorage.setItem(
                                            'sudokuSelection',
                                            JSON.stringify({ mode: 'offline', difficulty, puzzleIndex: String(idx) })
                                        );
                                    } catch {
                                        // ignore
                                    }
                                }}
                            />
                        );
                    })}
                </List>
            </Block>
        </Page>
    );
}
