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
- `isPermanentlyBanned` (BOOLEAN)
- `cookbookClicks` (INT): Anzahl der Aufrufe des öffentlichen Kochbuchs/Rezepte [NEW v0.30.15].
- `resetPasswordToken` / `resetPasswordExpires` (STRING/DATE)

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

### `FavoriteRecipes` (Join Table) [NEW v0.30.13]
- Verknüpft `Users` und `Recipes`.
- Ermöglicht es Benutzern, sowohl eigene als auch fremde (Community) Rezepte zu favorisieren.
- Spalten: `UserId`, `RecipeId`, `createdAt`, `updatedAt`
- `isFavorite` (BOOLEAN): Gibt an, ob ein Rezept als Favorit markiert wurde [NEW v0.30.12].

### `PublicVisits` [NEW v0.30.16]
Tracking von anonymisierten Besuchen auf öffentlichen Pfaden zur Unique-Visitor-Zählung.
- `id` (INT, PK)
- `identifierHash` (STRING): SHA-256(IP + täglicher Salt).
- `targetType` ('cookbook' | 'recipe')
- `targetId` (INT): ID des Kochbuchs (Users) oder Rezepts.
- `lastVisitAt` (DATE): Zeitstempel des letzten gezählten Besuchs innerhalb eines Fensters (1 Std).

### `ProductVariants` [NEW]
Zentrale Verwaltung von Produktvarianten (z.B. "Bio", "Vegan", "Laktosefrei").
- `id` (INT, PK)
- `title` (STRING, Unique per User): Der Name der Variante.
- `UserId` (INT, FK)

### `ProductVariations` [NEW]
Spezifische Ausprägung eines Produkts für eine Variante.
- `id` (INT, PK)
- `category` (STRING): Kategorieneinstellung für diese spezifische Variation.
- `unit` (STRING): Standard-Einheit für diese spezifische Variation.
- `ProductId` (INT, FK)
- `ProductVariantId` (INT, FK)
- `UserId` (INT, FK)

### `ListItems` (Erweiterung)
- `ProductVariationId` (INT, FK, NULL): Referenz auf die gewählte Variation beim Hinzufügen zur Liste.

### `Intolerances` [NEW v0.31.9]
Benutzerspezifische Unverträglichkeiten (z.B. "Laktose", "Gluten").
- `id` (INT, PK)
- `name` (STRING): Name der Unverträglichkeit.
- `UserId` (INT, FK)
- `createdAt` / `updatedAt` (DATE)

### `Menus` / `Expenses` / `Tags` / `Settings`
- Alle Tabellen enthalten ein `UserId` Feld zur strikten Isolation.

---

## 2. Migrationen & Änderungen

### v0.31.9 - Produktvarianten (Februar 2026)
1. **Produktvarianten-System**: Einführung der Tabellen `ProductVariants` und `ProductVariations` zur flexiblen Verwaltung von Produkt-Ausprägungen.
2. **Einkaufslisten-Integration**: Erweiterung der `ListItems` um `ProductVariationId`, um die gewählte Variante auf der Liste zu speichern und die sortierung/einheit entsprechend anzupassen.
3. **Smart Sorting Update**: Das Sorting-System nutzt nun prioritär die Kategorie der gewählten Variation. Erweiterung der `ProductRelations` Tabelle um `PredecessorVariationId` und `SuccessorVariationId`.

### v0.31.9 - Unverträglichkeiten (Februar 2026)
1. **Unverträglichkeiten-System**: Einführung der Tabelle `Intolerances` zur Verwaltung benutzerspezifischer Unverträglichkeiten.
2. **Settings-Integration**: Neuer Reiter "Unverträglichkeiten" in den Einstellungen zum Verwalten der Einträge.

### v0.31.8 - Fixing Production Migration (Februar 2026)
... (vorherige Einträge)

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

### v0.30.16 - Unique Visitor Tracking (Februar 2026)
1. **Besucher-Tracking**: Einführung der `PublicVisits` Tabelle.
2. **DSGVO-Compliance**: Umstellung der Klick-Zählung von einfachem Inkrement auf ein systematisches Tracking einzigartiger Besucher (max. 1 Inkrement pro Stunde). Benutzer werden anonym per SHA-256 Hash aus IP-Adresse und einem täglich wechselnden Salt identifiziert.
3. **Analytics**: Sowohl `cookbookClicks` in `Users` als auch `clicks` in `Recipes` verwenden nun diese Throttling-Logik.

