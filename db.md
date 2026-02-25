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
- `aiCredits` (DECIMAL): Aktuelles AI-Guthaben.
- `subscriptionStatus` (ENUM): 'active', 'canceled', 'past_due', 'none' [NEW v0.26.7].
- `subscriptionExpiresAt` (DATE): Ablaufdatum des Abos [NEW v0.26.7].
- `cancelAtPeriodEnd` (BOOLEAN): Ob das Abo zum Ende der Laufzeit gekündigt wurde [NEW v0.26.7].
- `stripeCustomerId` (STRING): Stripe Kunden-ID [NEW v0.26.7].
- `stripeSubscriptionId` (STRING): Stripe Abo-ID [NEW v0.26.7].
- `paypalSubscriptionId` (STRING): PayPal Abo-ID (ENTFERNT v0.28.10)
- `lastRefillAt` (DATE): Timestamp of last monthly AI credit refill [NEW v0.26.7].
- `pendingTier` (ENUM): 'Silbergabel', 'none' - Scheduled downgrade [NEW v0.26.8].
- `newsletterSignedUp` (BOOLEAN): Newsletter-Status [NEW v0.24.1].
- `newsletterSignupDate` (DATE): Datum der Newsletter-Anmeldung [NEW v0.24.1].
- `isEmailVerified` (BOOLEAN): Status der E-Mail-Bestätigung [NEW v0.29.0].
- `emailVerificationToken` (STRING): Token für E-Mail-Aktivierung [NEW v0.29.0].
- `pendingEmail` (STRING): Temporäre Speicherung bei E-Mail-Änderung [NEW v0.29.0].
- `bannedAt` (DATETIME, NULLABLE): Wenn gesetzt, ist das öffentliche Kochbuch gesperrt.

### `CreditTransactions` [NEW]
Aufzeichnung aller AI-Guthaben-Bewegungen.
- `id` (INT, PK)
- `UserId` (INT, FK): Bezug zum Benutzer.
- `delta` (DECIMAL): Betrag der Änderung (+/-).
- `description` (STRING): Grund der Buchung.
- `createdAt` / `updatedAt` (DATE)

### `SubscriptionLogs` [NEW v0.26.9]
Protokollierung aller Abonnements-bezogenen Aktivitäten.
- `id` (INT, PK)
- `UserId` (INT, FK)
- `username` (STRING): Denormalisiert für schnelle Log-Suche.
- `event` (STRING): z.B. 'checkout_completed', 'subscription_canceled_user', etc.
- `tier` (STRING): Betroffener Plan.
- `amount` / `currency` (DECIMAL/STRING)
- `details` (TEXT): JSON-Details oder Fehlermeldungen.
- `ipHash` / `userAgent` (STRING)
- `createdAt` (DATE)

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

7.  **Subscription Refinements (v0.26.8)**: `node server/migrations/migrate_v0.26.8_subscription_refines.js`
    - Neue Spalte `pendingTier` in `Users`.
    - Logik für verzögerte Kündigung und Downgrade.

8.  **Logging Expansion (v0.26.9)**: `node server/migrations/migrate_v0.26.9_logging_expansion.js`
    - Neue Tabelle `SubscriptionLogs`.
    - Erweiterung der Log-Suche im Admin-Bereich (Login, Abo, Credits).

9.  **Email Verification (v0.29.0)**: `node server/migrations/migrate_v0.29.0_email_verification.js`
    - Fügt `isEmailVerified`, `emailVerificationToken` und `pendingEmail` Spalten zu `Users` hinzu.
    - Setzt `isEmailVerified` für bestehende User standardmäßig auf `true`.

10. **Debug Logging (v0.29.6)**:
    - Einführung der globalen Einstellung `system_debug_mode` in der `Settings` Tabelle.
    - Implementierung einer umfassenden Request- und Fehler-Protokollierung in `logs/system.log`.

---
*Diese Dokumentation dient als Basis für zukünftige DB-Update-Scripts.*

### v0.30.0 - Comprehensive System Observability (Februar 2026)
1. **Request Logging**: Alle Anfragen werden nun mit Methode, URL, Status-Code und Dauer protokolliert.
2. **Error Handling**: Implementierung eines globalen Error-Handlers und Prozess-Limitern (Uncaught Exceptions), die alle Fehler lückenlos in `system.log` schreiben.
3. **Log-Überholung**: Umstellung fast aller Routen von `console.error` auf `logError`, um sicherzustellen, dass Fehler nicht nur in der Konsole, sondern auch in der Log-Datei landen.
4. **Log-Level**: `INFO`, `WARN` und `ERROR` werden nun immer protokolliert, nur `DEBUG` ist optional.
