# Projekt Logik Dokumentation

## Fair Use System (Rate Limiting)

Das Fair Use System dient dazu, kostenlose KI-Funktionen für Nutzer der Stufe **Plastikgabel** einzuschränken, um die Betriebskosten zu kontrollieren.

### Implementierung
- **Datei**: `server/src/utils/fairUse.js`
- **Mechanismus**: In-Memory Tracking der Anfragen pro User (UserId).
- **Limit**: Standardmäßig **10 Anfragen pro Stunde**.
- **User-Tiers**: Betrifft aktuell nur Nutzer mit dem Tier `Plastikgabel`. Höhere Tiers (Silber, Gold, etc.) haben aktuell kein Fair-Use Limit für diese Funktionen (sie zahlen oft mit Coins).

### Betroffene Funktionen
Folgende Funktionen nutzen das Fair Use System:
1. **Unverträglichkeits-Check**: Prüfung von Produkten auf Haushalts-Unverträglichkeiten (`/intolerances/check`).
2. **KI-Ersatzvorschläge**: Vorschläge für alternative Produkte (`/ai/suggest-substitute`).
3. **KI-Rezept-Ersatz**: Kontextsensitive Ersatzvorschläge in Rezepten (`/ai/suggest-recipe-substitute`).

### Fehlerbehandlung (Frontend)
Wenn ein Nutzer das Limit erreicht, antwortet der Server mit Status **429 (Too Many Requests)**.
Das Frontend fängt diesen Fehler ab und zeigt einen entsprechenden Alert mit der Fehlermeldung des Servers an.

---

## Intoleranz-Check

Der Intoleranz-Check prüft eine Liste von Product-IDs gegen die im Haushalt (und bei den Haushaltsmitgliedern) hinterlegten Unverträglichkeiten.

- **Endpoint**: `POST /intolerances/check`
- **Logik**:
  - Ermittelt alle Haushaltsmitglieder.
  - Lädt deren Unverträglichkeiten (Intolerances) und explizit als intolerant markierte Produkte (IntolerantProducts).
  - Vergleicht die angefragten Produkte mit diesen Regeln.
  - Gibt eine Liste von Warnungen mit Wahrscheinlichkeiten (0-100%) zurück.
