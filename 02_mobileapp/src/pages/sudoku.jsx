import React, { useMemo, useState } from 'react';
import { Page, Navbar, Block, BlockTitle } from 'framework7-react';
import SudokuGrid from '../components/SudokuGrid.jsx';

const empty9 = () => Array.from({ length: 9 }, () => Array(9).fill(0));
const falses9 = () => Array.from({ length: 9 }, () => Array(9).fill(false));

export default function SudokuPage() {
    const [grid, setGrid] = useState(empty9());
    const [given] = useState(falses9());
    const [selected, setSelected] = useState({ r: 0, c: 0 });

    const setNumber = (n) => {
        const { r, c } = selected;
        if (given[r][c]) return;

        setGrid((prev) => {
            const next = prev.map((row) => row.slice());
            next[r][c] = n;
            return next;
        });
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
                    onSelect={(r, c) => setSelected({ r, c })}
                />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginTop: 12 }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <button key={n} onClick={() => setNumber(n)} type="button">{n}</button>
                    ))}
                    <button onClick={() => setNumber(0)} type="button">Löschen</button>
                </div>
            </Block>
        </Page>
    );
}
