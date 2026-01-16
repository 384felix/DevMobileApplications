import React from 'react';
import './sudoku.css';

export default function SudokuGrid({ grid, given, selected, onSelect }) {
    return (
        <div className="sudoku-grid">
            {grid.map((row, r) =>
                row.map((val, c) => {
                    const isGiven = given[r][c];
                    const isSelected = selected?.r === r && selected?.c === c;

                    return (
                        <button
                            key={`${r}-${c}`}
                            className={[
                                'cell',
                                isGiven ? 'given' : '',
                                isSelected ? 'selected' : '',
                                (c === 2 || c === 5) ? 'right-border' : '',
                                (r === 2 || r === 5) ? 'bottom-border' : '',
                            ].join(' ')}
                            onClick={() => onSelect(r, c)}
                            type="button"
                        >
                            {val === 0 ? '' : val}
                        </button>
                    );
                })
            )}
        </div>
    );
}
