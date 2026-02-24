# Paywall & Subscription System Documentation

This document describes the multi-tier subscription system with Stripe integration, including specific credit logic and user confirmations.

## Subscription Tiers & Features

| Feature | Plastikgabel (Gratis) | Silbergabel (1,99€) | Goldgabel (3,99€) |
| :--- | :--- | :--- | :--- |
| **Monatl. Coins** | 0 | 600 | 1500 |
| **KI-Text (Kosten)** | - | 5 Coins | **0 Coins** (Gratis) |
| **KI-Bild (Kosten)** | - | 60 Coins | 40 Coins |
| **Basics** | Einkaufslisten, Rezepte, Menüplaner, Kochmodus | Alles aus Plastikgabel | Alles aus Silbergabel |
| **KI-Features** | - | Produktwechsel, Rezept-Assistent, Koch-Assistent, Cleanup | **Unlimitierte** Text-AI |

## Subscription Logic

### Upgrades
- Upgrades (z.B. Silber -> Gold) werden sofort wirksam.
- Stripe verrechnet den Restbetrag des laufenden Monats anteilig (Proration).
- Der Nutzer erhält sofort Zugriff auf die neuen Features und Credits.

### Kündigung
- Nutzer können jederzeit zum Ende der Laufzeit kündigen.
- Der Status bleibt bis zum Ablaufdatum "active", danach erfolgt der Downgrade auf Plastikgabel.
- `cancel_at_period_end` wird im Stripe-Portal gesetzt.

### KI-Bestätigungs-Workflow
- Jede KI-Funktion (Produktwechsel, Rezept-Assistent, etc.) muss vor der Ausführung die Kosten anzeigen.
- Der Nutzer muss die Kosten explizit bestätigen (`AiActionConfirmModal`).
- Transaktionen werden in der `CreditTransactions` Tabelle geloggt.
- Beachte, dass es unterschiedliche Kosten geben kann, je nach Subscription.

## Technical Implementation Notes

### Database Fields (User Model)
- `subscriptionStatus`: ENUM('active', 'canceled', 'past_due', 'none')
- `subscriptionExpiresAt`: DATE
- `cancelAtPeriodEnd`: BOOLEAN
- `stripeSubscriptionId`: STRING

### Components
- `SubscriptionModal.jsx`: Tier-Auswahl und AGB-Zustimmung.
- `AiActionConfirmModal.jsx`: Kostenbestätigung vor KI-Nutzung.
- `paymentService.js`: Backend-Logik für Stripe.
- `subscription.js`: API-Routen für Management und Webhooks.

### Already implemented
- Die Daten zur Zahlungsabwicklung von Stripe sind schon in der Datenbank gespeichert und werden über die settings-Seite vom Admin hinterlegt.

### Display Logic
- Unter 'Abo & Credits' hat man bei "Aktuelles Abo" die Möglichkeit, ein Abo zu kaufen, kündigen oder upgraden.
- Beim Klick auf "Abo kaufen" wird die SubscriptionModal geöffnet.
- Dort kann man die Tiere auswählen und die AGB bestätigen.
- Die Tiers werden dort detailliert beschrieben.
- Nach dem Klick auf "Zahlungspflichtig bestellen" wird die Stripe Checkout Seite geöffnet.
- Nach erfolgreicher Bezahlung wird die SubscriptionModal geschlossen.


