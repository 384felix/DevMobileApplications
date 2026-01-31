import { Page, Navbar, Block, Button, f7 } from 'framework7-react';

export default function SudokuMenuPage() {
    const goToSudoku = (query) => {
        f7.views.main?.router.navigate('/sudoku/', { query });
    };

    const goToList = (difficulty) => {
        console.log('[SudokuMenu] MENU select difficulty:', difficulty);
        f7.views.main?.router.navigate(`/sudoku-list/?difficulty=${difficulty}`, {
            reloadCurrent: true,
            ignoreCache: true,
        });
    };

    return (
        <Page name="sudoku-menu">
            <Navbar title="Sudoku Menü" />
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
