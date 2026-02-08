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

## 3. Migrations-Schritte (für neue Instanzen)

Wenn eine alte Datenbank (vor v0.19.0) auf das Multi-User-System aktualisiert werden soll:

1.  **Backup**: `cp database.sqlite database.sqlite.bak`
2.  **Schema-Update & Migration**: `node server/migrations/migrate_v0.19.0.js`
    - Fügt `UserId` Spalten hinzu.
    - Weist bestehende Daten dem Admin zu.
    - Generiert `sharingKey` für alle User.
    - Fügt `cookbookTitle` und `cookbookImage` Spalten hinzu.

---
*Diese Dokumentation dient als Basis für zukünftige DB-Update-Scripts.*
