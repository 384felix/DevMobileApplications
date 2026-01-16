import React from 'react';
import './sudoku.css';

export default function SudokuGrid({ grid, given, invalid, selected, solved, onSelect, focusKeyboard }) {
    return (
        <div className="sudoku-grid-wrapper">
            <div className={`sudoku-grid ${solved ? 'solved' : ''}`} role="grid" aria-label="Sudoku grid">
                {grid.map((row, r) =>
                    row.map((val, c) => {
                        const isGiven = given[r][c];
                        const isSelected = selected?.r === r && selected?.c === c;
                        const isInvalid = invalid?.[r]?.[c] === true;

                        const className = [
                            'cell',
                            isGiven ? 'given' : '',
                            isSelected ? 'selected' : '',
                            isInvalid ? 'invalid' : '',
                            solved ? 'solved' : '',
                            c === 2 || c === 5 ? 'right-border' : '',
                            r === 2 || r === 5 ? 'bottom-border' : '',
                        ].join(' ');

                        const handleTap = (e) => {
                            e.preventDefault();
                            onSelect(r, c);

                            // Keyboard nur für editierbare Zellen und nicht wenn solved
                            if (!isGiven && !solved) focusKeyboard?.();
                        };

                        return (
                            <button
                                key={`${r}-${c}`}
                                className={className}
                                type="button"
                                tabIndex={-1}
                                onTouchStart={handleTap}
                                onMouseDown={handleTap}
                                aria-label={`Row ${r + 1}, Col ${c + 1}, ${val === 0 ? 'empty' : val}`}
                            >
                                {val === 0 ? '' : val}
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}
