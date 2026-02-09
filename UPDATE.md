# Update-System Dokumentation

## Aktuelle Version: v0.22.0

### Changelog v0.22.0
- **Feature (Admin):** Erweiterte Benutzerverwaltung in den Einstellungen. 👥⚙️
- **Feature (Admin):** Einführung von Abo-Stufen (Plastikgabel bis Rainbowspoon) und AI-Credits. 🍴🌈✨
- **Feature (Admin):** Neues Benutzer-Detail-Modal mit Tabs für Profil, Haushalt, Kochbuch, Integration und Abo/Credits. 📋💎
- **Feature (Admin):** Manuelles Buchungssystem für AI-Credits inkl. Transaktions-Historie. 💰📈
- **Fix (PWA):** Beseitigung von Bildschirm-Flackern auf iOS durch optimierte Zoom-Prävention (Debouncing & Scale-aware Reset). 📱🚫✨
- **DB:** Migration v0.22.0 ausgeführt (Tiers, Credits, Transactions). 🗄️✅

### Changelog v0.21.5
- **Fix (Alexa):** Fehler in der Authentifizierung behoben (Missing User Import). Alexa-Anfragen funktionieren nun wieder korrekt. 🗣️🔐

### Changelog v0.21.4
- **Fix (PWA):** Robustere Service Worker Strategie ("Network First" für Navigation) - verhindert leere Seiten nach App-Updates. 🔄🌐
- **Fix (PWA):** Automatisches Caching von statischen Assets (JS/CSS) für Offline-Modus verbessert. 📦📡
- **Feature (Settings):** Button "App-Cache leeren & neu laden" hinzugefügt - ermöglicht manuelles Zurücksetzen der PWA bei Problemen. 🧹✨
- **UX (Zoom):** Umfassende Zoom-Sperre implementiert: Pinch-to-zoom blockiert, Double-tap Zoom deaktivert und automatischer Scale-Reset bei Rotation/Resize (iOS). 📱🚫🔍
- **UX (Native-Feel):** Native Browser-Effekte (Tap-Highlight, Callouts) deaktiviert für ein echtes App-Gefühl. ⚡📱

### Changelog v0.21.3
- **Performance (Recipes):** Drastische Ladezeit-Verbesserung für Rezeptliste. Backend-Query optimiert - lädt nur Basis-Daten statt aller Ingredients. Ladezeit von ~4s auf <1s reduziert. ⚡🚀
- **Performance (Recipes):** Lazy Loading für Rezeptbilder implementiert - Bilder werden erst geladen, wenn sie im Viewport sichtbar sind. 🖼️📱
- **Performance (Cookbook):** Gleiche Optimierungen auch für Shared Cookbook angewendet. 🌐⚡
- **Feature (Recipes):** Neue Kategorie "Ohne Bilder" im Kategorienfilter - zeigt nur Rezepte ohne Bilder an. Perfekt um zu sehen, welche Rezepte noch Bilder benötigen. 🔍📷
- **Fix (Cooking Mode):** Kochmodus lädt jetzt vollständige Rezeptdaten (inkl. Ingredients) nach, wenn er geöffnet wird. Broken durch Performance-Optimierung, jetzt gefixt. 👨‍🍳✅
- **Improvement (UI):** Gestaffelte Animation (0.05s delay) beibehalten für visuell ansprechenden Rezept-Aufbau. ✨

