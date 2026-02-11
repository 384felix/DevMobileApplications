import { Page, Block, Button } from 'framework7-react';

export default function StartPage() {
  const base = import.meta.env.BASE_URL || './';

  return (
    <Page name="start" className="start-screen-page">
      <div className="start-screen">
        <div className="start-screen__halo start-screen__halo--left" />
        <div className="start-screen__halo start-screen__halo--right" />

        <Block className="start-screen__card" strong inset>
          <img
            className="start-screen__logo"
            src={`${base}assets/manifest-icon-512.png`}
            alt="Sudoku App Logo"
            loading="eager"
          />

          <div className="start-screen__eyebrow">Daily Challenge</div>
          <h1 className="start-screen__title">Sudoku</h1>
          <p className="start-screen__text">
            Fuege Freunde hinzu und fordere sie heraus. Loese taegliche Sudokus, um es mit deinen Erfolgen in den Newsfeed zu schaffen.
          </p>

          <div className="start-screen__actions">
            <Button fill large href="/sudoku/?mode=daily" className="start-screen__btn start-screen__btn--daily">
              Daily Sudoku starten
            </Button>
            <Button outline large href="/sudoku-menu/" className="start-screen__btn start-screen__btn--menu">
              Zum Sudoku-Menue
            </Button>
          </div>
        </Block>
      </div>
    </Page>
  );
}
