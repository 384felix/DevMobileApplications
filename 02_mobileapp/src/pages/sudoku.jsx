import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Page,
    Navbar,
    Block,
    BlockTitle,
    BlockFooter,
    List,
    ListItem,
    Button,
    Segmented,
    f7,
} from 'framework7-react';
import SudokuGrid from '../components/SudokuGrid.jsx';

// =========================
// Lösung (Basis)
const SOLUTION_BASE = [
    [5, 3, 4, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    [1, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

// =========================
// Easy / Medium / Hard (je 3)
const EASY_PUZZLES = [
    [
        [5, 3, 0, 6, 0, 0, 9, 0, 2],
        [0, 0, 0, 1, 9, 5, 3, 0, 8],
        [0, 0, 8, 0, 0, 0, 5, 0, 7],
        [8, 5, 0, 0, 6, 1, 4, 2, 0],
        [0, 2, 0, 0, 0, 3, 0, 9, 0],
        [0, 1, 0, 9, 2, 0, 8, 0, 6],
        [9, 6, 0, 5, 0, 0, 2, 0, 4],
        [2, 8, 7, 4, 0, 0, 0, 0, 0],
        [3, 4, 5, 2, 0, 0, 0, 0, 0],
    ],
    [
        [5, 0, 4, 0, 7, 8, 0, 1, 0],
        [6, 7, 0, 1, 0, 0, 0, 4, 8],
        [0, 9, 8, 3, 4, 0, 5, 0, 7],
        [8, 5, 9, 0, 6, 1, 0, 2, 0],
        [0, 2, 0, 8, 5, 0, 7, 9, 1],
        [7, 0, 3, 9, 0, 4, 8, 5, 0],
        [9, 6, 1, 0, 3, 7, 2, 8, 0],
        [2, 0, 7, 4, 1, 9, 0, 0, 5],
        [0, 4, 5, 2, 0, 6, 1, 7, 9],
    ],
    [
        [0, 3, 4, 0, 0, 8, 9, 0, 2],
        [6, 0, 2, 1, 9, 0, 3, 4, 0],
        [1, 9, 0, 3, 0, 2, 0, 6, 7],
        [8, 0, 9, 7, 6, 0, 4, 0, 3],
        [4, 2, 0, 0, 5, 3, 7, 9, 0],
        [0, 1, 3, 0, 2, 4, 8, 0, 6],
        [9, 6, 1, 5, 0, 0, 2, 8, 4],
        [2, 0, 7, 4, 1, 9, 6, 0, 5],
        [3, 4, 5, 0, 8, 6, 0, 7, 0],
    ],
];

const MEDIUM_PUZZLES = [
    [
        [5, 0, 4, 6, 7, 8, 0, 0, 0],
        [0, 7, 2, 1, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 2, 5, 0, 0],
        [0, 5, 0, 0, 0, 0, 4, 0, 0],
        [0, 0, 6, 8, 0, 3, 0, 0, 0],
        [0, 0, 3, 0, 0, 4, 0, 0, 6],
        [0, 0, 0, 5, 3, 7, 2, 8, 0],
        [0, 0, 7, 0, 0, 0, 0, 0, 5],
        [0, 4, 0, 2, 8, 6, 0, 7, 9],
    ],
    [
        [0, 0, 4, 6, 0, 0, 9, 0, 2],
        [6, 7, 0, 0, 9, 0, 0, 0, 0],
        [0, 9, 8, 0, 4, 0, 5, 6, 0],
        [8, 0, 0, 7, 0, 0, 0, 2, 0],
        [0, 0, 6, 0, 5, 0, 7, 0, 0],
        [0, 1, 0, 0, 0, 4, 0, 0, 6],
        [9, 0, 0, 5, 0, 7, 2, 0, 4],
        [0, 8, 0, 4, 0, 9, 0, 3, 0],
        [3, 0, 0, 0, 8, 6, 1, 0, 0],
    ],
    [
        [5, 3, 0, 0, 7, 0, 0, 1, 0],
        [0, 0, 2, 1, 0, 5, 0, 0, 8],
        [1, 0, 0, 3, 0, 0, 5, 0, 0],
        [0, 5, 9, 0, 6, 1, 0, 0, 0],
        [4, 0, 0, 8, 0, 3, 7, 0, 1],
        [0, 0, 3, 0, 2, 0, 0, 5, 0],
        [0, 6, 1, 5, 0, 7, 0, 0, 4],
        [2, 0, 0, 0, 1, 0, 6, 0, 0],
        [0, 4, 0, 2, 8, 6, 0, 7, 9],
    ],
];

const HARD_PUZZLES = [
    [
        [5, 3, 4, 0, 0, 0, 0, 0, 2],
        [0, 0, 0, 0, 0, 5, 0, 0, 0],
        [1, 0, 0, 0, 4, 0, 0, 0, 7],
        [0, 5, 0, 0, 0, 1, 4, 0, 0],
        [0, 0, 6, 8, 0, 0, 0, 0, 1],
        [7, 0, 0, 9, 0, 0, 8, 0, 0],
        [0, 0, 1, 0, 3, 0, 2, 0, 0],
        [0, 8, 0, 0, 0, 9, 0, 0, 0],
        [3, 0, 5, 0, 0, 0, 0, 7, 0],
    ],
    [
        [0, 0, 4, 6, 0, 0, 0, 0, 2],
        [6, 0, 0, 0, 0, 0, 3, 0, 0],
        [0, 9, 0, 0, 4, 0, 0, 6, 0],
        [8, 0, 0, 7, 0, 0, 0, 0, 0],
        [0, 0, 6, 0, 5, 0, 0, 0, 1],
        [0, 1, 0, 0, 0, 4, 0, 0, 0],
        [9, 0, 0, 0, 3, 0, 2, 0, 0],
        [0, 0, 7, 0, 0, 9, 0, 0, 5],
        [0, 4, 0, 0, 0, 0, 0, 0, 0],
    ],
    [
        [5, 0, 0, 0, 0, 8, 0, 0, 0],
        [0, 7, 0, 0, 0, 0, 3, 0, 0],
        [1, 0, 8, 0, 4, 0, 0, 0, 0],
        [0, 5, 0, 7, 0, 0, 0, 0, 0],
        [0, 0, 6, 0, 0, 3, 7, 0, 0],
        [0, 0, 0, 0, 2, 0, 8, 0, 6],
        [0, 0, 1, 0, 0, 7, 0, 0, 4],
        [2, 0, 0, 0, 0, 0, 0, 3, 0],
        [0, 4, 0, 2, 0, 0, 0, 0, 9],
    ],
];

// -------------------------
const clone9 = (g) => g.map((row) => row.slice());
const computeGiven = (puzzle) => puzzle.map((row) => row.map((v) => v !== 0));

function poolByDiff(diff) {
    if (diff === 'medium') return MEDIUM_PUZZLES;
    if (diff === 'hard') return HARD_PUZZLES;
    return EASY_PUZZLES;
}

function pickRandomPuzzleByDifficulty(diff) {
    const pool = poolByDiff(diff);
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx];
}

// -------------------------
function isCellInvalid(grid, r, c) {
    const v = grid[r][c];
    if (v === 0) return false;

    for (let cc = 0; cc < 9; cc++) if (cc !== c && grid[r][cc] === v) return true;
    for (let rr = 0; rr < 9; rr++) if (rr !== r && grid[rr][c] === v) return true;

    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let rr = br; rr < br + 3; rr++) {
        for (let cc = bc; cc < bc + 3; cc++) {
            if ((rr !== r || cc !== c) && grid[rr][cc] === v) return true;
        }
    }
    return false;
}

function computeInvalidMatrix(grid, given, helpEnabled) {
    const invalid = Array.from({ length: 9 }, () => Array(9).fill(false));
    if (!helpEnabled) return invalid;

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (given[r][c]) continue;
            if (grid[r][c] === 0) continue;
            invalid[r][c] = isCellInvalid(grid, r, c);
        }
    }
    return invalid;
}