### Changelog v0.21.2
- **Feature (Recipes):** "Bearbeiten"-Option zum Rezept-Aktionsmenü hinzugefügt. Rezepte können nun direkt aus der Übersicht heraus bearbeitet werden. 📝✏️
- **Feature (AI Cleanup):** Neue Tab "Doppelte Einträge" im AI Cleanup Modal. KI-powered Duplikatserkennung identifiziert identische Produkte mit unterschiedlichen Schreibweisen (z.B. "Gemüsebrühe" ↔ "Gemüsebouillon"). 🤖🔍
- **Feature (AI Cleanup):** Ein-Klick-Merge für doppelte Produkte mit Konfidenz-Bewertung und automatischer Synonym-Verwaltung. ⚡🔗
- **Fix (Products):** "AI NEU" und "ALEXA" Badges aus der Produktliste entfernt, rein alphabetische Sortierung wiederhergestellt. 🏷️❌
- **Fix (Recipes):** Korrektur des AI-Bildgenerierungs-Pfads - generierte Bilder werden jetzt korrekt angezeigt (404-Fehler behoben). 🖼️✅
- **Fix (Products):** Foreign Key Constraint Fehler beim Zusammenführen von Produkten behoben. Migration von ProductSubstitution-Referenzen hinzugefügt. 🔧🗄️
- **Improvement (AI):** Präzisierter ChatGPT-Prompt für Duplikatserkennung - unterscheidet jetzt klar zwischen echten Duplikaten und Substitutionen. 🎯

### Changelog v0.18.5
- **Fix (Recipes):** Fehlerbehebung beim Löschen von Rezeptbildern. Durch Klicken auf "Weg" wird das Bild nun zuverlässig entfernt und der Status auf `none` gesetzt. 🖼️🗑️
- **Refactor (Server):** Erweiterung des `imageSource` ENUMs um den Wert `none`.

### Changelog v0.18.4
- **Debug (Server):** Erweiterte Pfad-Erkennung für `regenerate-image`. Prüft nun mehrere mögliche Speicherorte (`public/`, `server/public/`), um Bilder auch in komplexen Deployment-Strukturen (wie Uberspace) zuverlässig zu finden. Inklusive detailliertem Logging zur Fehleranalyse. 🕵️‍♂️📂

### Changelog v0.18.3
- **Fix (Server):** Fehlerbehebung für `500 Internal Server Error` beim Regenerieren von Bildern (`regenerate-image`). Der Server liest Bilder nun direkt vom Dateisystem, statt sie über HTTP anzufragen. 🖼️🛠️
- **Fix (Recipes):** Neue Rezepte ohne Bild erhalten nun korrekt den Status `imageSource: 'none'` (statt fälschlich `scraped`). Bestehende Rezepte werden beim Update automatisch korrigiert. 🐛✨

### Changelog v0.17.9
- **Hotfix (Dependency):** Korrigiert die `package.json` Abhängigkeiten. `sharp` wurde entfernt und `jimp` korrekt hinzugefügt. (Der vorherige Auto-Mechanismus hatte die Datei zu früh committet). 📦🔧

### Changelog v0.17.8
- **Refactor (Server):** Wechsel von `sharp` zu **`jimp`** für die Bildoptimierung. `jimp` ist 100% JavaScript und benötigt keine nativen Linux-Bibliotheken, was die Kompatibilität mit Uberspace/Shared Hosting sicherstellt. Bilder werden weiterhin auf max. 800px Höhe verkleinert und komprimiert. 🖼️🔄

### Changelog v0.17.7
- **Hotfix (Server):** Behebt einen Absturz (`ERR_DLOPEN_FAILED`) auf Linux-Servern mit älteren Systembibliotheken, indem `sharp` optional geladen wird. Bildoptimierung wird übersprungen, falls das Modul fehlt. 🛠️🐧

### Changelog v0.17.6
- **Feature (Shared Cookbook):** Rebranding zu **"THECOOKINGGUYS"** mit neuem Logo und angepasstem Hero-Design. 👨‍🍳🔥
- **Feature (Shared Cookbook):** Integration von **"Zufalls-Roulette"** ("Auf gut Glück") im gleichen Design wie auf der Rezept-Seite. 🎲 amber-rose Gradient.
- **Feature (Mobile UI):** Rezept-Roulette Button auf der Rezept-Seite (`/recipes`) für Mobile optimiert (Icon-only, vergrößert). 📱✨
- **Feature (Sharing):** Neuer **Share-Button** auf der Rezept-Seite, nutzt das native Teilen-Menü (WhatsApp, etc.) auf Handys. 🔗📲
- **Feature (Cooking Mode):** Der AI Assistant Button respektiert nun die **Safe Area** (Notch) auf iOS-Geräten. 🍎📐
- **Feature (Produkte):** "Alexa" und "AI Neu" Badges lassen sich nun mit einem **einzelnen Tap** entfernen ("Als gelesen markieren"). 🏷️👆❌

