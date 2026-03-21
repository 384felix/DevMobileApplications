# Sudoku-App

## Kurzbeschreibung

Dieses Projekt ist eine mobile Sudoku-App auf Basis von **React**, **Framework7**, **Vite** und **Capacitor**.  
Die App kombiniert ein klassisches Sudoku-Spiel mit sozialen Funktionen wie **Profilverwaltung**, **Freundesliste**, **Leaderboard** und **Daily Challenge**.

## Nutzung der App

Nach dem Start gelangt man auf die Startseite. Von dort aus kann man:

- ein **Daily Sudoku** starten,
- in das **Sudoku-Menue** wechseln,
- sich im **Profil** anmelden oder registrieren,
- Freunde verwalten,
- das **Leaderboard** und den Aktivitaets-Feed ansehen.

Im Spiel selbst waehlt der Nutzer ein Sudoku aus, fuellt das Raster aus und kann seinen Fortschritt lokal bzw. ueber Firebase speichern.  
Die App unterstuetzt ausserdem Online-/Offline-Erkennung sowie einfache Profilinformationen wie Benutzername, Avatar und Standort.

## Projektstruktur

### Hauptordner

- `src/`: eigentlicher Quellcode der App
- `src/pages/`: einzelne Seiten der Anwendung
- `src/components/`: wiederverwendbare React-Komponenten
- `src/js/`: App-Start, Routing, Store und Firebase-Anbindung
- `src/css/`: globale Styles
- `src/fonts/`: Icon- und Schriftdateien
- `public/`: statische Dateien wie Icons, Manifest, Offline-Seite und Avatare
- `tools/`: Hilfsdateien fuer die Sudoku-Erzeugung
- `www/`: gebautes Web-Ergebnis der App
- `ios/`: iOS-Projekt fuer die mobile Ausfuehrung mit Capacitor

## Wichtige Dateien und ihre Inhalte

### Einstieg und App-Grundstruktur

- `src/js/app.js`: Startpunkt der React-Anwendung; bindet Framework7 ein und rendert die Haupt-App.
- `src/components/app.jsx`: zentrale App-Komponente; enthaelt Tab-Navigation, globale Statusverwaltung, Login-Status, Online-/Offline-Erkennung und Ladebildschirm.
- `src/js/routes.js`: definiert, welche URL zu welcher Seite fuehrt.
- `src/js/firebase.js`: initialisiert Firebase und exportiert Authentifizierung sowie Firestore-Datenbank.

### Seiten der App

- `src/pages/start.jsx`: Startseite mit Einstieg in Daily Sudoku oder Sudoku-Menue.
- `src/pages/sudoku-menu.jsx`: Menue fuer die Auswahl von Spielmodi und Anzeige des letzten Spielstands.
- `src/pages/sudoku-list.jsx`: Liste verfuegbarer Sudokus nach Schwierigkeitsgrad und Fortschritt.
- `src/pages/sudoku.jsx`: wichtigste Spiellogik; laedt Raetsel, erzeugt Sudoku-Felder, prueft Fortschritt und speichert Ergebnisse.
- `src/pages/profile.jsx`: Registrierung, Login, Logout, Profilbearbeitung, Avatar-Auswahl und Standortfunktion.
- `src/pages/friends.jsx`: Verwaltung von Freunden und Freundschaftsanfragen.
- `src/pages/leaderboard.jsx`: Rangliste und Aktivitaets-Feed der Spieler.
- `src/pages/loading.jsx`: eigener Ladebildschirm beim Start der App.
- `src/pages/404.jsx`: Fehlerseite fuer unbekannte Routen.

### Wiederverwendbare Komponenten

- `src/components/SudokuGrid.jsx`: Darstellung des 9x9-Sudoku-Rasters und Benutzerinteraktion mit den Zellen.
- `src/components/ProfileButton.jsx`: Profil-Button in der Navigation, abhaengig von Login- und Online-Status.
- `src/components/sudoku.css`: Styling des Sudoku-Spielfelds.

### Daten und Hilfsdateien

- `tools/puzzles.json`: vorbereitete Sudoku-Raetsel fuer die Schwierigkeitsgrade `easy`, `medium` und `hard`.
- `tools/generate-sudoku.js`: Skript zur Generierung neuer Sudoku-Raetsel.
- `public/Avatars/`: Bilder fuer die Profil-Avatare.
- `public/manifest.json`, `public/offline.html`: Dateien fuer PWA-/Offline-Verhalten.

### Build- und Konfigurationsdateien

- `package.json`: Projektdefinition, Abhaengigkeiten und Start-/Build-Befehle.
- `vite.config.mjs`: Vite-Konfiguration fuer Entwicklung und Build.
- `capacitor.config.json`: Konfiguration fuer die mobile Einbettung ueber Capacitor.
- `framework7.json`: Grundkonfiguration des Framework7-Projekts.

## Technischer Aufbau in Kurzform

- **Frontend:** React + Framework7
- **Build-System:** Vite
- **Mobile Verpackung:** Capacitor
- **Backend-Dienste:** Firebase Authentication + Firestore
- **Statische Sudoku-Daten:** `tools/puzzles.json`

## Lokales Starten des Projekts

Im Ordner `02_mobileapp`:

```bash
npm install
npm run dev
```

Fuer einen produktionsnahen Build:

```bash
npm run build
```

Das erzeugte Ergebnis wird im Ordner `www/` abgelegt.

## Hinweis

Das Projektverzeichnis wurde fuer die Abgabe bereinigt. Nicht benoetigte Framework7-Beispieldateien und offensichtlicher Debug-Code wurden entfernt, damit die Struktur klarer und der relevante Sudoku-Code leichter nachvollziehbar ist.
