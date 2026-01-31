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
            const idx = Number.isFinite(lastPlayed.index) ? ` #${lastPlayed.index + 1}` : '';
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
        f7.views.main?.router.navigate(`/sudoku-list/?difficulty=${difficulty}`, {
            reloadCurrent: true,
            ignoreCache: true,
        });
    };

    return (
        <Page name="sudoku-menu">
            <Navbar title="Sudoku Menü">
                <NavRight>
                    <ProfileButton />
                </NavRight>
            </Navbar>
            <Block strong inset style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>Zuletzt bearbeitet:</div>
                <div style={{ fontWeight: 700 }}>{lastPlayedLabel}</div>
            </Block>
            <div
                style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                    boxSizing: 'border-box',
                }}
            >
                {/* - Zentrale Auswahl für Daily / Offline */}
                <Block
                    strong
                    inset
                    style={{
                        width: 'min(92vw, 340px)',
                        display: 'grid',
                        gap: 12,
                        textAlign: 'center',
                    }}
                >
                    <div style={{ fontWeight: 700 }}>Tägliches Sudoku</div>
                    <Button fill onClick={() => goToSudoku({ mode: 'daily' })}>
                        Starten
                    </Button>

                    <div style={{ marginTop: 8, fontWeight: 700 }}>Offline Sudokus</div>
                    <div style={{ display: 'grid', gap: 8 }}>
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