### Changelog v0.17.5
- **Feature (Roulette Royale):** Neues Rezept-Glücksrad mit flüssiger Reel-Animation und Casino-Soundkulisse (Gedudel & Jackpot). 🎰🔊✨
- **Feature (Roulette Royale):** Intelligentes Filter-System mit Tag-Eingabe und Live-Produktvorschlägen. 🏷️🔍
- **Feature (Roulette Royale):** Direkte Anbindung an den Menüplaner über den "Rezept einplanen" Button. 📅🥘
- **Fix (AI Assistant):** Robuster Audio-Fix für iOS PWA (Warming-Strategie). Der Assistent spricht nun zuverlässig auch auf iPhones. 📱🔇➡️🔊
- **Fix (UI/UX):** Fehlerbehebung für den "Schwarzer Bildschirm" Bug im Roulette und fehlende Icons. 🛠️✨

### Changelog v0.17.0
- **Feature (AI Assistant):** Neuer freihändiger **Gesprächsmodus**. Das Mikrofon reaktiviert sich automatisch nach Antworten. Beenden per Sprache ("Danke", "Alles klar"). 🎙️👩‍🍳
- **Feature (AI Assistant):** Upgrade auf **OpenAI Premium TTS** (Streaming). Die Stimme ist jetzt natürlich, menschlich und antwortet ohne spürbare Verzögerung. ⚡🔊
- **Feature (AI Assistant):** Intelligente Transliteration. Abkürzungen (EL, g, Min) und Brüche werden nun korrekt ausgesprochen. 🗣️📖
- **Feature (AI Assistant):** Präzisere Antworten. Die KI gibt nun exakte Zeiten und Mengenempfehlungen bei Anpassungen. ⚖️⏲️
- **Feature (Shared Cookbook):** Interaktive Hashtags. Rezepte können nun durch Klick auf Tags direkt in der Übersicht gefiltert werden. 🏷️🔍
- **Feature (Shared Cookbook):** Integrierter **Day/Night Mode**. Design-Umschalter direkt im Header (Sonne/Mond). ☀️🌙
- **Feature (UI/UX):** AI Assistant FAB auf Mobilgeräten um 40px nach unten versetzt, um Overlap zu vermeiden. 📱🛠️
- **Fix (Shared Cookbook):** Korrekte Pfade für Asset-Hintergründe (`pattern.svg`) in Unterverzeichnissen. 🖼️

### Changelog v0.16.2
- **Hotfix (Database):** Zusätzliche Migration (`is_eating_out`) hinzugefügt, um 500er Fehler im Menüplan zu beheben. 🐛🗄️
- **Logging:** Detaillierte Fehler-Logs für die Menü-API aktiviert. 📜
- **Build:** Warnung bezüglich `pattern.svg` im Shared Cookbook behoben. 🖼️

### Changelog v0.16.1
- **Hotfix (Frontend):** Korrektur der Service Worker Registrierung und Logout-Weiterleitung in Unterverzeichnissen (z.B. `/EinkaufsApp/`). 🛠️🌐
- **Maintenance:** Datenbank-Migration (`0.16.0` Fix) verifiziert. ✅

### Changelog v0.16.0
- **Feature (Product Management):** Neue "Neu"-Badges für Produkte, die über Alexa (Blau) oder AI (Lila) hinzugefügt wurden. ✨🏷️
- **Feature (Product Management):** Neue Produkte werden nun oben in der Liste sortiert, um sie schneller zu finden. ⬆️
- **Logic (Normalization):** Verbesserte Erkennung von deutschen Produktnamen (Singular/Plural) für Alexa und AI-Importe, um Duplikate zu vermeiden. 🇩🇪🧠
- **Feature (System):** System-Update zeigt nun die aktuelle Version dynamisch an. ℹ️
- **Fix (UX):** Robustere Swipe-Gesten im Menüplaner und Dashboard-Kalender. 📱👆
- **Fix (Cooking Mode):** Scroll-Sprünge behoben und wischbare Schritt-Navigation hinzugefügt. 🍳📖

