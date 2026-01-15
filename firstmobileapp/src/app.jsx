// React/Preact Hooks importieren:
// useState  → speichert Zustand (State)
// useEffect → führt Code bei Änderungen aus
import { useEffect, useState } from "preact/hooks";

// Haupt-Komponente der App
export function App() {
  // Aktiver Tab: "home" oder "notes"
  const [tab, setTab] = useState("home");

  return (
    // Grundlayout + Schrift
    <div style={{ padding: 20, fontFamily: "system-ui" }}>

      {/* ---------- TAB-LEISTE ---------- */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>

        {/* Home-Tab */}
        <button
          onClick={() => setTab("home")} // wechselt zum Home-Tab
          style={{
            padding: "8px 12px",
            fontWeight: tab === "home" ? "700" : "400", // aktiver Tab fett
          }}
          title="Hier geht es zur ersten Seite, der Homepage"
        >
          Home
        </button>

        {/* Mini-Projekt-Tab */}
        <button
          onClick={() => setTab("notes")} // wechselt zum Notizen-Tab
          style={{
            padding: "8px 12px",
            fontWeight: tab === "notes" ? "700" : "400",
          }}
          title="Hier werden die Projektideen für die Seminararbeit gesammelt"
        >
          Mini-Projekt
        </button>
      </div>

      {/* ---------- TAB-INHALT ---------- */}
      {/* Je nach aktivem Tab wird eine andere Komponente angezeigt */}
      {tab === "home" ? <HomePage /> : <NotesPage />}
    </div>
  );
}

/* =========================
   HOME TAB
   ========================= */
function HomePage() {
  return (
    <div>
      {/* Überschrift */}
      <h1>Meine erste Web-App</h1>

      {/* Beschreibung */}
      <p>Ich lerne gerade Preact Basics.</p>

      {/* Button mit Klick-Event */}
      <button
        onClick={() =>
          alert(
            "Das ist die erste Web App im Rahmen des Moduls W3M20009.1_Development of Mobile Business Applications_WiSe_25-26"
          )
        }
      >
        Infos
      </button>

      {/* Eingabefelder */}
      <div style={{ marginTop: 16, display: "grid", gap: 8, maxWidth: 240 }}>
        <input placeholder="Name" />          {/* Textfeld */}
        <input type="password" placeholder="Passwort" /> {/* Passwortfeld */}
        <input type="number" placeholder="Zahl" />       {/* Zahlenfeld */}
      </div>
    </div>
  );
}

/* =========================
   MINI-PROJEKT: NOTIZEN
   ========================= */
function NotesPage() {
  // Text aus dem Eingabefeld
  const [text, setText] = useState("");

  const [dragIndex, setDragIndex] = useState(null); //Welche Notiz wird gerade gezogen?


  // Liste der Notizen (Initialwert aus localStorage)
  const [notes, setNotes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("notes") || "[]");
    } catch {
      return [];
    }
  });

  // Wird immer ausgeführt, wenn sich "notes" ändert
  // → speichert Notizen im Browser
  useEffect(() => {
    localStorage.setItem("notes", JSON.stringify(notes));
  }, [notes]);

  // Neue Notiz hinzufügen
  function addNote() {
    const t = text.trim(); // Leerzeichen entfernen
    if (!t) return;        // leere Eingaben ignorieren

    // Neue Notiz vorne in die Liste einfügen
    setNotes([{ id: crypto.randomUUID(), text: t }, ...notes]);
    setText(""); // Eingabefeld leeren
  }

  // Notiz anhand der ID löschen
  function deleteNote(id) {
    setNotes(notes.filter((n) => n.id !== id));
  }

  function moveNote(from, to) {
    if (from === to) return;

    const updated = [...notes];          // Kopie erstellen
    const [moved] = updated.splice(from, 1); // Element rausnehmen
    updated.splice(to, 0, moved);        // an neuer Stelle einfügen
    setNotes(updated);                   // neuen State setzen
  }


  return (
    <div>
      {/* Überschrift */}
      <h1>Mini-Projekt: Notizen</h1>

      {/* Beschreibung */}
      <p>
        Notiz eingeben, hinzufügen, löschen — bleibt nach Reload gespeichert.
      </p>

      {/* Eingabefeld + Button */}
      <div style={{ display: "flex", gap: 8, maxWidth: 520 }}>
        <input
          value={text}                          // aktueller Text
          onInput={(e) => setText(e.target.value)} // Text ändern
          placeholder="Deine Notiz…"
          style={{ flex: 1, padding: 10 }}
          onKeyDown={(e) => e.key === "Enter" && addNote()} // Enter = hinzufügen
        />
        <button onClick={addNote} style={{ padding: "10px 14px" }}>
          Hinzufügen
        </button>
      </div>

      {/* Anzahl der Notizen */}
      <p style={{ marginTop: 12 }}>
        Anzahl Notizen: {notes.length}
      </p>

      {/* Falls keine Notizen vorhanden */}
      {notes.length === 0 ? (
        <p>Noch keine Notizen.</p>
      ) : (
        // Liste aller Notizen
        <ul style={{ paddingLeft: 18 }}>
          {notes.map((n, index) => (
            <li
              key={n.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                moveNote(dragIndex, index);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              style={{
                marginBottom: 8,
                padding: 8,
                borderRadius: 6,
                background: dragIndex === index ? "#2a2a2a" : "#1f1f1f",
                color: "#f5f5f5",
                border: "1px solid #333",
              }}

            >
              {n.text}{" "}
              <button onClick={() => deleteNote(n.id)}>löschen</button>
            </li>
          ))}
        </ul>
      )}

      {/* Button zum Löschen aller Notizen */}
      {notes.length > 0 && (
        <button onClick={() => setNotes([])} style={{ marginTop: 12 }}>
          Alle löschen
        </button>
      )}
    </div>
  );
}
