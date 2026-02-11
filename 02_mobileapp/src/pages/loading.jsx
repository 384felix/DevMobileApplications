export default function LoadingScreen() {
  return (
    <div className="app-loading-screen">
      <div className="app-loading-screen__glow app-loading-screen__glow--left" />
      <div className="app-loading-screen__glow app-loading-screen__glow--right" />

      <img
        className="app-loading-screen__logo-image"
        src="/assets/manifest-icon-512.png"
        alt="Sudoku App Logo"
        loading="eager"
      />

      <div className="app-loading-screen__logo">Sudoku</div>
      <div className="app-loading-screen__spinner" />
      <div className="app-loading-screen__text">App wird geladen...</div>
    </div>
  );
}
