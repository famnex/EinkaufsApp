/**
 * Short Forky tutorial steps for first-visit tours.
 * Each tutorial has a key and an array of steps with a `text` property.
 *
 * Keys: 'lists', 'menu', 'recipes', 'community', 'listdetail'
 */

export const forkyTutorials = {
    lists: [
        { text: 'Hier ist die Übersicht deiner Einkaufslisten.' },
        { text: 'Das hier ist der Kalender, wo du Listen auswählst.', selector: '#calendar-container' },
        { text: 'Hier stellst du den Modus ein und kannst dann Listen erstellen oder löschen.', selector: '#edit-mode-selector' },
        { text: 'Weitere Infos gib es unter Optionen: Hilfe.' },
    ],
    menu: [
        { text: 'Hier ist dein Menüplan, wo du deinen Kochplan für die Woche hinterlegst.' },
        { text: 'Es gibt Frühstück, Mittagessen, Abendessen und Snack – für jeden Tag kannst du Gerichte einplanen.', selector: '#meal-slot-actions' },
        { text: 'Hier stellst du den Modus ein und kannst dann dein Essen für die Tage erstellen, ändern oder löschen.', selector: '#edit-mode-selector' },
        { text: 'Weitere Infos gib es unter Optionen: Hilfe.' },
    ],
    recipes: [
        { text: 'Hier ist deine Rezeptsammlung.' },
        { text: 'Hier erstellst du neue Rezepte, importierst sie und benutzt den Zufallsgenerator.', selector: '#recipe-burger-menu' },
        { text: 'Klicke auf ein Rezept, um es im Kochmodus zu öffnen.', selector: '#first-recipe-card' },
        { text: 'Plane dein Essen ein oder lege die Zutaten auf eine Einkaufsliste über das Aktionsmenü eines Rezepts.', selector: '#first-recipe-action-menu' },
        { text: 'Weitere Infos gib es unter Optionen: Hilfe.' },
    ],
    community: [
        { text: 'Hier ist die Communityseite.' },
        { text: 'Klicke auf ein Kochbuch, um dieses zu öffnen.', selector: '#first-cookbook-card' },
        { text: 'Klicke auf das Herz, um einem Kochbuch zu folgen.', selector: '#first-cookbook-heart' },
        { text: 'Du kannst auch Rezepte liken – dann werden sie dir auch unter REZEPTE angezeigt.' },
        { text: 'Weitere Infos gib es unter Optionen: Hilfe.' },
    ],
    listdetail: [
        { text: 'Das ist eine Einkaufsliste.' },
        { text: 'Hier kannst du Produkte durch Eingabe hinzufügen.', selector: '#product-search-area' },
        { text: 'Wähle hier ein Geschäft aus.', selector: '#store-select-trigger' },
        { text: 'Klicke auf einen Artikel, um ihn als eingekauft zu markieren.', selector: '.product-item-row' },
        { text: 'Nutze das Modusmenü, um Artikel zu ändern oder zu löschen.', selector: '#edit-mode-selector' },
        { text: 'Hier kannst du Einkaufslisten smart importieren (auch per Foto).', selector: '#smart-import-btn' },
        { text: 'Tippe doppelt auf ein Produkt, um es smart auszutauschen.', selector: '.product-item-row' },
        { text: 'Weitere Infos gib es unter Optionen: Hilfe.' },
    ],
};