### Changelog v0.14.3
- **Bugfix (API):** Fix für "Es gibt undefined". Rezepte verwenden das Feld `title` statt `name`. 🐛🍳

### Changelog v0.14.2
- **Maintenance:** Update Trigger für Server-Sync. 🔄

### Changelog v0.14.1
- **Bugfix (Build):** `server/logs` aus Git entfernt, um Update-Konflikte zu vermeiden. 🚫📁
- **Info:** Falls das Update fehlschlägt, bitte auf dem Server einmalig `git checkout server/logs/alexa.jsonl` ausführen.

### Changelog v0.14.0
- **Feature (API):** Alexa Menü-Abfrage (`/api/alexa/menu`) hinzugefügt. Alexa kann nun fragen: "Was gibt es heute zum Mittag?" 🍽️
- **Logic:** Unterstützt "heute", "morgen" und Datumsangaben sowie verschiedene Mahlzeitentypen.

### Changelog v0.13.4
- **Bugfix (API):** Logging-Integration in Alexa-Route korrigiert. 🐛 Logs werden nun korrekt geschrieben.

### Changelog v0.13.3
- **Feature (Admin):** Alexa API Logs (`Alexa Logs`) in den Einstellungen hinzugefügt. Ermöglicht die Einsicht in Auth-Versuche, Requests und Fehler der Alexa-Schnittstelle. 📜
- **Improv:** Logs werden in `server/logs/alexa.jsonl` gespeichert und über das Admin-Interface visualisiert.

### Changelog v0.13.2
- **Feature (API):** Alexa API Endpoint (`/api/alexa/add`) implementiert. Ermöglicht das Hinzufügen von Produkten per Alexa Skill. 🗣️🛒
- **Logic (API):** Automatische Title-Case-Formatierung für Produkte und Einheiten via Alexa (z.B. "frische milch" -> "Frische Milch").

### Changelog v0.13.1
- **Feature (Admin):** Alexa API Key Generierung in den Einstellungen hinzugefügt. 🗣️🔑

### Changelog v0.13.0
- **Feature (Offline):** Vollständige Offline-Synchronisation. Änderungen an der Einkaufsliste werden bei schlechtem Empfang lokal zwischengespeichert und automatisch synchronisiert, sobald wieder Netz da ist. 🌩️🔄
- **Feature (UX):** Optimistic UI in der Listenansicht. Häkchen werden sofort gesetzt, auch ohne Server-Bestätigung, für ein blitzschnelles App-Gefühl.
- **Feature (UI):** Neue "Sync-Bubble" im Header zeigt ausstehende Änderungen und den Verbindungsstatus (Offline-Warnung) an. ✨☁️

### Changelog v0.12.7
- **Optimization (UX):** Pull-To-Refresh Prozess optisch aufgewertet. Während die Seite neu lädt, erscheint nun ein eleganter, halbtransparenter Blur-Overlay mit einer hüpfenden Einkaufstaschen-Animation. ✨🛍️

### Changelog v0.12.6
- **Feature (System):** Update-Prozess UI komplett überarbeitet. Inklusive Fortschrittsbalken, Phasen-Anzeige und einklappbaren System-Logs für eine sauberere Benutzererfahrung.

### Changelog v0.12.5
- **Optimization (Print):** Robuste Erzwingung des hellen Modus beim Drucken von Rezepten (per Event-Listener). Ein dunkler Hintergrund im Druck ist nun ausgeschlossen.
- **Feature (UX):** Pull-To-Refresh Funktionalität für die gesamte App hinzugefügt (Seite nach unten ziehen zum Aktualisieren).

### Changelog v0.12.4
- **Fix (System):** ANSI-Escape-Codes werden nun in den Update-Logs gefiltert (keine kryptischen Zeichen mehr im Web-Terminal).
- **Optimization (UX):** Geteilte Rezepte unterstützen nun die Safe Area (Notch/Dynamic Island).
- **Optimization (UX):** Zurück-Button zur geteilten Rezeptansicht hinzugefügt.
- **Fix (Print):** Beim Drucken von geteilten Rezepten wird nun immer der helle Modus erzwungen (kein schwarzer Hintergrund im Druck).

