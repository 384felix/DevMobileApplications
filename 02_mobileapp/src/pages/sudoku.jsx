import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Page,
    Navbar,
    NavLeft,
    NavRight,
    Block,
    BlockFooter,
    List,
    ListItem,
    Button,
    Link,
    f7,
} from 'framework7-react';
import SudokuGrid from '../components/SudokuGrid.jsx';
import ProfileButton from '../components/ProfileButton.jsx';
import puzzles from '../../tools/puzzles.json';

// ✅ Firebase
import { auth, db } from '../js/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

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

const clone9Static = (g) => g.map((row) => row.slice());

function lcg(seed) {
    let s = seed | 0;
    return () => {
        s = (s * 1664525 + 1013904223) | 0;
        return (s >>> 0) / 4294967296;
    };
}

function rngFromSeed(seed) {
    const h = hashStringToInt(String(seed));
    return lcg(h);
}

function shuffleInPlace(arr, rand) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
}

function permuteSolutionFromSeed(seed) {
    const rand = rngFromSeed(seed);

    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    shuffleInPlace(digits, rand);
    const digitMap = new Map();
    for (let i = 0; i < 9; i++) digitMap.set(i + 1, digits[i]);

    const bandOrder = [0, 1, 2];
    shuffleInPlace(bandOrder, rand);
    const rowOrder = [];
    for (const b of bandOrder) {
        const rows = [0, 1, 2];
        shuffleInPlace(rows, rand);
        for (const r of rows) rowOrder.push(b * 3 + r);
    }

    const stackOrder = [0, 1, 2];
    shuffleInPlace(stackOrder, rand);
    const colOrder = [];
    for (const s of stackOrder) {
        const cols = [0, 1, 2];
        shuffleInPlace(cols, rand);
        for (const c of cols) colOrder.push(s * 3 + c);
    }

    const transpose = rand() < 0.5;
    const out = Array.from({ length: 9 }, () => Array(9).fill(0));

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const baseVal = SOLUTION_BASE[rowOrder[r]][colOrder[c]];
            const v = digitMap.get(baseVal) || baseVal;
            if (transpose) out[c][r] = v;
            else out[r][c] = v;
        }
    }

    return out;
}

function makeMask(maskSeed, clues) {
    const rand = rngFromSeed(maskSeed);
    const total = 81;
    const keep = Math.max(0, Math.min(total, clues));
    const indices = Array.from({ length: total }, (_, i) => i);
    shuffleInPlace(indices, rand);
    const mask = Array(total).fill('0');
    for (let i = 0; i < keep; i++) mask[indices[i]] = '1';
    return mask.join('');
}

function buildPuzzleFromSeedAndMask(seed, mask) {
    const solution = permuteSolutionFromSeed(seed);
    const puzzle = clone9Static(solution);
    for (let i = 0; i < 81; i++) {
        if (mask[i] !== '1') {
            puzzle[Math.floor(i / 9)][i % 9] = 0;
        }
    }
    return puzzle;
}

// =========================
// Easy / Medium / Hard (je 10, aus tools/puzzles.json)
const EASY_PUZZLES = (puzzles?.easy || []).map((p) => ({ seed: p.seed, mask: p.mask }));
const MEDIUM_PUZZLES = (puzzles?.medium || []).map((p) => ({ seed: p.seed, mask: p.mask }));
const HARD_PUZZLES = (puzzles?.hard || []).map((p) => ({ seed: p.seed, mask: p.mask }));

// -------------------------
const clone9 = (g) => g.map((row) => row.slice());
const computeGiven = (p) => p.map((row) => row.map((v) => v !== 0));

function poolByDiff(diff) {
    if (diff === 'medium') return MEDIUM_PUZZLES;
    if (diff === 'hard') return HARD_PUZZLES;
    return EASY_PUZZLES;
}

function normalizeIndex(idx, len) {
    if (!Number.isFinite(idx) || len <= 0) return 0;
    return ((idx % len) + len) % len;
}

function getLocalDateKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function hashStringToInt(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

function pickRandomPuzzleByDifficulty(diff) {
    const pool = poolByDiff(diff);
    const idx = Math.floor(Math.random() * pool.length);
    const entry = pool[idx];
    return {
        puzzle: buildPuzzleFromSeedAndMask(entry.seed, entry.mask),
        poolIndex: idx,
        seed: entry.seed,
        mask: entry.mask,
    };
}

function pickDailyPuzzleByDifficulty(diff, dateKey) {
    const pool = poolByDiff(diff);
    const idx = hashStringToInt(`${dateKey}:${diff}`) % pool.length;
    const entry = pool[idx];
    return {
        puzzle: buildPuzzleFromSeedAndMask(entry.seed, entry.mask),
        poolIndex: idx,
        seed: entry.seed,
        mask: entry.mask,
    };
}

function pickPuzzleByIndex(diff, index) {
    const pool = poolByDiff(diff);
    const idx = normalizeIndex(index, pool.length);
    const entry = pool[idx];
    return {
        puzzle: buildPuzzleFromSeedAndMask(entry.seed, entry.mask),
        poolIndex: idx,
        seed: entry.seed,
        mask: entry.mask,
    };
}

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

function writeSolvedMap(uid, map) {
    try {
        localStorage.setItem(getSolvedStorageKey(uid), JSON.stringify(map));
    } catch {
        // ignore storage errors
    }
}

function markSolved(uid, diff, poolIndex) {
    if (!diff || !Number.isFinite(poolIndex)) return;
    const map = readSolvedMap(uid);
    map[`${diff}:${poolIndex}`] = true;
    writeSolvedMap(uid, map);
}

function countGivens(grid) {
    let n = 0;
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (grid[r][c] !== 0) n++;
        }
    }
    return n;
}

function buildSaveDocId(uid, mode, difficulty, puzzleListIndex, puzzleIndex) {
    if (!uid) return null;
    if (mode === 'daily') {
        const dateKey = getLocalDateKey();
        return `${uid}_daily_${dateKey}`;
    }
    if (mode !== 'offline') return null;
    const idx = Number.isFinite(puzzleListIndex) ? puzzleListIndex : puzzleIndex;
    if (!Number.isFinite(idx)) return null;
    return `${uid}_offline_${difficulty}_${idx}`;
}

