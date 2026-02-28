import { Page, Navbar, NavRight, Block, Button, f7 } from 'framework7-react';
import { useEffect, useState } from 'react';
import ProfileButton from '../components/ProfileButton.jsx';

export default function SudokuMenuPage() {
    const [lastPlayed, setLastPlayed] = useState(null);

    useEffect(() => {
        try {
            const raw = localStorage.getItem('sudokuLastPlayed');
            setLastPlayed(raw ? JSON.parse(raw) : null);
        } catch {
            setLastPlayed(null);
        }
    }, []);

    const lastPlayedLabel = (() => {
        if (!lastPlayed) return 'Keine';
        if (lastPlayed.mode === 'daily') return `Tägliches Sudoku (${lastPlayed.date || ''})`;
        if (lastPlayed.mode === 'offline') {
            const diff =
                lastPlayed.difficulty === 'easy'
                    ? 'Easy'
                    : lastPlayed.difficulty === 'medium'
                        ? 'Medium'
                        : lastPlayed.difficulty === 'hard'
                            ? 'Hard'
                            : 'Sudoku';
            const idx = Number.isFinite(lastPlayed.index) ? `${lastPlayed.index + 1}` : '';
            return `${diff}${idx}`;
        }
        return 'Keine';
    })();

    const goToSudoku = (query) => {
        // - Wechselt direkt zum Sudoku-Brett (z. B. tägliches Sudoku)
        f7.views.main?.router.navigate('/sudoku/', { query });
    };

    const goToList = (difficulty) => {
        // - Öffnet die Liste der Offline-Sudokus für die gewählte Schwierigkeit
        console.log('[SudokuMenu] MENU select difficulty:', difficulty);
        f7.views.main?.router.navigate(`/sudoku-list/?difficulty=${difficulty}`);
    };

    return (
        <Page name="sudoku-menu">
            <Navbar title="Sudoku Menü">
                <NavRight>
                    <ProfileButton />
                </NavRight>
            </Navbar>
            <div className="sudoku-menu-layout">
                {/* - Zentrale Auswahl für Daily / Offline */}
                <Block strong inset className="sudoku-menu-card">
                    <div className="sudoku-menu-last-line">Zuletzt bearbeitet: {lastPlayedLabel}</div>

                    <div className="sudoku-menu-section-title">Tägliches Sudoku</div>
                    <Button fill onClick={() => goToSudoku({ mode: 'daily' })}>
                        Starten
                    </Button>

                    <div className="sudoku-menu-section-title sudoku-menu-section-title--offline">Offline Sudokus</div>
                    <div className="sudoku-menu-difficulties">
                        <Button outline onClick={() => goToList('easy')}>
                            Easy
                        </Button>
                        <Button outline onClick={() => goToList('medium')}>
                            Medium
                        </Button>
                        <Button outline onClick={() => goToList('hard')}>
                            Hard
                        </Button>
                    </div>
                </Block>
            </div>
        </Page>
    );
}
