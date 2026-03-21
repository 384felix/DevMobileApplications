/*
 * Datei: SudokuGrid.jsx
 * Inhalt: Diese Datei rendert das sichtbare 9x9-Sudoku-Raster.
 *         Sie kümmert sich um die Darstellung einzelner Zellen,
 *         markiert feste, ausgewählte und fehlerhafte Felder
 *         und leitet Klicks an die Spiellogik weiter.
 */

import './sudoku.css';

export default function SudokuGrid({ grid, given, invalid, selected, solved, onSelect, focusKeyboard }) {
    return (
        <div className="sudoku-grid-wrapper">
            {/* Das Raster selbst ist rein darstellend.
                Die eigentliche Spiellogik bleibt in sudoku.jsx. */}
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

                            // Die Eingabehilfe wird nur für veränderbare Zellen geöffnet.
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