### v0.30.15 - Community Sorting & Analytics (Februar 2026)
1. **Kochbuch-Analytics**: Einführung der `cookbookClicks` Spalte in `Users`. Diese wird bei jedem Aufruf eines öffentlichen Rezept-Links oder der Kochbuch-Übersicht inkrementiert.
2. **Community-Sortierung**: Implementierung von Sortieroptionen in der Community-Ansicht nach Rezeptanzahl, Gesamt-Favoriten (Summe aller Rezepte des Nutzers) und Aufrufen (Clicks).
3. **UI-Metriken**: Anzeige von Favoriten- und Klick-Zahlen direkt auf den Kochbuch-Karten in der Community.

### v0.30.14 - Community Visibility Separation (Februar 2026)
1. **Sichtbarkeits-Trennung**: Einführung der `isCommunityVisible` Spalte in der `Users` Tabelle. Zuvor steuerte `isPublicCookbook` sowohl die generelle öffentliche Link-Freigabe als auch die Auflistung in der internen Community-Ansicht. Diese beiden Funktionen sind nun getrennt.

### v0.30.13 - Global Recipe Favorites (Februar 2026)
1. **Global Favorites**: Einführung der `FavoriteRecipes` Join-Tabelle, mit der Nutzer sowohl eigene als auch Rezepte aus fremden Kochbüchern favorisieren können. Die bestehende `isFavorite` Spalte in `Recipes` wird im Code ignoriert und durch diese N:M Beziehung ersetzt. 

### v0.30.12 - Favorite Recipes (Februar 2026)
1. **Favorite Feature**: Hinzufügen der `isFavorite` Spalte in der `Recipes` Tabelle, zusammen mit Backend-Routen und UI-Updates in der Rezeptansicht.

### v0.30.11 - AI Tier Limits & Fair Use (Februar 2026)
1. **Frontend-Limitierung**: Der Button "AI Lookup" in der Produktbearbeitung ist jetzt für Nutzer mit `Plastikgabel`-Abo komplett ausgeblendet. Für Nutzer mit `Silbergabel` werden dort transparent die Kosten `(5 Coins)` eingeblendet.
2. **Fair Use Counter**: Kostenlose AI-Funktionen (Einkaufslisten-Extraktion und Austauschassistent) sind nun serverseitig mit einem Fair-Use-Limit von maximal 10 Anfragen pro Stunde für Nutzer mit `Plastikgabel`-Abo versehen, um Serverkosten und Missbrauch vorzubeugen.

### v0.30.10 - AI Credit Deduction Adjustments (Februar 2026)
1. **Faires Abrechnungsmodell**: Credits für fast alle AI-Funktionen (Rezeptparser, Aufräumassistent, Lookup, Duplikatsuche, Bildgenerierung, Bildvariationen und Kochassistent) werden ab sofort **erst dann** vom Konto des Nutzers abgezogen, wenn die KI-Operation erfolgreich abgeschlossen wurde (und nicht mehr direkt bei Aufruf).
2. **Kostenlose AI-Funktionen**: Der Austauschassistent (Zutatensubstitution) und die Einkaufslisten-Extraktion aus Freitext/URL verbrauchen nun keine Credits mehr und sind für alle Nutzer absolut kostenlos.

### v0.30.9 - User Management Enhancements (Februar 2026)
1. **Benutzerverwaltung**: Im Reiter "Allgemein" der Benutzerdetails lässt sich nun der Newsletter-Status eines Nutzers per Schalter (Toggle) anzeigen und ändern.
2. **Direktnachrichten**: Im Kopfbereich des Benutzer-Detail-Modals gibt es jetzt einen E-Mail-Button. Ein Klick darauf schließt das Modal, wechselt in den Messaging-Tab und öffnet den E-Mail-Composer, wobei die Adresse des Nutzers sowie die "Hallo {benutzername}"-Anrede direkt vorausgefüllt werden.

