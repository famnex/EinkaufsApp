# Projekt-Zusammenfassung & Änderungen (Multi-User & Customization)

Dieses Dokument dient als Gedächtnisstütze für alle wesentlichen Änderungen, die bei der Umstellung auf das Multi-User-System und die Kochbuch-Personalisierung vorgenommen wurden.

## 1. Architektur-Entscheidungen

### Daten-Isolation
- Jede Tabelle (außer System-Einstellungen) hat nun ein `UserId`-Feld.
- Die API-Routen in `server/src/routes/` nutzen konsequent das `auth`-Middleware, um `req.user.id` für alle DB-Operationen zu verwenden.
- Dateiuploads werden nun isoliert unter `/public/uploads/users/:userId/` gespeichert.

### Sicheres Teilen (Secure Sharing)
- Anstatt IDs zu verwenden, die erratbar sind (z.B. `/shared/recipe/5`), verwenden wir nun einen zufälligen `sharingKey` des Benutzers in der URL: `/shared/:sharingKey/recipe/:id`.
- Dies ermöglicht es Benutzern, den Zugriff auf ihr gesamtes Kochbuch mit einem Klick zu entziehen (durch Regenerieren des Keys).

## 2. Implementierte Features

### Kochbuch-Personalisierung
- **Titel & Bild**: Benutzer können in den Einstellungen einen eigenen Namen für ihr Kochbuch und ein Titelbild festlegen.
- **SSR (Server Side Rendering)**: Das Backend (`server/index.js`) injiziert nun dynamisch Open-Graph-Tags (Titel, Bild, Beschreibung) in das HTML, damit beim Teilen des Links eine schöne Vorschau erscheint.

### Fehlerbehandlung
- **Deutsche Fehlerseite**: Ein neues `SharedNotFound.jsx` Component zeigt hilfreiche Meldungen an, wenn ein Link ungültig ist.
- **SSR-Error-Fallback**: Falls ein Link ungültig ist, rendert der Server bereits ein statisches HTML mit Fehlermeldung, bevor die React-App geladen wird.

## 3. Wichtige Dateien

- **Modelle**: `server/src/models/index.js` (Associations & Fields).
- **Routes**:
  - `auth.js`: `/me` (Profil-Sync), `/profile` (Update Titel/Bild), `/regenerate-sharing-key`.
  - `recipes.js`: `/public/:sharingKey` (Öffentlicher Zugriff).
- **Frontend**:
  - `Settings.jsx`: Neues Design für Profil & Freigabe.
  - `SharedCookbook.jsx` & `SharedRecipe.jsx`: Dynamische Inhalte basierend auf `cookbookInfo`.
  - `AuthContext.jsx`: Synchronisiert den Benutzer-Status beim App-Start mit dem Server.

## 4. Nächste Schritte (Referenz)
- Bei neuen Features immer darauf achten, das `UserId`-Feld mitzuführen.
- Bei Änderungen an der DB-Struktur immer `db.md` aktualisieren.
