export const tutorialChapters = {
    'allgemeines': {
        title: 'Allgemeines',
        page: '/',
        steps: [
            {
                element: '.react-calendar',
                popover: {
                    title: 'Einkaufs-Kalender',
                    description: 'Hier siehst du deine Einkaufslisten.',
                    side: "bottom",
                    align: 'start',
                    actionRequirement: 'calendar-click'
                }
            },
            {
                element: '.mt-4 .bg-primary',
                popover: {
                    title: 'Schnellzugriff',
                    description: 'Hier hast du direkten Zugriff auf deine nächste Einkaufsliste oder das nächste geplante Rezept.',
                    side: "bottom",
                    showButtons: ['next'],
                    align: 'center'
                }
            },
            {
                element: '#bottom-nav',
                popover: {
                    title: 'Die Menüleiste',
                    description: 'Wechsle hier zwischen den unterschiedlichen Funktionen von GabelGuru.',
                    side: "top",
                    align: 'center'
                }
            },
            {
                element: '#edit-mode-selector',
                popover: {
                    title: 'Die Modusleiste',
                    description: 'Hier wählst du aus, ob du Inhalte nur Ansehen, Erstellen, Bearbeiten oder Löschen willst.',
                    side: "bottom",
                    align: 'end',
                }
            },
            {
                element: '#edit-mode-selector',
                mobileOnly: true,
                popover: {
                    title: 'Modusleiste öffnen',
                    description: 'Klicke auf die Leiste, um die Modi zu sehen.',
                    side: "bottom",
                    align: 'end',
                    showButtons: [],
                    actionRequirement: 'selector-open'
                }
            },
            {
                element: '#edit-mode-btn-create-desktop',
                desktopOnly: true,
                popover: {
                    title: 'Hinzufügenmodus',
                    description: 'Klicke nun hier um eine Einkaufsliste zu erstellen.',
                    side: "bottom",
                    align: 'end',
                    showButtons: [],
                    actionRequirement: 'erstellen_ausgeloest'
                }
            },
            {
                element: '#edit-mode-btn-create-mobile',
                mobileOnly: true,
                popover: {
                    title: 'Hinzufügenmodus',
                    description: 'Klicke nun hier um eine Einkaufsliste zu erstellen.',
                    side: "bottom",
                    align: 'end',
                    showButtons: [],
                    actionRequirement: 'erstellen_ausgeloest'
                }
            },
            {
                element: '.react-calendar',
                popover: {
                    title: 'Liste erstellen',
                    description: 'Klicke nun auf einen beliebigen Tag um die Liste hinzuzufügen.',
                    side: "bottom",
                    showButtons: [],
                    align: 'start',
                    actionRequirement: 'calendar-click'
                }
            },
            {
                popover: {
                    title: 'Fertig',
                    description: 'Super, du hast nun deine erste Einkaufsliste erstellt.',
                    side: "bottom",
                    showButtons: ['next'],
                    align: 'start',
                }
            }
        ]
    },
    'listen': {
        title: 'Einkaufslisten',
        page: '/lists/:id',
        steps: [
            {
                element: '#store-select-trigger',
                popover: {
                    title: 'Einkaufsladen wählen',
                    description: 'Wähle hier einen Laden aus, in dem du einkaufen gehst. Das System lernt dann deine Laufwege! Whäle nun einen Laden aus.',
                    side: "bottom",
                    showButtons: [],
                    actionRequirement: 'store-change'
                }
            },
            {
                popover: {
                    title: 'Produkt hinzufügen',
                    description: 'Tippe in das Suchfeld, suche nach einem beliebigen Produkt, wähle es aus der Vorschlagsliste aus.',
                    nextBtnText: 'Jetzt machen →',
                }
            },
            {
                element: '#product-search-area',
                popover: {
                    title: '',
                    description: 'Füge ein Produkt hinzu.',
                    showButtons: [],
                    className: 'driver-popover-hidden'
                },
                actionRequirement: 'product-search-focus'
            },
            {
                element: '#quantity-increase-btn',
                popover: {
                    title: 'Menge anpassen',
                    side: "top",
                    description: 'Erhöhe die Menge um 1.',
                    showButtons: [],
                    actionRequirement: 'quantity-increase'
                }
            },
            {
                element: '#quantity-add-btn',
                popover: {
                    title: 'In den Warenkorb legen',
                    side: "top",
                    description: 'Lege das Produkt in den Warenkorb.',
                    showButtons: [],
                    actionRequirement: 'quantity-add'
                }
            },
            {
                element: '.product-item-row', // Needs specific class in component
                popover: {
                    title: 'Produkt austauschen',
                    description: 'Nicht verfügbar? Tippe doppelt, um ein Ersatzprodukt zu finden.',
                    showButtons: [],
                    side: "bottom",
                    align: 'start',
                    actionRequirement: 'product-swap'
                }
            },
            {
                element: '#product-substitute-modal',
                popover: {
                    title: 'Ersatz wählen',
                    description: 'Wähle einen der KI-Vorschläge aus, um das Produkt zu ersetzen.',
                    showButtons: [],
                    actionRequirement: 'substitute-selected'
                }
            },
            {
                element: '#smart-import-btn',
                popover: {
                    title: 'Smart Import öffnen',
                    description: 'Der Smart Import hilft dir, Zutaten direkt aus KI oder Rezepten einzufügen. Klicke auf den Button.',
                    showButtons: [],
                    actionRequirement: 'smart-import-opened'
                }
            },
            {
                element: '#smart-import-input-view',
                popover: {
                    title: 'Zutaten einfügen',
                    description: 'Gib "Bananen" ein und klicke dann auf Analysieren.',
                    showButtons: [],
                    actionRequirement: 'smart-import-bananen'
                }
            },
            {
                element: '#smart-import-review-view',
                popover: {
                    title: 'Auswahl bestätigen',
                    description: 'Die KI hat die Produkte erkannt. Wähle sie aus und klicke unten auf Auswahl hinzufügen.',
                    showButtons: [],
                    actionRequirement: 'smart-import-added'
                }
            },
            {
                element: '.product-item-row',
                popover: {
                    title: 'Abhaken',
                    description: 'Tippe das Produkt an, wenn du es in den Wagen gelegt hast. Das System lernt dabei deine Sortierung!',
                    showButtons: [],
                    actionRequirement: 'product-check'
                }
            },
            {
                element: '#complete-shopping-btn',
                popover: {
                    title: 'Einkauf abschließen',
                    description: 'Fertig? Klicke auf "Einkauf beenden", um die Liste zu archivieren.',
                    showButtons: [],
                    actionRequirement: 'shopping-complete'
                }
            },
            {
                popover: {
                    title: 'Fertig',
                    description: 'Super, du weißt nun wie die Einkaufsliste funktioniert.',
                    side: "bottom",
                    showButtons: ['next'],
                    align: 'start',
                }
            }
        ]
    },
    'menueplan': {
        title: 'Menüplan',
        page: '/menu',
        steps: [
            {
                element: '#edit-mode-selector',
                mobileOnly: true,
                popover: {
                    title: 'Modusleiste öffnen',
                    description: 'Klicke auf die Leiste, um die Modi zu sehen.',
                    side: "bottom",
                    align: 'end',
                    showButtons: [],
                    actionRequirement: 'selector-open'
                }
            },
            {
                element: '#edit-mode-btn-create-desktop',
                desktopOnly: true,
                popover: {
                    title: 'Hinzufügenmodus',
                    description: 'Klicke auf das Plus, um ein Rezept einzuplanen.',
                    side: "bottom",
                    align: 'end',
                    showButtons: [],
                    actionRequirement: 'erstellen_ausgeloest'
                }
            },
            {
                element: '#edit-mode-btn-create-mobile',
                mobileOnly: true,
                popover: {
                    title: 'Hinzufügenmodus',
                    description: 'Klicke auf das Plus, um ein Rezept einzuplanen.',
                    side: "bottom",
                    align: 'end',
                    showButtons: [],
                    actionRequirement: 'erstellen_ausgeloest'
                }
            },
            {
                element: '#tutorial-slot-actions',
                popover: {
                    title: 'Mahlzeit planen',
                    description: 'Tippe auf einen der Slots (z.B. Frühstück), um für diesen Tag etwas einzuplanen.',
                    showButtons: [],
                    actionRequirement: 'slot-click'
                }
            },
            {
                element: '#tutorial-manual-entry',
                disableInteraction: true,
                popover: {
                    title: 'Platzhalter & Auswärts',
                    description: 'Du kannst hier eigene Einträge machen oder den Slot als "Auswärts essen" markieren.',
                    showButtons: ['next']
                }
            },
            {
                element: '#tutorial-recipe-list',
                popover: {
                    title: 'Rezept hinzufügen',
                    description: 'Du kannst auch Rezepte einplanen. Klicke auf ein Rezept in der Liste, um es hinzuzufügen.',
                    showButtons: [],
                    actionRequirement: 'add-recipe-plan'
                }
            },
            {
                element: '#open-planner-btn',
                popover: {
                    title: 'Zutatenplaner',
                    description: 'Öffne nun den Zutatenplaner, um alles Nötige auf deine Liste zu setzen.',
                    showButtons: [],
                    actionRequirement: 'planner-open'
                }
            },
            {
                element: '.planner-item-schedule',
                popover: {
                    title: 'Einplanen',
                    description: 'Wähle die Menge für ein Produkt aus, das du auf die Liste setzen möchtest.',
                    showButtons: [],
                    actionRequirement: 'planner-item-select'
                }
            },
            {
                element: '.tutorial-substitute-btn',
                popover: {
                    title: 'Austauschen',
                    description: 'Tausche ggf. ein Produkt aus.',
                    showButtons: ['next']
                }
            },
            {
                element: '#save-planner-btn',
                popover: {
                    title: 'Speichern',
                    description: 'Der Plan steht? Dann speichere die Liste.',
                    showButtons: [],
                    actionRequirement: 'planner-save'
                }
            },
            {
                popover: {
                    title: 'Fertig',
                    description: 'Fantastisch! Du kannst nun Mahlzeiten planen und daraus Einkaufslisten generieren.',
                    side: "bottom",
                    showButtons: ['next'],
                    align: 'start',
                }
            }
        ]
    },
    'rezepte': {
        title: 'Rezepte',
        page: '/recipes',
        steps: [
            {
                element: '#recipe-burger-menu',
                delay: 600,
                popover: {
                    title: 'Rezept-Menü',
                    description: 'Öffne das Menü, um alle Optionen zu sehen.',
                    showButtons: [],
                    actionRequirement: 'recipe-menu-open'
                }
            },
            {
                element: '#tutorial-create-recipe-btn',
                disableInteraction: true,
                popover: {
                    title: 'Rezept erstellen',
                    description: 'Du kannst hier neue Rezepte erstellen.',
                    side: 'left',
                    showButtons: ['next']
                }
            },
            {
                element: '#tutorial-ai-import-btn, #tutorial-ai-import-locked-btn',
                disableInteraction: true,
                popover: {
                    title: 'AI Import',
                    description: 'Mit dem Passenden Abo kannst du Rezepte generieren oder Texte bzw. Bilder analysieren um daraus Rezepte zu extrahieren.',
                    side: 'left',
                    showButtons: ['next']
                }
            },
            {
                element: '#shuffle-recipes-btn',
                popover: {
                    title: 'Zufalls-Rezept',
                    description: 'Keine Idee? Klicke auf das Würfel-Symbol für eine automatische Inspiration.',
                    showButtons: [],
                    actionRequirement: 'dice-click'
                }
            },
            {
                element: '#start-generator-btn, #slot-machine-respin-btn',
                popover: {
                    title: 'Inspiration starten',
                    description: 'Starte den Zufallsgenerator, um ein passendes Rezept für dich zu finden.',
                    side: 'top',
                    align: 'center',
                    showButtons: [],
                    actionRequirement: 'generator-start'
                }
            },
            {
                element: '#tutorial-slot-machine-modal',
                disableInteraction: true,
                popover: {
                    title: 'Roulette läuft...',
                    description: 'Einen Moment Geduld, dein Rezept wird ausgewählt.',
                    side: 'top',
                    align: 'center',
                    showButtons: [],
                    actionRequirement: 'generator-finished'
                }
            },
            {
                element: '#slot-machine-schedule-btn',
                popover: {
                    title: 'Einplanen',
                    description: 'Gefunden! Plane dieses Rezept direkt für nächste Woche ein.',
                    side: 'top',
                    align: 'center',
                    showButtons: [],
                    actionRequirement: 'recipe-schedule'
                }
            },
            {
                element: '#tutorial-schedule-recipe-modal',
                popover: {
                    title: 'Slot wählen',
                    description: 'Wähle einen freien Slot aus, um das Rezept einzuplanen.',
                    side: 'bottom',
                    align: 'center',
                    showButtons: [],
                    actionRequirement: 'recipe-planned'
                }
            },
            {
                element: '.recipe-cook-btn',
                popover: {
                    title: 'Kochmodus',
                    description: 'Es geht los! Starte jetzt den Kochmodus für dieses Rezept indem du auf die Kachel klickst.',
                    showButtons: [],
                    actionRequirement: 'cook-mode-start'
                }
            },
            {
                element: '.cook-ingredient-item',
                popover: {
                    title: 'Zutaten abstreichen',
                    description: 'Behalte den Überblick. Streiche eine Zutat ab, die du bereits vorbereitet hast.',
                    showButtons: [],
                    actionRequirement: 'ingredient-check'
                }
            },
            {
                element: '.cook-timer-btn',
                popover: {
                    title: 'Timer nutzen',
                    description: 'Nichts anbrennen lassen! Starte den Timer direkt aus dem Rezept.',
                    showButtons: [],
                    actionRequirement: 'timer-start'
                }
            },
            {
                element: '.cook-timer-delete',
                delay: 600,
                popover: {
                    title: 'Timer löschen',
                    description: 'Fertig? Lösche den Timer wieder.',
                    showButtons: [],
                    actionRequirement: 'timer-delete'
                }
            },
            {
                element: '#ai-assistant-tab',
                disableInteraction: true,
                popover: {
                    title: 'KI Kochassistent',
                    description: 'Hinweis: Über diesen Tab erreichst du deinen persönlichen KI Kochassistenten, der dir bei Fragen zum Rezept hilft.',
                }
            },
            {
                element: '.tutorial-close-cooking-btn',
                popover: {
                    title: 'Kochmodus beenden',
                    description: 'Schließe den Kochmodus, wenn du fertig bist.',
                    showButtons: [],
                    actionRequirement: 'cook-mode-close'
                }
            },
            {
                element: '#tutorial-cooking-exit-modal',
                isOptional: true,
                popover: {
                    title: 'Änderungswünsche',
                    description: 'Gib hier änderungswünsche ein, falls du sie hast und das passende Abo besitzt.',
                    showButtons: [],
                    actionRequirement: 'cook-mode-finish'
                }
            },
            {
                element: '.recipe-like-btn',
                popover: {
                    title: 'Favoriten',
                    description: 'Gefällt es dir? Like das Rezept, um es als Favorit zu markieren. Achte auch auf die Kategorien zur besseren Sortierung.',
                    showButtons: [],
                    actionRequirement: 'recipe-like'
                }
            },
            {
                popover: {
                    title: 'Fertig',
                    description: 'Toll! Jetzt weißt du wie man Rezepte anlegt, findet und kocht.',
                    side: "bottom",
                    showButtons: ['next'],
                    align: 'start',
                }
            }
        ]
    },
    'community': {
        title: 'Community',
        page: '/community-cookbooks',
        finalRedirect: '/community-cookbooks',
        steps: [
            {
                element: '.follow-cookbook-btn',
                popover: {
                    title: 'Community folgen',
                    description: 'Entdecke Kochfreunde! Folge einem interessanten Kochbuch, um keine neuen Rezepte zu verpassen. Wenn du Benachrichtigungen erhalten möchtest, aktiviere diese in den Einstellungen.',
                    showButtons: [],
                    actionRequirement: 'community-follow'
                }
            },
            {
                element: '.community-cookbook-card',
                popover: {
                    title: 'Inspiration finden',
                    description: 'Klicke auf ein Kochbuch, um die Rezepte darin zu sehen.',
                    showButtons: [],
                    actionRequirement: 'community-open'
                }
            },
            {
                element: '.community-recipe-like',
                popover: {
                    title: 'Inspiration sammeln',
                    description: 'Like ein Rezept aus der Community. Es wird dann auch in deiner Rezeptsammlung als COmmunity-Rezept sichtbar.',
                    showButtons: [],
                    actionRequirement: 'community-like'
                }
            },
            {
                popover: {
                    title: 'Fertig',
                    description: "Und das war's auch schon zu den Communityfunktionen!.",
                    side: "bottom",
                    showButtons: ['next'],
                    align: 'start',
                }
            }
        ]
    },
    'unvertraeglichkeiten': {
        title: 'Unverträglichkeiten',
        page: '/settings',
        steps: [
            {
                element: '#settings-preferences-tab',
                delay: 600,
                popover: {
                    title: 'Präferenzen',
                    description: 'Öffne den Tab "Präferenzen", um deine Einstellungen anzupassen.',
                    showButtons: [],
                    actionRequirement: 'preferences-tab-click'
                }
            },
            {
                element: '#settings-preferences-content',
                disableInteraction: true,
                popover: {
                    title: 'Deine Einstellungen',
                    description: 'Hier kannst du deine Unverträglichkeiten und weitere Vorlieben einstellen.',
                }
            },
            {
                element: 'body',
                popover: {
                    title: 'Warnung im Kochmodus',
                    description: 'Hier siehst du, wie GabelGuru dich im Kochmodus vor unverträglichen Zutaten warnt.',
                    image: '/tutorial/intolerance-cooking.jpg', // Placeholder
                }
            },
            {
                element: 'body',
                popover: {
                    title: 'Warnung im Zutatenplaner',
                    description: 'Auch beim Planen deiner Woche erkennt das System sofort Konflikte.',
                    image: '/tutorial/intolerance-planner.jpg', // Placeholder
                }
            },
            {
                element: 'body',
                popover: {
                    title: 'Ersetzungsassistent',
                    description: 'Die KI schlägt dir automatisch Alternativen vor, die zu deinem Haushalt passen.',
                    image: '/tutorial/Ersetzungsassistent.jpg', // Placeholder
                }
            },
            {
                popover: {
                    title: 'Fertig',
                    description: "Siehst du! So einfach kann man Unverträglichkeiten verwalten.",
                    side: "bottom",
                    showButtons: ['next'],
                    align: 'start',
                }
            }
        ]
    },
    'optionen': {
        title: 'Optionen',
        page: '/settings',
        steps: [
            {
                element: '#settings-subscription',
                popover: { title: 'Abos & Credits', description: 'Verwalte deine Mitgliedschaft und sieh dein Credit-Guthaben ein.' }
            },
            {
                element: '#settings-household',
                popover: { title: 'Haushalt', description: 'Lege einen Haushalt an, um gemeinsam mit anderen zu planen und einzukaufen.' }
            },
            {
                element: '#settings-alexa',
                popover: { title: 'Alexa', description: 'Verbinde GabelGuru mit Alexa, um Produkte per Sprachbefehl auf die Liste zu setzen.' }
            },
            {
                element: '#settings-public-cookbook',
                popover: { title: 'Öffentliches Kochbuch', description: 'Teile dein eigenes Kochbuch mit der Community!' }
            },
            {
                element: '#settings-products',
                popover: { title: 'Produkte', description: 'Verwalte deine eigenen Produkte und unterscheide sie von globalen Artikeln.' }
            },
            {
                element: '#settings-stores',
                popover: { title: 'Geschäfte', description: 'Lege deine bevorzugten Supermärkte an, um deine Laufwege zu optimieren.' }
            }
        ]
    }
};

export const getNextChapter = (current) => {
    const chapters = ['allgemeines', 'listen', 'menueplan', 'rezepte', 'community', 'unvertraeglichkeiten', 'optionen'];
    const idx = chapters.indexOf(current);
    if (idx !== -1 && idx < chapters.length - 1) return chapters[idx + 1];
    return null;
};
