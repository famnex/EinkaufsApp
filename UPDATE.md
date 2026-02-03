# Update-System Dokumentation

## Aktuelle Version: v0.10.5

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
