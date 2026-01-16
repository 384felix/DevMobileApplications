import React, { useEffect, useRef, useState } from 'react';
import { Page, Navbar, Block, BlockTitle, BlockFooter } from 'framework7-react';
import SudokuGrid from '../components/SudokuGrid.jsx';

const empty9 = () => Array.from({ length: 9 }, () => Array(9).fill(0));
const falses9 = () => Array.from({ length: 9 }, () => Array(9).fill(false));

export default function SudokuPage() {
    const [grid, setGrid] = useState(empty9());
    const [given] = useState(falses9());
    const [selected, setSelected] = useState({ r: 0, c: 0 });

    const inputRef = useRef(null);

    const focusKeyboard = () => {
        // iOS: muss synchron in User-Gesture passieren
        inputRef.current?.focus({ preventScroll: true });
    };

    const setNumber = (n) => {
        const { r, c } = selected;
        if (given[r][c]) return;

        setGrid((prev) => {
            const next = prev.map((row) => row.slice());
            next[r][c] = n;
            return next;
        });
    };

    // Desktop / Hardware-Tastatur
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
    }, [selected]);

    const handleSelect = (r, c) => {
        setSelected({ r, c });
        // KEIN setTimeout mehr nötig für iOS Keyboard-Opening
    };

    return (
        <Page name="sudoku">
            <Navbar title="Sudoku" />
            <BlockTitle>Sudoku</BlockTitle>

            <Block>
                <SudokuGrid
                    grid={grid}
                    given={given}
                    selected={selected}
                    onSelect={handleSelect}
                    focusKeyboard={focusKeyboard}   // ✅ neu
                />

                {/* Input muss "existieren" (nicht 0x0, nicht zIndex -1) */}
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginTop: 12 }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <button key={n} onClick={() => setNumber(n)} type="button">{n}</button>
                    ))}
                    <button onClick={() => setNumber(0)} type="button">Löschen</button>
                </div>
            </Block>

            <BlockFooter>
                iPhone: Tap auf Zelle öffnet Zahlen-Tastatur • Desktop: 1–9, Pfeile, Backspace
            </BlockFooter>
        </Page>
    );
}