### Changelog v0.12.3
- **Feature (System):** Code-Fallback in der Update-Routine (`update.js`) implementiert. Bei Fehlern wird nun nicht nur die DB, sondern auch der Code-Stand per Git zurückgesetzt.
- **Feature (Recipes):** "Drucken"-Option im Rezept-Menü hinzugefügt, die direkt die optimierte Shared-Ansicht öffnet.

### Changelog v0.12.2

### Changelog v0.12.1
- **Fix (UX):** Swipe-Navigation im Menüplan wird nun unterdrückt, wenn ein Modal (Mahlzeiten-Selektor, Zutaten-Planer) oder der Koch-Modus offen ist.
- **Fix (UX):** Textmarkierung (Browser-Highlight) bei langem Tastendruck in der Einkaufsliste deaktiviert für ein nativeres App-Gefühl.
- **Fix (UX):** Korrektur der Logo-Pfade von Geschäften in der Einkaufsliste bei Verwendung in Unterordnern (Subdirectory Hosting).

### Changelog v0.12.0
- **Feature (Sharing):** Server-Side Rendering (SSR) für geteilte Rezepte implementiert. Dynamische Open Graph Meta-Tags (Bild & Titel) werden nun für WhatsApp-Previews und andere soziale Medien korrekt generiert.
- **Feature (Sharing):** Pfad-Korrektur für geteilte Links bei Hosting in Unterverzeichnissen (z.B. `/EinkaufsApp/`).
- **Feature (UI):** Premium Mobile-Optimierung für den Zutatenplaner: Ergonomische Touch-Elemente, Card-Layout auf kleinen Screens und verbesserte Footer-Buttons.
- **Feature (UI):** Optimiertes Drucklayout für Rezepte: Zwei-Spalten-Layout mit Bild-Ausrichtung und verbessertem Padding für Zutaten.
- **Feature (Database):** Unterstützung für Produkt-Substitutionen: Ersetzung von Produkten bleibt nun permanent gespeichert.
- **Feature (Database):** Notiz-Feld für Produkte hinzugefügt.
- **Database Migration:** Neue Tabelle `ProductSubstitutions` und Spalte `Products.note`.

### Changelog v0.11.2
- **Fix:** Settings UI Verbesserungen & AI Lookup Unit Fix.

### Changelog v0.11.1
- **Fix:** AI Cleanup Logik & Syntax-Fehler in ai.js korrigiert.

### Changelog v0.11.0
- **Feature:** AI Cleanup Context Hiding, Mobile Fixes, Menüplan Navigation.
- **Database:** HiddenCleanup Migration.

### Changelog v0.10.6
- **Fix:** Globales Header-Layout fix: PWA Safe-Area Padding für alle Seiten aktiviert (Notch/Island Überlappung behoben).

### Changelog v0.10.5
- **Fix:** Aggressiveres Safe-Area Padding für PWA auf iOS Devices (verhindert Überlappung mit Dynamic Island/Notch).

### Changelog v0.10.4
- **Database Fix:** `RecipeTags`-Tabelle repariert. Speichern von mehreren Tags pro Rezept funktioniert nun korrekt (Unique-Constraint korrigiert).

### Changelog v0.10.3
- **Hotfix:** Pfad-Fehler im Migrations-Skript v0.10.2 korrigiert (`MODULE_NOT_FOUND`).

### Changelog v0.10.2
- **Fix (UI):** Cooking Mode Header auf Mobile sticky & Safe-Area optimiert (PWA fix).
- **Fix (AI):** AI Import Bild-Overlay UX verbessert & Loading-Spinner hinzugefügt.
- **Fix (AI):** Robustere Tag-Initialisierung beim AI Import.

### Changelog v0.10.1
- **Fix:** Cooking Mode Layout auf kleinen Bildschirmen korrigiert (überlappende Buttons).

