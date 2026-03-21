/*
 * Datei: loading.jsx
 * Inhalt: Diese Datei rendert den Ladebildschirm der Anwendung.
 *         Sichtbar sind das App-Logo, ein Ladehinweis und einfache
 *         visuelle Effekte, solange die App initialisiert wird
 *         oder noch auf den Authentifizierungsstatus wartet.
 */

export default function LoadingScreen() {
  const base = import.meta.env.BASE_URL || './';

  return (
    // Einfacher Startbildschirm, solange Authentifizierung und App-Initialisierung laufen.
    <div className="app-loading-screen">
      <div className="app-loading-screen__glow app-loading-screen__glow--left" />
      <div className="app-loading-screen__glow app-loading-screen__glow--right" />

      <img
        className="app-loading-screen__logo-image"
        src={`${base}assets/manifest-icon-512.png`}
        alt="Sudoku App Logo"
        loading="eager"
      />

      <div className="app-loading-screen__logo">Sudoku</div>
      <div className="app-loading-screen__spinner" />
      <div className="app-loading-screen__text">App wird geladen...</div>
    </div>
  );
}