### v0.30.8 - Auth Security & Logger Fix (Februar 2026)
1. **Sicherheit (Auth)**: Der Passwort-Reset-Link (DevLink) wird bei fehlgeschlagenem SMTP-Versand nun strikt nicht mehr als Fallback an die Frontend-API zurückgegeben, sondern ausschließlich serverseitig geloggt. Eine potenzielle Sicherheitslücke wurde geschlossen.
2. **Crash Fix (`emailService.js`)**: Behebung eines `ReferenceError: logSystem is not defined` beim initialen Laden der E-Mail-Konfiguration.

### v0.30.7 - Email Personalization (Februar 2026)
1. **Frontend Editor**: Neue Mails starten standardmäßig mit der Anrede `Hallo {benutzername},`. Die veralteten Buttons `+ Name` und `+ Abmeldelink` wurden entfernt, um das UI aufzuräumen.
2. **Backend Messaging**: Die Versandroute analysiert nun automatisch, ob der Platzhalter `{benutzername}` im Text/HTML vorhanden ist. Ist dies der Fall, wird der Benutzername anhand der Empfänger-E-Mail aus der Datenbank geladen und ersetzt. Wird die Adresse nicht gefunden, wird der Versand abgewiesen.

### v0.30.6 - Sender Address Hardening (Februar 2026)
1. **Sicherheit & Typisierung**: Extrem robuste Extraktion des `fromAddress`-Strings für den E-Mail-Versand, um `SequelizeValidationError` bei asynchroner Mail-Log-Speicherung endgültig zu eliminieren.

### v0.30.5 - Email Service & Auth Stability (Februar 2026)
1. **Fix (Sequelize)**: Behebung eines `SequelizeValidationError` in der Messaging-Route, bei dem Absender-Objekte fälschlicherweise direkt in die Datenbank geschrieben wurden.
2. **Fix (Auth)**: Korrektur der Erfolgsprüfung beim Passwort-Reset (Boolean vs. Object).
3. **Verbesserung**: Einführung eines Standard-Absendernamens ("Gabelguru") und Umstellung des `emailService` auf lazy logging für höhere Stabilität.

### v0.30.4 - Circular Dependency Fix (Februar 2026)
1. **Fix**: Umstellung aller Routen auf lazy loading des Loggers. Dies behebt Probleme mit zirkulären Abhängigkeiten, die dazu führen konnten, dass `logError` beim Laden der Module noch `undefined` war.

### v0.30.3 - Logger Import Fix (Februar 2026)
1. **Fix**: In mehreren Routen (`messaging`, `compliance`, `newsletter`) wurden die Logger-Funktionen (`logError`, `logSystem`) falsch importiert, was zu `TypeError: logError is not a function` Fehlern führte. Diese werden nun korrekt aus dem `utils/logger` Modul geladen.

### v0.30.2 - Performance & Loading Fix (Februar 2026)
1. **Fix**: Das Logging-System wurde so optimiert, dass es den Anfragen-Strom nicht mehr blockiert. Zuvor konnte eine Datenbankabfrage im Logger-Middleware dazu führen, dass die Seite endlos lädt.
2. **Optimierung**: Die Prüfung auf den Debug-Modus geschieht nun asynchron im Hintergrund.

### v0.30.1 - Newsletter Service Hotfix (Februar 2026)
1. **Fix**: In `newsletterService.js` wurden die Model-Imports wiederhergestellt, die bei der Umstellung auf das neue Logging-System versehentlich entfernt wurden (`ReferenceError: Newsletter is not defined`).

### v0.30.0 - Comprehensive System Observability (Februar 2026)
1. **Request Logging**: Alle Anfragen werden nun mit Methode, URL, Status-Code und Dauer protokolliert.
2. **Error Handling**: Implementierung eines globalen Error-Handlers und Prozess-Limitern (Uncaught Exceptions), die alle Fehler lückenlos in `system.log` schreiben.
3. **Log-Überholung**: Umstellung fast aller Routen von `console.error` auf `logError`, um sicherzustellen, dass Fehler nicht nur in der Konsole, sondern auch in der Log-Datei landen.
4. **Log-Level**: `INFO`, `WARN` und `ERROR` werden nun immer protokolliert, nur `DEBUG` ist optional.