function isSolvedGrid(grid) {
    const okSet = (arr) => {
        const s = new Set(arr);
        if (s.size !== 9) return false;
        for (let n = 1; n <= 9; n++) if (!s.has(n)) return false;
        return true;
    };

    for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
            if (grid[r][c] < 1 || grid[r][c] > 9) return false;

    for (let r = 0; r < 9; r++) if (!okSet(grid[r])) return false;

    for (let c = 0; c < 9; c++) {
        const col = [];
        for (let r = 0; r < 9; r++) col.push(grid[r][c]);
        if (!okSet(col)) return false;
    }

    for (let br = 0; br < 9; br += 3) {
        for (let bc = 0; bc < 9; bc += 3) {
            const box = [];
            for (let r = br; r < br + 3; r++)
                for (let c = bc; c < bc + 3; c++) box.push(grid[r][c]);
            if (!okSet(box)) return false;
        }
    }

    return true;
}

// =========================
export default function SudokuPage() {
    const [difficulty, setDifficulty] = useState('easy');

    // start puzzle = easy random
    const [puzzle, setPuzzle] = useState(() => pickRandomPuzzleByDifficulty('easy'));
    const [grid, setGrid] = useState(() => clone9(puzzle));

    const given = useMemo(() => computeGiven(puzzle), [puzzle]);

    const [selected, setSelected] = useState({ r: 0, c: 0 });
    const [helpEnabled, setHelpEnabled] = useState(true);
    const [solved, setSolved] = useState(false);

    const invalid = useMemo(() => computeInvalidMatrix(grid, given, helpEnabled), [grid, given, helpEnabled]);

    const isComplete = useMemo(() => {
        for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (grid[r][c] === 0) return false;
        return true;
    }, [grid]);

    const inputRef = useRef(null);
    const focusKeyboard = () => inputRef.current?.focus({ preventScroll: true });

    const handleSelect = (r, c) => setSelected({ r, c });

    const setNumber = (n) => {
        if (solved) return;

        const { r, c } = selected;
        if (given[r][c]) return;

        setGrid((prev) => {
            const next = clone9(prev);
            next[r][c] = n;
            return next;
        });
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!selected) return;
            const { r, c } = selected;

            if (e.key >= '1' && e.key <= '9') return setNumber(parseInt(e.key, 10));
            if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') return setNumber(0);

            if (e.key === 'ArrowUp' && r > 0) setSelected({ r: r - 1, c });
            if (e.key === 'ArrowDown' && r < 8) setSelected({ r: r + 1, c });
            if (e.key === 'ArrowLeft' && c > 0) setSelected({ r, c: c - 1 });
            if (e.key === 'ArrowRight' && c < 8) setSelected({ r, c: c + 1 });
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selected, solved]);

    // ✅ WICHTIG: Beim Wechsel der Difficulty sofort neues Sudoku laden,
    // damit der User direkt sieht, dass umgeschaltet wurde.
    const setDifficultyAndLoad = (diff) => {
        setDifficulty(diff);
        const nextPuzzle = pickRandomPuzzleByDifficulty(diff);
        setPuzzle(nextPuzzle);
        setSolved(false);
        setGrid(clone9(nextPuzzle));
        setSelected({ r: 0, c: 0 });
    };

    const resetPuzzle = () => {
        setSolved(false);
        setGrid(clone9(puzzle));
        setSelected({ r: 0, c: 0 });
    };

    const loadNewPuzzle = () => {
        const nextPuzzle = pickRandomPuzzleByDifficulty(difficulty);
        setPuzzle(nextPuzzle);
        setSolved(false);
        setGrid(clone9(nextPuzzle));
        setSelected({ r: 0, c: 0 });
    };

    const checkSolution = () => {
        const ok = isSolvedGrid(grid);
        if (ok) {
            setSolved(true);
            f7.dialog.alert('Glückwunsch! Sudoku ist korrekt gelöst ✅');
        } else {
            f7.dialog.alert('Du hast noch Fehler oder Konflikte. Bitte erneut versuchen 🙂');
        }
    };

    const fillWithSolution = () => {
        setGrid(clone9(SOLUTION_BASE));
        setSolved(false);
        f7.toast.create({ text: 'Debug: Lösung eingefügt (noch nicht geprüft)', closeTimeout: 1600 }).open();
    };

    return (
        <Page name="sudoku">
            <Navbar title="Sudoku" />

            <BlockTitle>Schwierigkeit</BlockTitle>
            <Block>
                {/* ✅ Sichtbarer aktiver Zustand: wir benutzen Button-Komponente statt Link */}
                <Segmented raised>
                    <Button
                        small
                        active={difficulty === 'easy'}
                        onClick={() => setDifficultyAndLoad('easy')}
                    >
                        Easy
                    </Button>
                    <Button
                        small
                        active={difficulty === 'medium'}
                        onClick={() => setDifficultyAndLoad('medium')}
                    >
                        Medium
                    </Button>
                    <Button
                        small
                        active={difficulty === 'hard'}
                        onClick={() => setDifficultyAndLoad('hard')}
                    >
                        Hard
                    </Button>
                </Segmented>

                {/* ✅ Anzeige, damit du IMMER weißt, was gewählt ist */}
                <div style={{ marginTop: 10, fontWeight: 700 }}>
                    Aktuell: {difficulty.toUpperCase()}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <Button fill onClick={loadNewPuzzle}>Neues Sudoku</Button>
                    <Button outline onClick={resetPuzzle}>Reset</Button>
                    <Button outline onClick={fillWithSolution}>Debug: Lösung einfügen</Button>

                    {isComplete && !solved && (
                        <Button fill onClick={checkSolution}>
                            Ergebnis prüfen
                        </Button>
                    )}

                    {solved && (
                        <span style={{ alignSelf: 'center', fontWeight: 700 }}>
                            ✅ Gelöst
                        </span>
                    )}
                </div>
            </Block>

            <BlockTitle>Sudoku</BlockTitle>
            <Block>
                <SudokuGrid
                    grid={grid}
                    given={given}
                    invalid={invalid}
                    selected={selected}
                    solved={solved}
                    onSelect={handleSelect}
                    focusKeyboard={focusKeyboard}
                />

                <input
                    ref={inputRef}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    aria-label="Sudoku number input"
                    style={{
                        position: 'fixed',
                        left: '-1000px',
                        top: '0px',
                        width: '20px',
                        height: '20px',
                        opacity: 0.01,
                    }}
                    onInput={(e) => {
                        const last = e.target.value.slice(-1);
                        if (last >= '1' && last <= '9') setNumber(parseInt(last, 10));
                        else if (last === '0') setNumber(0);
                        e.target.value = '';
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Backspace' || e.key === 'Delete') setNumber(0);
                    }}
                />
            </Block>

            <BlockTitle>Hilfen</BlockTitle>
            <List inset strong>
                <ListItem
                    checkbox
                    checked={helpEnabled}
                    title="Fehler markieren"
                    after={helpEnabled ? 'AN' : 'AUS'}
                    onChange={(e) => setHelpEnabled(e.target.checked)}
                />
            </List>

            <BlockFooter>
                Tipp: Tippe auf Easy/Medium/Hard — das Sudoku wechselt sofort. „Neues Sudoku“ lädt ein weiteres Puzzle aus der Stufe.
            </BlockFooter>
        </Page>
    );
}