### Changelog v0.10.0
- **Responsive List Stats:** Kategorie-Statistiken statt Gesamtpreis, optimiert für Mobile.
- **Detail View:** Verbessertes Design auf kleinen Screens (Wasserzeichen-Icon).
- **PWA Fixes:** Korrekter Start-URL und Scope.
- **Backend:** `CurrentStoreId` für Listen, Smart Sorting Basis (ProductRelations) und erweiterte ListItems (unit, bought_at).


## Übersicht

Die EinkaufsApp verfügt über ein vollautomatisches Update-System mit Web-Interface und automatischer Datenbank-Migration.

## Komponenten

### 1. Frontend (Settings-Seite)
**Pfad:** `/settings` (nur für Admins)

**Features:**
- **Update-Check**: Prüft ob neue Commits auf `origin/main` verfügbar sind
- **Update-Button**: Startet Update-Prozess mit Live-Logs
- **UpdateModal**: Terminal-ähnliche Anzeige des Update-Fortschritts

### 2. Backend API
**Pfad:** `server/src/routes/system.js`

**Endpoints:**
- `GET /api/system/check` - Prüft auf verfügbare Updates
- `GET /api/system/stream-update` - Führt Update aus und streamt Logs

### 3. Update-Skript
**Pfad:** `update.js` (Projekt-Root)

**Funktion:**
- Erstellt automatisches Backup
- Findet und führt Migrationen aus (`server/migrations/*.js`)
- Räumt alte Backups auf (behält 10 neueste)
- Fehlerbehandlung mit Rollback

## Update-Ablauf

### Über Web-Interface (empfohlen)

1. **Admin** öffnet `/settings`
2. Klickt auf **"Update suchen"**
3. System zeigt verfügbare Updates an
4. Klickt auf **"Update starten"**
5. UpdateModal öffnet sich mit Live-Terminal
6. System führt automatisch aus:
   - Git Pull
   - npm install (server + client)
   - Client Build
   - **Datenbank-Migration** (`node update.js`)
   - Service Restart
7. Modal zeigt "Update Complete" → App neu laden

### Manuell via SSH (alternativ)

```bash
cd /pfad/zu/listenuebersicht
git pull
node update.js
systemctl --user restart einkaufsliste
```

## Uberspace-spezifische Konfiguration

### Restart-Command

Das Update-System verwendet die Umgebungsvariable `RESTART_COMMAND`:

```bash
# In .env oder Environment setzen:
RESTART_COMMAND="systemctl --user restart einkaufsliste"
```

**Standard:** `supervectorctl restart einkaufsliste`  
**Uberspace 9:** `systemctl --user restart einkaufsliste`

### Service-Setup auf Uberspace

```bash
# 1. Service-Datei erstellen
nano ~/.config/systemd/user/einkaufsliste.service
```

```ini
[Unit]
Description=EinkaufsApp Node.js Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/username/einkaufsapp
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=default.target
```

```bash
# 2. Service aktivieren
systemctl --user enable einkaufsliste
systemctl --user start einkaufsliste

# 3. Status prüfen
systemctl --user status einkaufsliste

# 4. Logs ansehen
journalctl --user -u einkaufsliste -f
```

## Migrations-System

### Migration erstellen

```bash
# 1. Neue Migration in server/migrations/ erstellen
touch server/migrations/migrate_v0.11.0.js
```

```javascript
// server/migrations/migrate_v0.11.0.js
const { sequelize } = require('../src/models');

async function checkColumnExists(tableName, columnName) {
    const result = await sequelize.query(
        `PRAGMA table_info(${tableName})`,
        { type: sequelize.QueryTypes.SELECT }
    );
    return result.some(col => col.name === columnName);
}

async function migrate() {
    console.log('=== Migration v0.11.0 Starting ===\n');
    
    try {
        // Deine Änderungen hier
        if (!(await checkColumnExists('Products', 'barcode'))) {
            console.log('Adding column: Products.barcode...');
            await sequelize.query('ALTER TABLE Products ADD COLUMN barcode VARCHAR(255);');
            console.log('✓ Added Products.barcode\n');
        } else {
            console.log('✓ Column Products.barcode already exists\n');
        }
        
        console.log('=== Migration v0.11.0 Completed Successfully ===');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
```

