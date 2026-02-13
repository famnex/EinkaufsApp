# Datenbank-Dokumentation

Diese Datei dokumentiert die Struktur der SQLite-Datenbank (`database.sqlite`) und die durchgeführten Migrationen für das Multi-User-System.

## 1. Tabellenstruktur (Stand: Februar 2026)

### `Users`
Zentrales Benutzermodell.
- `id` (INT, PK)
- `username` (STRING, Unique)
- `password` (STRING)
- `email` (STRING)
- `role` (ENUM: 'admin', 'user')
- `isLdap` (BOOLEAN)
- `alexaApiKey` (STRING)
- `sharingKey` (STRING, Unique): Key für öffentliche Links.
- `cookbookTitle` (STRING): Benutzerdefinierter Titel des Kochbuchs.
- `cookbookImage` (STRING): Pfad zum Hero-Bild des Kochbuchs.
- `householdId` (INT): ID des gemeinsamen Haushalts (Isolationsebene).
- `tier` (ENUM: 'Plastikgabel', 'Silbergabel', 'Goldgabel', 'Rainbowspoon'): Abonnement-Status.
- `tier` (ENUM: 'Plastikgabel', 'Silbergabel', 'Goldgabel', 'Rainbowspoon'): Abonnement-Status.
- `aiCredits` (DECIMAL): Aktuelles AI-Guthaben.
- `newsletterSignedUp` (BOOLEAN): Newsletter-Status [NEW v0.24.1].
- `newsletterSignupDate` (DATE): Datum der Newsletter-Anmeldung [NEW v0.24.1].
- `bannedAt` (DATETIME, NULLABLE): Wenn gesetzt, ist das öffentliche Kochbuch gesperrt.

### `CreditTransactions` [NEW]
Aufzeichnung aller AI-Guthaben-Bewegungen.
- `id` (INT, PK)
- `UserId` (INT, FK): Bezug zum Benutzer.
- `delta` (DECIMAL): Betrag der Änderung (+/-).
- `description` (STRING): Grund der Buchung.
- `createdAt` / `updatedAt` (DATE)

### `Manufacturers` / `Stores`
- `id` (INT, PK)
- `name` (STRING)
- `UserId` (INT, FK): Eigentümer des Eintrags.

### `Products`
- `id` (INT, PK)
- `name` (STRING)
- `category` (STRING)
- `unit` (ENUM: 'Stück', 'g', 'kg', 'ml', 'l')
- `UserId` (INT, FK)
- `ManufacturerId` / `StoreId` (INT, FK)

### `Lists` / `ListItems`
- Jede Liste und jedes Item gehört einem `UserId`.
- `ListItems` sind über `ListId` und `ProductId` assoziiert.

### `ComplianceReports` [NEW v0.23.8]
- `id` (INT, PK)
- `reporterName` (STRING)
- `reporterEmail` (STRING)
- `reporterRole` (ENUM)
- `contentUrl` (STRING)
- `contentType` (ENUM)
- `reasonCategory` (ENUM)
- `reasonDescription` (TEXT)
- `originalSourceUrl` (STRING)
- `status` (ENUM)
- `resolutionNote` (TEXT)
- `screenshotPath` (STRING) [NEW v0.24.0]

### `ComplianceReports` [NEW v0.23.8]
- `id` (INT, PK)
- `reporterName` (STRING)
- `reporterEmail` (STRING)
- `reporterRole` (ENUM)
- `contentUrl` (STRING)
- `contentType` (ENUM)
- `reasonCategory` (ENUM)
- `reasonDescription` (TEXT)
- `originalSourceUrl` (STRING)
- `status` (ENUM)
- `resolutionNote` (TEXT)
- `screenshotPath` (STRING) [NEW v0.24.0]

### `Recipes` / `RecipeIngredients`
- `sharingKey` der `Users` erlaubt Zugriff auf Rezepte des jeweiligen Users.
- `RecipeIngredients` verknüpft `Recipe` mit `Product` für einen spezifischen `UserId`.

