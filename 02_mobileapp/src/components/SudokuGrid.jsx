import React from 'react';
import './sudoku.css';

export default function SudokuGrid({ grid, given, selected, onSelect, focusKeyboard }) {
    return (
        <div className="sudoku-grid">
            {grid.map((row, r) =>
                row.map((val, c) => {
                    const isGiven = given[r][c];
                    const isSelected = selected?.r === r && selected?.c === c;

                    const className = [
                        'cell',
                        isGiven ? 'given' : '',
                        isSelected ? 'selected' : '',
                        c === 2 || c === 5 ? 'right-border' : '',
                        r === 2 || r === 5 ? 'bottom-border' : '',
                    ].join(' ');

                    const handleTap = (e) => {
                        e.preventDefault();     // verhindert Button-Fokus/Selektion
                        focusKeyboard?.();      // ✅ iOS: synchron im Touch-Event
                        onSelect(r, c);
                    };

                    return (
                        <button
                            key={`${r}-${c}`}
                            className={className}
                            type="button"
                            tabIndex={-1}
                            onTouchStart={handleTap}   // ✅ iOS
                            onMouseDown={handleTap}    // ✅ Desktop (Fallback)
                        >
                            {val === 0 ? '' : val}
                        </button>
                    );
                })
            )}
        </div>
    );
}
