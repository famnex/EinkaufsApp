# Tutorial Management

Dieses Dokument beschreibt, wie die Tutorials zurückgesetzt und für Testzwecke oder neue Benutzer vorbereitet werden.

## Zurücksetzen der Tutorials

Um alle Tutorials für **alle** Benutzer zurückzusetzen (z.B. für eine neue Release-Prüfung), muss das Script `reset_all_tutorials.js` ausgeführt werden.

**Befehl:**
`node reset_all_tutorials.js`

**Was passiert dabei?**
- `forkyTutorialsSeen` wird auf ein leeres Objekt `{}` gesetzt.
- `isOnboardingCompleted` wird auf `false` gesetzt.
- `onboardingPreferences` wird auf `null` gesetzt.

## Sicherstellen von Tutorial-Daten

Damit die Tutorials (insbesondere das "Forky"-Tutorial auf der Listendetail-Seite und der Rezept-Seite) korrekt funktionieren und Elemente zum Highlighten finden, müssen bestimmte Daten in der Datenbank vorhanden sein. Das Script `ensure_tutorial_data.js` stellt dies sicher.

**Befehl:**
`node ensure_tutorial_data.js`

**Was passiert dabei?**
1. **Einkaufsliste:** Es wird sichergestellt, dass der Benutzer eine aktive Liste hat. Falls diese leer ist, wird ein Beispielprodukt ("Äpfel") hinzugefügt. Das ist wichtig für den Selektor `.product-item-row`.
2. **Rezepte:** Es wird sichergestellt, dass Rezept ID 0 existiert, öffentlich ist und zu den Favoriten des Benutzers gehört, damit es in der Rezeptübersicht erscheint. Das ist wichtig für den Selektor `#first-recipe-card`.

## Wichtige Selektoren für Tutorials

Diese Selektoren werden in `client/src/lib/forkyTutorials.js` verwendet:

| Seite | Element | Selektor |
|-------|---------|----------|
| ListDetail | Produktsuche | `#product-search-area` |
| ListDetail | Geschäftsauswahl | `#store-select-trigger` |
| ListDetail | Produktzeile | `.product-item-row` |
| ListDetail | Smart Import | `#smart-import-btn` |
| Recipes | Burger Menü | `#recipe-burger-menu` |
| Recipes | Erste Rezeptkarte | `#first-recipe-card` |
| Recipes | Rezept Aktionsmenü | `#first-recipe-action-menu` |
| Dashboard | Kalender | `#calendar-container` |
| Dashboard | Modus-Auswahl | `#edit-mode-selector` |