function readPendingSelection() {
    try {
        const raw = sessionStorage.getItem('sudokuSelection');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function clearPendingSelection() {
    try {
        sessionStorage.removeItem('sudokuSelection');
    } catch {
        // ignore
    }
}

// ✅ Firestore-safe serialize/deserialize (keine nested arrays)
function gridToString(g) {
    let out = '';
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) out += String(g[r][c] ?? 0);
    return out;
}

function stringToGrid(s) {
    if (typeof s !== 'string' || s.length !== 81) return null;
    const g = [];
    for (let r = 0; r < 9; r++) {
        const row = [];
        for (let c = 0; c < 9; c++) {
            const ch = s[r * 9 + c];
            const n = parseInt(ch, 10);
            row.push(Number.isFinite(n) ? n : 0);
        }
        g.push(row);
    }
    return g;
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
export default function SudokuPage(props) {
    // - Debug: Firebase komplett deaktivieren (nur lokal arbeiten)
    const firebaseDisabled = false;
    // ✅ Auth / Save
    const [user, setUser] = useState(null);
    const [loadingSave, setLoadingSave] = useState(false);
    const [savingNow, setSavingNow] = useState(false);
    const [mode, setMode] = useState('offline');
    const selectionOverrideRef = useRef(false);
    const [saveDebug, setSaveDebug] = useState('');
    const [localSelectionDebug, setLocalSelectionDebug] = useState('Auswahl: -');
    const [firebasePresenceDebug, setFirebasePresenceDebug] = useState('Firebase: -');
    const [firebaseCheckRequested, setFirebaseCheckRequested] = useState(false);
    const [stateDebug, setStateDebug] = useState('State: -');
    const [authDebug, setAuthDebug] = useState('Auth: -');

    const hasLoadedRef = useRef(false);
    const lastUidRef = useRef(null);

    // -------------------------
    const initialPickRef = useRef(null);
    if (!initialPickRef.current) {
        initialPickRef.current = pickRandomPuzzleByDifficulty('easy');
    }

    const [difficulty, setDifficulty] = useState('easy');
    const [puzzle, setPuzzle] = useState(() => initialPickRef.current.puzzle);
    const [puzzleIndex, setPuzzleIndex] = useState(() => initialPickRef.current.poolIndex);
    const [puzzleSeed, setPuzzleSeed] = useState(() => initialPickRef.current.seed);
    const [puzzleMask, setPuzzleMask] = useState(() => initialPickRef.current.mask);
    const [puzzleListIndex, setPuzzleListIndex] = useState(null);
    const [grid, setGrid] = useState(() => clone9(initialPickRef.current.puzzle));

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

    // ✅ Auth Listener
    useEffect(() => {
        // - Hört auf Login/Logout
        const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
        return () => unsub();
    }, []);

    // ✅ Doc Ref
    const saveRef = useMemo(() => {
        if (firebaseDisabled) return null;
        if (!user) return null;
        // - Doc-ID pro Puzzle: uid_offline_<difficulty>_<index>
        const docId = buildSaveDocId(user.uid, mode, difficulty, puzzleListIndex, puzzleIndex);
        if (!docId) return null;
        return doc(db, 'sudokuSaves', docId);
    }, [firebaseDisabled, user, mode, difficulty, puzzleListIndex, puzzleIndex]);

    const fetchFromFirebase = async () => {
        if (firebaseDisabled) {
            setFirebasePresenceDebug('Firebase: deaktiviert (Debug)');
            setFirebaseCheckRequested(false);
            return;
        }
        if (!saveRef) {
            setFirebasePresenceDebug('Firebase: Nein, es liegen keine Firebase-Daten ab.');
            return;
        }
        setLoadingSave(true);
        try {
            const snap = await getDoc(saveRef);

            if (!snap.exists()) {
                setFirebasePresenceDebug('Firebase: Nein, es liegen keine Firebase-Daten ab.');
                return;
            }

            const data = snap.data();
            setFirebasePresenceDebug('Firebase: Ja, es liegen Firebase-Daten ab.');

            const loadedMode = data.mode === 'daily' ? 'daily' : 'offline';
            const loadedDifficulty = data.difficulty || 'easy';
            const fallbackPick =
                loadedMode === 'daily'
                    ? pickDailyPuzzleByDifficulty(loadedDifficulty, getLocalDateKey())
                    : pickRandomPuzzleByDifficulty(loadedDifficulty);
            const hasSeedMask = typeof data.puzzleSeed === 'string' && typeof data.puzzleMask === 'string';
            const seedMaskPick = hasSeedMask
                ? {
                    puzzle: buildPuzzleFromSeedAndMask(data.puzzleSeed, data.puzzleMask),
                    seed: data.puzzleSeed,
                    mask: data.puzzleMask,
                }
                : null;
            const loadedPuzzle =
                stringToGrid(data.puzzleStr) || seedMaskPick?.puzzle || fallbackPick.puzzle;
            const loadedGrid = stringToGrid(data.gridStr) || clone9(loadedPuzzle);
            const loadedPuzzleIndex = Number.isFinite(data.puzzleIndex)
                ? data.puzzleIndex
                : fallbackPick.poolIndex;

            console.log('[Sudoku] loaded save:', {
                loadedMode,
                loadedDifficulty,
                loadedPuzzleIndex,
                givens: countGivens(loadedPuzzle),
                seed: seedMaskPick?.seed || fallbackPick.seed,
            });

            setMode(loadedMode);
            setDifficulty(loadedDifficulty);
            setPuzzle(loadedPuzzle);
            setPuzzleIndex(loadedPuzzleIndex);
            setPuzzleSeed(seedMaskPick?.seed || fallbackPick.seed);
            setPuzzleMask(seedMaskPick?.mask || fallbackPick.mask);
            setPuzzleListIndex(null);
            setGrid(loadedGrid);
            setSaveDebug(
                `Firebase geladen: ${loadedMode} ${loadedDifficulty} idx ${loadedPuzzleIndex} givens ${countGivens(
                    loadedPuzzle
                )}`
            );

            setHelpEnabled(typeof data.helpEnabled === 'boolean' ? data.helpEnabled : true);
            setSolved(!!data.solved);
            setSelected(data.selected?.r != null && data.selected?.c != null ? data.selected : { r: 0, c: 0 });
        } catch (e) {
            console.error('Failed to load sudoku save', e);
            f7.dialog.alert(`${e.code || ''}\n${e.message || e}`, 'Sudoku Load Error');
        } finally {
            setLoadingSave(false);
            setFirebaseCheckRequested(false);
        }
    };

    // ✅ Auth-Status beeinflusst keine Sudoku-Auswahl
    useEffect(() => {
        if (!user) {
            setAuthDebug('Auth: nicht eingeloggt');
        } else {
            setAuthDebug(`Auth: eingeloggt (${user.uid})`);
        }
    }, [user]);

    // ✅ Firebase-Load nur per Button
    useEffect(() => {
        if (!firebaseCheckRequested) return;
        fetchFromFirebase();
    }, [firebaseCheckRequested, saveRef]);

    // ✅ Manueller Save Button (Firestore-safe)
    const manualSave = async () => {
        if (firebaseDisabled) {
            f7.toast.create({ text: 'Firebase deaktiviert (Debug)', closeTimeout: 1500 }).open();
            return;
        }
        if (!user) {
            f7.dialog.alert('Bitte zuerst einloggen, um zu speichern.');
            return;
        }
        if (!saveRef) return;

        setSavingNow(true);
        try {
            await setDoc(
                saveRef,
                {
                    uid: user.uid,
                    updatedAt: serverTimestamp(),

                    mode,
                    difficulty,
                    puzzleIndex,
                    puzzleSeed,
                    puzzleMask,
                    puzzleStr: gridToString(puzzle),
                    gridStr: gridToString(grid),

                    helpEnabled,
                    solved,
                    selected,
                },
                { merge: true }
            );

            f7.toast.create({ text: 'Gespeichert ✅', closeTimeout: 1500 }).open();
        } catch (e) {
            console.error('Manual save failed', e);
            f7.dialog.alert(`${e.code || ''}\n${e.message || e}`, 'Speichern fehlgeschlagen');
        } finally {
            setSavingNow(false);
        }
    };

    // ✅ Auto-Save debounced – ebenfalls Firestore-safe
    const saveTimer = useRef(null);
    useEffect(() => {
        if (firebaseDisabled) return;
        if (!saveRef) return;
        if (!hasLoadedRef.current) return;

        if (saveTimer.current) clearTimeout(saveTimer.current);

        saveTimer.current = setTimeout(async () => {
            try {
                await setDoc(
                    saveRef,
                    {
                        uid: user.uid,
                        updatedAt: serverTimestamp(),
                        mode,
                        difficulty,
                        puzzleIndex,
                        puzzleSeed,
                        puzzleMask,
                        puzzleStr: gridToString(puzzle),
                        gridStr: gridToString(grid),
                        helpEnabled,
                        solved,
                        selected,
                    },
                    { merge: true }
                );
            } catch (e) {
                console.error('Auto-save failed', e);
            }
        }, 600);

        return () => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
        };
    }, [firebaseDisabled, saveRef, user, mode, difficulty, puzzleIndex, puzzleSeed, puzzleMask, puzzle, grid, helpEnabled, solved, selected]);

    // Keyboard
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

    // Aktionen
    const loadPuzzleForMode = (diff, nextMode = mode) => {
        // - Lädt ein neues Puzzle (lokal, ohne Firebase)
        const dateKey = getLocalDateKey();
        const nextPick =
            nextMode === 'daily' ? pickDailyPuzzleByDifficulty(diff, dateKey) : pickRandomPuzzleByDifficulty(diff);
        setPuzzle(nextPick.puzzle);
        setPuzzleIndex(nextPick.poolIndex);
        setPuzzleSeed(nextPick.seed);
        setPuzzleMask(nextPick.mask);
        setPuzzleListIndex(null);
        setSolved(false);
        setGrid(clone9(nextPick.puzzle));
        setSelected({ r: 0, c: 0 });
        hasLoadedRef.current = true;
    };

    const applySelection = (sel) => {
        // - Wird aufgerufen, wenn du in der Liste ein Sudoku auswählst
        if (!sel) return;
        const nextMode = sel.mode === 'daily' || sel.mode === 'offline' ? sel.mode : null;
        const nextDifficulty =
            sel.difficulty === 'easy' || sel.difficulty === 'medium' || sel.difficulty === 'hard'
                ? sel.difficulty
                : null;
        const parsedPuzzleIndex = parseInt(sel.puzzleIndex, 10);
        const hasPuzzleIndex = Number.isFinite(parsedPuzzleIndex);

        if (!nextMode && !nextDifficulty && !hasPuzzleIndex) return;

        selectionOverrideRef.current = true;
        setStateDebug(
            `State: Auswahl gesetzt (${nextDifficulty || difficulty} / idx ${Number.isFinite(parsedPuzzleIndex) ? parsedPuzzleIndex : '-'})`
        );

        console.log('[Sudoku] applySelection:', {
            nextMode,
            nextDifficulty,
            parsedPuzzleIndex,
            hasPuzzleIndex,
            mode,
            difficulty,
        });

        const finalMode = nextMode || mode;
        const finalDifficulty = nextDifficulty || difficulty;

        if (nextMode) setMode(finalMode);
        if (nextDifficulty) setDifficulty(finalDifficulty);

        if (hasPuzzleIndex) {
            const pick = pickPuzzleByIndex(finalDifficulty, parsedPuzzleIndex);
            console.log('[Sudoku] selected puzzle:', {
                difficulty: finalDifficulty,
                index: parsedPuzzleIndex,
                givens: countGivens(pick.puzzle),
                seed: pick.seed,
            });
            setLocalSelectionDebug(`Auswahl: ${finalDifficulty} idx ${parsedPuzzleIndex}`);
            setPuzzle(pick.puzzle);
            setPuzzleIndex(pick.poolIndex);
            setPuzzleSeed(pick.seed);
            setPuzzleMask(pick.mask);
            setPuzzleListIndex(parsedPuzzleIndex);
            setSolved(false);
            setGrid(clone9(pick.puzzle));
            setSelected({ r: 0, c: 0 });
            hasLoadedRef.current = true;
            if (!firebaseDisabled) {
                setFirebasePresenceDebug('Firebase: Prüfung läuft...');
                setFirebaseCheckRequested(true);
            }

        } else {
            loadPuzzleForMode(finalDifficulty, finalMode);
        }

        if (readPendingSelection()) {
            setTimeout(() => clearPendingSelection(), 0);
        }
    };

    const resetPuzzle = () => {
        setSolved(false);
        setGrid(clone9(puzzle));
        setSelected({ r: 0, c: 0 });
    };

    const loadNewPuzzle = () => {
        if (mode === 'daily') {
            f7.toast
                .create({ text: 'Tägliches Sudoku bleibt für heute gleich.', closeTimeout: 1800 })
                .open();
            return;
        }
        loadPuzzleForMode(difficulty);
    };

    useEffect(() => {
        // - Route-Query (difficulty/puzzleIndex) kommt hier an
        const routeQuery = props?.f7route?.query || {};
        console.log('[Sudoku] route query:', routeQuery);
        applySelection(routeQuery);
    }, [props?.f7route?.query?.mode, props?.f7route?.query?.difficulty, props?.f7route?.query?.puzzleIndex]);

    const checkSolution = async () => {
        const ok = isSolvedGrid(grid);
        if (ok) {
            setSolved(true);
            // - Beim Lösen sofort speichern (aktueller Stand)
            if (user && saveRef) {
                try {
                    await setDoc(
                        saveRef,
                        {
                            uid: user.uid,
                            updatedAt: serverTimestamp(),
                            mode,
                            difficulty,
                            puzzleIndex,
                            puzzleSeed,
                            puzzleMask,
                            puzzleStr: gridToString(puzzle),
                            gridStr: gridToString(grid),
                            helpEnabled,
                            solved: true,
                            selected,
                        },
                        { merge: true }
                    );
                    f7.toast.create({ text: 'Gelöst & gespeichert ✅', closeTimeout: 1500 }).open();
                } catch (e) {
                    console.error('Save on solve failed', e);
                    f7.dialog.alert(`${e.code || ''}\n${e.message || e}`, 'Speichern fehlgeschlagen');
                }
            }
            if (mode === 'offline') {
                const idx = Number.isFinite(puzzleListIndex) ? puzzleListIndex : puzzleIndex;
                if (Number.isFinite(idx)) {
                    markSolved(user?.uid, difficulty, idx);
                    if (user) {
                        try {
                            const summaryRef = doc(db, 'users', user.uid, 'sudokuProgress', 'summary');
                            await setDoc(
                                summaryRef,
                                {
                                    offline: {
                                        [difficulty]: {
                                            [String(idx)]: true,
                                        },
                                    },
                                },
                                { merge: true }
                            );
                        } catch (e) {
                            console.error('Failed to update summary', e);
                        }
                    }
                }
            }
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
        <Page
            name="sudoku"
            onPageBeforeIn={() => {
                const pending = readPendingSelection();
                if (pending) {
                    applySelection(pending);
                }
            }}
        >
            <Navbar title="">
                <NavLeft>
                    <Link href="/sudoku-menu/" iconF7="menu">
                        Menü
                    </Link>
                </NavLeft>
                <NavRight>
                    <ProfileButton />
                </NavRight>
            </Navbar>

            <Block strong inset style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                    {user ? (
                        <>
                            Eingeloggt als: <b>{user.email}</b>
                        </>
                    ) : (
                        <>
                            <b>Nicht eingeloggt</b> – Stand wird nicht gespeichert.
                        </>
                    )}
                </div>
                <div style={{ fontWeight: 700 }}>
                    Modus: {mode === 'daily' ? `Tägliches Sudoku (${getLocalDateKey()})` : 'Offline'}
                </div>
                <div style={{ opacity: 0.7 }}>{loadingSave ? 'Lade Spielstand…' : user ? 'Bereit' : ''}</div>
            </Block>
            {saveDebug && (
                <Block inset>
                    {saveDebug}
                </Block>
            )}
            <Block inset>
                Es wurde folgendes Sudoku gewählt. {difficulty} {puzzleSeed} {puzzleMask}
            </Block>

            <Block>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <Button fill onClick={loadNewPuzzle}>
                        Neues Sudoku
                    </Button>
                    <Button outline onClick={resetPuzzle}>
                        Reset
                    </Button>
                    <Button outline onClick={fillWithSolution}>
                        Debug: Lösung einfügen
                    </Button>

                    {/* ✅ Speichern-Button */}
                    <Button fill disabled={!user || savingNow || loadingSave} onClick={manualSave}>
                        {savingNow ? 'Speichere…' : 'Speichern'}
                    </Button>

                    {isComplete && !solved && (
                        <Button fill onClick={checkSolution}>
                            Ergebnis prüfen
                        </Button>
                    )}

                    {solved && <span style={{ alignSelf: 'center', fontWeight: 700 }}>✅ Gelöst</span>}
                </div>
            </Block>

            <Block>
                {mode === 'offline' && (
                    <div style={{ marginBottom: 8, fontWeight: 700 }}>
                        Schwierigkeit: {difficulty.toUpperCase()} · Vorgaben: {countGivens(puzzle)}
                    </div>
                )}
                <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.7 }}>{localSelectionDebug}</div>
                <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.7 }}>{firebasePresenceDebug}</div>
                <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.7 }}>{stateDebug}</div>
                <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.7 }}>{authDebug}</div>
                {!firebaseDisabled && (
                    <Button
                        outline
                        onClick={() => {
                            setFirebasePresenceDebug('Firebase: Prüfung läuft...');
                            setFirebaseCheckRequested(true);
                        }}
                    >
                        Firebase-Abgleich durchführen (Debug)
                    </Button>
                )}
                {/* - Sudoku-Brett */}
                <SudokuGrid
                    grid={grid}
                    given={given}
                    invalid={invalid}
                    selected={selected}
                    solved={solved}
                    onSelect={(r, c) => setSelected({ r, c })}
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
                Jetzt speichert Firestore: <b>gridStr</b> und <b>puzzleStr</b> (81 Zeichen). In Firebase solltest du eine Collection{' '}
                <b>sudokuSaves</b> sehen.
            </BlockFooter>

        </Page>
    );
}