### `Menus` / `Expenses` / `Tags` / `Settings`
- Alle Tabellen enthalten ein `UserId` Feld zur strikten Isolation.

---

## 2. Migrationen & Änderungen

### Multi-User Transformation (v0.19.0 - Februar 2026)
1. **UserId-Integration**: Zu fast allen Tabellen wurde eine `UserId`-Spalte hinzugefügt.
2. **Daten-Migration**: Bestehende Daten wurden dem ersten Administrator zugewiesen.
3. **Isolation**: Alle API-Abfragen wurden auf `where: { UserId: req.user.id }` umgestellt.
4. **Sharing-System**: Einführung von kryptografisch zufälligen `sharingKey`s pro User.
5. **Customization**: Spalten `cookbookTitle` und `cookbookImage` in der `Users` Tabelle hinzugefügt.
6. **URL-Schema**: Umstellung von `/shared/recipe/:id` auf `/shared/:sharingKey/recipe/:id`.

### v0.22.0 - Advanced Management, Branding & Design (Februar 2026)
1. **User Table Update**: Spalten `tier` und `aiCredits` hinzugefügt.
2. **Credit History**: Tabelle `CreditTransactions` für lückenlose Rückverfolgbarkeit von AI-Guthaben eingeführt.
3. **Branding & Rebranding**: Komplette Umstellung auf "GabelGuru" (Name, Logos, PWA-Icons).
4. **Custom Design System**:
    - Einführung globaler Systemeinstellungen (`UserId: NULL`) für Primär- und Sekundärfarben.
    - Dynamische HSL-Berechnung für Kontrastfarben und Akzente.
    - Integration der Sekundärfarbe für unbesorgte Artikel und Kalender-Highlights.

### v0.22.13 - Public Cookbook Toggle (Februar 2026)
1.  **User Privacy**: Neue Spalte `isPublicCookbook` in der `Users` Tabelle.
### v0.22.13 - Public Cookbook Toggle (Februar 2026)
1.  **User Privacy**: Neue Spalte `isPublicCookbook` in der `Users` Tabelle.
2.  **Toggle-Feature**: Ermöglicht Benutzern, ihr Kochbuch öffentlich oder privat zu schalten.

### v0.24.1 - Newsletter & Terms (Februar 2026)
1.  **Newsletter**: Neue Spalten `newsletterSignedUp` und `newsletterSignupDate` in der `Users` Tabelle.

## 3. Migrations-Schritte (für neue Instanzen)

Wenn eine alte Datenbank (vor v0.19.0) auf das Multi-User-System aktualisiert werden soll:

1.  **Backup**: `cp database.sqlite database.sqlite.bak`
2.  **Schema-Update & Migration**: `node server/migrations/migrate_v0.19.0.js`
    - Fügt `UserId` Spalten hinzu.
    - Weist bestehende Daten dem Admin zu.
    - Generiert `sharingKey` für alle User.
    - Fügt `cookbookTitle` und `cookbookImage` Spalten hinzu.

4.  **Admin Update (v0.22.0)**: `node server/migrations/migrate_v0.22.0_user_management.js`
    - Fügt `tier` und `aiCredits` Spalten zu `Users` hinzu.
    - Erstellt die Tabelle `CreditTransactions`.

5.  **Public Cookbook (v0.22.13)**: `node server/migrations/migrate_v0.22.13_public_cookbook.js`
    - Fügt `isPublicCookbook` Spalte zu `Users` hinzu.

6.  **Newsletter (v0.24.1)**: `node server/migrations/migrate_v0.24.1.js`
    - Fügt `newsletterSignedUp` und `newsletterSignupDate` Spalten zu `Users` hinzu.

---
*Diese Dokumentation dient als Basis für zukünftige DB-Update-Scripts.*