### Wichtig für Migrationen

**Namensschema:** `migrate_v{VERSION}.js` (alphabetisch sortiert)

**Best Practices:**
- ✅ Immer Existenz-Checks (idempotent)
- ✅ Klare Console-Logs
- ✅ Fehlerbehandlung mit `process.exit(1)`
- ✅ Erfolg mit `process.exit(0)`
- ❌ NIEMALS Daten löschen ohne Backup

## Sicherheit & Backup

### Automatische Backups

Bei jedem Update wird automatisch ein Backup erstellt:
```
server/backups/database_2026-02-03T18-27-00.sqlite
```

Die letzten **10 Backups** werden automatisch behalten, ältere werden gelöscht.

### Manuelles Backup

```bash
# Vor kritischen Änderungen:
cp server/database.sqlite server/database_backup_manual_$(date +%Y%m%d).sqlite
```

### Rollback

#### Automatischer Rollback
Wenn eine Migration fehlschlägt, versucht `update.js` automatisch das Backup wiederherzustellen.

#### Manueller Rollback

```bash
# 1. Server stoppen
systemctl --user stop einkaufsliste

# 2. Backup auflisten
ls -la server/backups/

# 3. Gewünschtes Backup wiederherstellen
cp server/backups/database_2026-02-03T18-27-00.sqlite server/database.sqlite

# 4. Zur vorherigen Version zurück
git checkout v0.9.17

# 5. Server starten
systemctl --user start einkaufsliste
```

## Fehlerbehandlung

### UpdateModal zeigt Fehler

**Problem:** Update schlägt fehl  
**Lösung:** 
1. Logs im Modal lesen
2. SSH verbinden und Logs prüfen: `journalctl --user -u einkaufsliste -n 50`
3. Fehler beheben
4. "Retry Update" klicken

### Server startet nach Update nicht

**Problem:** Service läuft nicht  
**Lösung:**
```bash
systemctl --user status einkaufsliste
journalctl --user -u einkaufsliste -n 100
# Fehler beheben, dann:
systemctl --user restart einkaufsliste
```

### Migration fehlgeschlagen

**Problem:** DB-Migration bricht ab  
**Lösung:**
```bash
# 1. Logs prüfen
less server/backups/migration.log

# 2. Backup wiederherstellen (siehe oben)

# 3. Migration manuell debuggen
node server/migrations/migrate_v0.10.0.js
```

## Development vs Production

### Development (localhost)
```bash
# Änderungen committen
git add .
git commit -m "Feature X"
git push

# KEIN automatisches Update nötig
npm run dev  # Hot-reload
```

### Production (Uberspace)
```bash
# SSH zum Server
ssh username@server.uberspace.de

# Web-Interface verwenden ODER manuell:
cd ~/einkaufsapp
git pull
node update.js
systemctl --user restart einkaufsliste
```

## Troubleshooting

| Problem | Ursache | Lösung |
|---------|---------|--------|
| "git pull" schlägt fehl | Lokale Änderungen auf Server | `git stash && git pull` |
| "npm install" schlägt fehl | Netzwerk-Timeout | Erneut versuchen |
| Migration hängt | DB ist locked | Server stoppen, Migration erneut |
| Service startet nicht | Port bereits belegt | Anderen Prozess killen |
| UpdateModal "Waiting..." | RESTART_COMMAND falsch | `.env` prüfen |

## Best Practices

1. **Immer testen:** Migrations lokal testen bevor pushen
2. **Backups prüfen:** Vor großen Updates manuelles Backup
3. **Versionierung:** Semantic Versioning nutzen (`v0.10.0`)
4. **Dokumentation:** Änderungen im Commit-Message dokumentieren
5. **Monitoring:** Logs nach Update prüfen

```bash
# Nach Update immer Logs checken:
journalctl --user -u einkaufsliste -f
```

## Weiterführende Links

- [Uberspace Systemd Guide](https://manual.uberspace.de/daemons-supervisord/)
- [Node.js Production Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
