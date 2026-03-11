import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, ChevronDown, Info, Play } from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';
import { cn } from '../lib/utils';
import { useTutorial } from '../contexts/TutorialContext';

export default function HelpTab({ user, setUser, api }) {
    const [openTopic, setOpenTopic] = useState(null);
    const { setIsWelcomeOpen } = useTutorial();

    const helpTopics = [
        {
            id: '1',
            trigger: '🏠 1. Das Dashboard & Deine Kommandozentrale',
            content: (
                <div className="space-y-4 text-sm text-foreground leading-relaxed">
                    <p>Das Dashboard ist dein Startbildschirm und bietet dir einen perfekten Überblick über deine Planung.</p>
                    <p><strong>Der Schnellzugriff:</strong> Ganz oben findest du zwei smarte Kacheln. Die Kachel "Nächster Einkauf" zeigt dir sofort die nächste anstehende Einkaufsliste an. Die Kachel "Nächstes Rezept" berechnet anhand der aktuellen Uhrzeit (z. B. 0-10 Uhr für Frühstück, 10-14 Uhr für Mittagessen), welches Gericht als Nächstes in deinem Wochenplan ansteht. Ein Klick darauf bringt dich direkt zum Einkauf oder startet den Kochmodus.</p>
                    <p><strong>Der interaktive Kalender:</strong> Im Zentrum siehst du einen Kalender. Tage mit einer aktiven Einkaufsliste sind rot markiert, bereits archivierte (erledigte) Listen sind türkis und haben einen kleinen Haken. Der aktuelle Tag ist mit einem Rahmen hervorgehoben.</p>
                    <p><strong>Wischen (Swipe-Gesten):</strong> Wische auf dem Kalender auf dem Handy nach links oder rechts, um schnell den Monat zu wechseln.</p>
                    <p><strong>Listen verschieben per Drag & Drop:</strong> Pläne ändern sich! Halte einen Tag mit einer aktiven Liste im Kalender etwas länger gedrückt. Du kannst die Liste nun auf einen anderen Tag ziehen. Das System fragt dich dann intelligent, ob du die Liste dorthin verschieben oder mit einer bereits dort liegenden Liste verschmelzen möchtest.</p>
                    <p><strong>Listen erstellen und löschen:</strong> Tippe auf einen leeren Tag, um sofort eine neue Liste zu erstellen, oder tippe auf eine Liste im "Löschen"-Modus der App, um sie zu entfernen.</p>
                </div>
            )
        },
        {
            id: '2',
            trigger: '🛒 2. Einkaufslisten: Organisiert und smart einkaufen',
            content: (
                <div className="space-y-4 text-sm text-foreground leading-relaxed">
                    <p>Die Listen in GabelGuru lernen mit und unterstützen dich aktiv im Supermarkt.</p>
                    <p><strong>Lernende Laufwege:</strong> Wenn du eine Liste öffnest, wähle oben rechts deinen bevorzugten Supermarkt aus (z. B. "Rewe" oder "Aldi"). Wenn du Produkte während des Einkaufs abhakst, merkt sich GabelGuru die Reihenfolge. Beim nächsten Einkauf in diesem Geschäft wird deine Liste automatisch an deine typischen Laufwege angepasst.</p>
                    <p><strong>Produkte suchen & hinzufügen:</strong> Nutze die Suchleiste oben. Das System ist clever und findet Produkte auch über Synonyme. Wenn du ein Produkt searchst, das es noch nicht gibt, kannst du es direkt über die Suche als "Neues Produkt" anlegen.</p>
                    <p><strong>Mengen anpassen:</strong> Klicke auf ein Produkt, um die Menge (z. B. "2 Stück" oder "500 Gramm") und optional eine kleine Notiz (z. B. "Nur die reifen") festzulegen.</p>
                    <p><strong>Artikel abhaken:</strong> Ein einfacher Klick auf eine Produktkachel markiert den Artikel als gekauft (die Kachel wird türkis und bekommt einen Haken). Gekaufte Artikel rutschen automatisch ans Ende der Liste.</p>
                    <p><strong>KI-Ersatzprodukte (Double-Tap):</strong> Du stehst im Laden und die Zutat ist ausverkauft? Tippe zweimal schnell hintereinander (Double-Tap) auf das Produkt. Die KI sucht dir sofort passende Alternativen heraus, prüft diese auf Unverträglichkeiten in deinem Haushalt und tauscht das Produkt auf Knopfdruck aus.</p>
                    <p><strong>Manuelles Sortieren:</strong> Halte einen Artikel gedrückt und ziehe ihn nach oben oder unten, um deine Liste manuell zu sortieren.</p>
                    <p><strong>Zoom-Level:</strong> Unten rechts findest du Lupe-Icons. Damit kannst du die Ansicht der Artikel anpassen – von großen Kacheln mit großen Namen bis hin zu ganz kleinen, kompakten Listenansichten.</p>
                    <p><strong>Smart Import:</strong> Klicke auf das kleine Download-Symbol oben. Hier kannst du Rezepttexte aus dem Internet oder alte Notizen einfügen, und die KI extrahiert die Zutaten und setzt sie direkt auf deine Einkaufsliste.</p>
                    <p><strong>Live-Synchronisation:</strong> Bist du mit deinem Partner im selben Laden? Die Liste synchronisiert sich alle 5 Sekunden automatisch, sodass ihr Artikel gleichzeitig auf verschiedenen Handys abhaken könnt, ohne etwas doppelt zu kaufen.</p>
                    <p><strong>Einkauf abschließen:</strong> Bist du fertig, klicke unten auf "Einkauf abschließen". Dies speichert deine Laufwege und archiviert die Liste, wenn alles besorgt wurde.</p>
                </div>
            )
        },
        {
            id: '3',
            trigger: '📅 3. Der Menüplan & Zutatenplaner',
            content: (
                <div className="space-y-4 text-sm text-foreground leading-relaxed">
                    <p>Plane deine Mahlzeiten entspannt im Voraus.</p>
                    <p><strong>Die Wochenansicht:</strong> Der Menüplan zeigt dir deine aktuelle Woche (Montag bis Sonntag). Wische nach links oder rechts, um zwischen den Wochen zu wechseln.</p>
                    <p><strong>Tages-Slots:</strong> Jeder Tag hat spezifische Slots für "Frühstück", "Mittagessen", "Abendessen" und "Snack".</p>
                    <p><strong>Gerichte einplanen:</strong> Tippe auf ein Plus-Symbol in einem Slot, um ein Rezept aus deiner Sammlung auszuwählen. Alternativ kannst du auch manuelle Einträge machen oder den Slot als "Auswärts essen" (markiert mit einem Auto-Symbol in Orange) kennzeichnen.</p>
                    <p><strong>Gerichte verschieben (Drag & Drop):</strong> Pläne ändern sich! Halte ein geplantes Rezept einfach gedrückt und ziehe es auf einen anderen Tag oder einen anderen Slot. Wenn der Ziel-Slot schon belegt ist, fragt dich das System, ob du die Gerichte tauschen (Swap) oder das alte Gericht ersetzen möchtest.</p>
                    <p><strong>Unverträglichkeits-Check:</strong> Sobald du ein Rezept einplanst, prüft das System im Hintergrund, ob die Zutaten mit den im Haushalt hinterlegten Unverträglichkeiten kollidieren. Ist das der Fall, erscheint eine Warnung und ein Assistent hilft dir, die problematischen Zutaten direkt durch sichere Alternativen zu ersetzen.</p>
                    <p><strong>Der Zutatenplaner (Bulk Planner):</strong> Klappe einen geplanten Tag aus und klicke auf "Zutaten planen". Der Planer berechnet genau, wie viel von welcher Zutat du für alle anstehenden Rezepte benötigst.</p>
                    <p><strong>Varianten wählen:</strong> Im Planer siehst du, ob du eine Zutat (z. B. Eier) schon teilweise auf der Liste hast. Klicke auf "Hinzufügen". Bietet ein Produkt verschiedene Varianten an, öffnet sich ein spezieller "Variant Picker", um die genaue Variante zu wählen.</p>
                    <p><strong>Zutaten ausblenden:</strong> Wische im Planer auf einer Zutat nach links, um sie auszublenden, falls du sie ohnehin noch massig auf Vorrat hast.</p>
                </div>
            )
        },
        {
            id: '4',
            trigger: '🍳 4. Rezepte, KI-Import & Zufallsgenerator',
            content: (
                <div className="space-y-4 text-sm text-foreground leading-relaxed">
                    <p>Deine Rezeptsammlung ist das Herzstück von GabelGuru und voller smarter Features.</p>
                    <p><strong>Rezepte filtern und sortieren:</strong> Du kannst deine Rezeptliste nach Alphabet, Veröffentlichungsdatum, Likes, Zubereitungszeit oder sogar nach der Anzahl der Zutaten sortieren. Über das Dropdown-Menü kannst du nach Kategorien filtern oder dir speziell die Favoriten einzelner Haushaltsmitglieder anzeigen lassen.</p>
                    <p><strong>Aktionsmenü:</strong> Klicke auf die drei Punkte an einer Rezeptkachel. Hier kannst du das Rezept bearbeiten, einplanen, drucken, löschen oder mit Freunden teilen.</p>
                    <p><strong>Sichtbarkeit:</strong> Du kannst einzelne Rezepte über das Aktionsmenü "Verstecken", sodass sie nicht in deinem öffentlichen Kochbuch auftauchen. Versteckte Rezepte bekommen ein kleines "Durchgestrichenes Auge"-Symbol.</p>
                    <p><strong>Manuelle Rezepterstellung:</strong> Klicke im Menü auf "Rezept erstellen". Du kannst Titel, Zeiten und Portionen festlegen. Im Tab "Zutaten" kannst du Artikel einzeln suchen oder einen großen Textblock mit Zutaten in den "Schnell-Import" kopieren, welchen das System dann automatisch aufschlüsselt. Anschließend schreibst du die Zubereitungsschritte und lädst ein Bild hoch.</p>
                    <p><strong>KI Rezept-Import (ab Abo "Silbergabel"):</strong> Du musst keine Rezepte mehr abtippen! Klicke im Menü auf "AI Import". Du kannst den Text eines Rezepts aus dem Internet kopieren oder ein Foto von einem Kochbuch / handgeschriebenen Zettel hochladen (Vision). Die KI extrahiert vollautomatisch Titel, Zeiten und Schritte. Zudem ordnet sie die gefundenen Zutaten (selbst wenn sie anders geschrieben sind) den Produkten in deiner Datenbank zu. Ein Textimport kostet 10 Coins, ein Foto-Import 15 Coins.</p>
                    <p><strong>KI-Bilder generieren:</strong> Hat dein Rezept kein Bild? Im Bearbeitungsfenster oder beim KI-Import kannst du auf "AI Neu" klicken. Die KI generiert dann für 60 Coins (40 Coins im Goldgabel-Abo) ein professionelles, passendes Food-Foto.</p>
                    <p><strong>Das Zufalls-Rezept (Slot Machine):</strong> Du weißt nicht, was du kochen sollst? Öffne das Menü und tippe auf "Zufalls-Rezept". Das System startet eine Art Spielautomat und schlägt dir ein zufälliges Gericht aus deiner Sammlung vor, das du direkt in deinen Wochenplan übernehmen kannst.</p>
                </div>
            )
        },
        {
            id: '5',
            trigger: '👨‍🍳 5. Der Kochmodus: Dein digitaler Sous-Chef',
            content: (
                <div className="space-y-4 text-sm text-foreground leading-relaxed">
                    <p>Sobald du auf ein Rezept klickst, startet der Kochmodus. Er ist darauf ausgelegt, dass du die Hände frei hast und nichts anbrennt.</p>
                    <p><strong>Kein dunkler Bildschirm:</strong> Sobald der Kochmodus aktiv ist, sorgt das System (Wake Lock) dafür, dass dein Bildschirm anbleibt und sich nicht automatisch sperrt.</p>
                    <p><strong>Textgröße anpassen:</strong> Oben rechts (oder im Menü auf dem Handy) findest du Plus- und Minus-Buttons ("Aa"), um die Schriftgröße der Anleitung stufenweise zu vergrößern.</p>
                    <p><strong>Portionen live skalieren:</strong> Unter dem Rezeptbild steht die Anzahl der Portionen. Tippe darauf und nutze die Plus/Minus-Tasten, um die Portionen anzupassen. Alle Zutatenmengen im Rezept rechnen sich sofort in Echtzeit um.</p>
                    <p><strong>Zutaten im Überblick:</strong> Links (bzw. auf dem Handy in einem eigenen Tab) siehst du alle Zutaten. Tippe sie an, um sie durchzustreichen, wenn du sie bereitgelegt hast.</p>
                    <p><strong>Interaktive Anleitung & Timer:</strong> In der Schritt-für-Schritt-Anleitung sind Zutaten und Zeiten farbig markiert. Tippst du auf eine markierte Zutat, wird sie abgehakt. Tippst du auf eine Zeitangabe (z. B. "10 Min"), startet sofort ein Countdown-Timer am unteren Bildschirmrand. Wenn der Timer abläuft, ertönt ein Alarm.</p>
                    <p><strong>KI Sprachassistent (ab "Silbergabel"):</strong> Im Kochmodus leuchtet ein funkelnder Button. Ein Klick darauf (kostet einmalig 10 Coins pro Kochvorgang) aktiviert das Mikrofon. Du kannst nun einfach sprechen: Sage "Nächster Schritt", "Starte einen Timer für 5 Minuten" oder stelle Fragen wie "Womit kann ich den Zucker ersetzen?".</p>
                    <p><strong>Warnungen während des Kochens:</strong> Hast du eine Zutat, die jemand im Haushalt nicht verträgt, erscheint ein rotes oder oranges Warn-Icon neben der Zutat. Tippe darauf, um genau zu sehen, für wen das ein Problem ist. Zudem gibt es ein gelbes Dreieck, das dich warnt, falls du eine Zutat in den nächsten Tagen für ein anderes Rezept noch einmal brauchst – so isst du sie nicht versehentlich ganz auf!</p>
                    <p><strong>Die magische Rezept-Anpassung beim Beenden:</strong> Wenn du den Kochmodus verlässt, öffnet sich ein Fenster. Hier fragt dich die App, ob du Änderungswünsche hast. Gib einfach ein: "Es war zu salzig". Die KI schreibt daraufhin das Rezept und die Zutatenmengen für dein nächstes Mal dauerhaft um! Die Kochzeit kann auch angepasst werden.</p>
                </div>
            )
        },
        {
            id: '6',
            trigger: '⚙️ 6. Einstellungen, Smart Home & Haushalt',
            content: (
                <div className="space-y-4 text-sm text-foreground leading-relaxed">
                    <p>GabelGuru lässt sich perfekt auf dich und deine Mitbewohner zuschneiden.</p>
                    <p><strong>Haushalt verwalten:</strong> Gehe in die Einstellungen zum Tab "Haushalt". Hier kannst du einen Einladungslink generieren und an deine Familie schicken. Alle eingeladenen Mitglieder greifen auf denselben Menüplan und dieselben Einkaufslisten zu. Du kannst hier auch Rollen verteilen (wer darf was bearbeiten).</p>
                    <p><strong>Unverträglichkeiten & Präferenzen:</strong> Im Reiter "Präferenzen" kann jedes Haushaltsmitglied seine eigenen Allergien oder Ernährungsformen (z. B. "Vegan", "Laktosefrei") hinterlegen. Die App kombiniert das Wissen des gesamten Haushalts für Warnungen und Ersatzvorschläge.</p>
                    <p><strong>Eigene Produkte & Geschäfte:</strong> Unter "Produkte" kannst du Artikel anlegen, die in der globalen Datenbank fehlen. Unter "Geschäfte" legst du deine Lieblings-Supermärkte an (wie Kaufland, Edeka), damit die App die Laufwege für diesen spezifischen Laden lernen kann.</p>
                    <p><strong>Alexa verbinden:</strong> Gehe auf den Tab "Alexa" und klicke auf "Neuen Code generieren". Diesen Code sagst oder gibst du in deinem Amazon Alexa Skill ein. Danach kannst du einfach sagen: "Alexa, sag GabelGuru er soll Milch auf die Liste setzen".</p>
                    <p><strong>Abos & Credits:</strong> Unter "Abos & Credits" siehst du deinen aktuellen Plan. Die Basisversion ist "Plastikgabel". Mit "Silbergabel" schaltest du KI-Funktionen frei, zahlst aber nur über "Coins" (Credits), die du dort aufladen kannst. "Goldgabel" und "Rainbowspoon" sind Premium-Abos mit integrierten Credits und günstigeren KI-Preisen.</p>
                </div>
            )
        },
        {
            id: '7',
            trigger: '🌍 7. Community & Teilen',
            content: (
                <div className="space-y-4 text-sm text-foreground leading-relaxed">
                    <p>Lass dich inspirieren und teile deine besten Kreationen.</p>
                    <p><strong>Öffentliches Kochbuch aktivieren:</strong> Gehe in die Einstellungen und setze den Schalter bei "Öffentliches Kochbuch" auf aktiv. Du erhältst nun einen "Sharing Key" (einen persönlichen Link). Diesen Link kannst du an Freunde schicken, damit sie deine Rezeptsammlung durchstöbern können.</p>
                    <p><strong>Community Kochbücher:</strong> Öffne den Bereich "Community". Hier findest du die öffentlichen Kochbücher aller anderen GabelGuru-Nutzer.</p>
                    <p><strong>Folgen:</strong> Klicke in einem fremden Kochbuch auf "Folgen", um immer up-to-date zu bleiben, wenn dieser Nutzer neue Rezepte hinzufügt.</p>
                    <p><strong>Rezepte klauen (Liken):</strong> Findest du in der Community ein Rezept, das dir gefällt, tippe einfach auf das Herz-Symbol. Das Rezept wird sofort in deiner eigenen Rezept-Liste gespeichert, markiert mit einem kleinen "Community"-Badge, sodass du weißt, woher es stammt.</p>
                </div>
            )
        }
    ];

    return (
        <Card className="p-4 sm:p-8 border-border bg-card/50 shadow-lg backdrop-blur-sm">
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                <HelpCircle size={20} className="text-primary" />
                Hilfe & Dokumentation
            </h2>
            <div className="space-y-6">

                <div className="p-4 bg-muted/50 rounded-2xl border border-border/50 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="font-bold text-foreground">App-Tutorial</p>
                            <p className="text-xs text-muted-foreground">
                                Lerne wie GabelGuru funktioniert
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        id="start-tutorial-btn"
                        className="w-full bg-background/50 hover:bg-background transition-colors flex items-center justify-center gap-2 py-5 rounded-xl border-dashed"
                        onClick={() => {
                            setIsWelcomeOpen(true);
                        }}
                    >
                        <Play size={14} className="text-primary fill-primary" />
                        Tutorial jetzt starten
                    </Button>
                </div>

                <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
                    <div className="flex items-start gap-3 mb-6">
                        <span className="text-2xl">📖</span>
                        <div>
                            <p className="font-bold text-foreground">Das große GabelGuru Handbuch</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Willkommen bei GabelGuru! Diese Anleitung führt dich durch alle Bereiche der App – vom Dashboard über die Einkaufsliste bis hin zur intelligenten Koch-Assistenz.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {helpTopics.map((topic) => (
                            <div key={topic.id} className="border border-border/50 rounded-xl overflow-hidden bg-background/50">
                                <button
                                    onClick={() => setOpenTopic(openTopic === topic.id ? null : topic.id)}
                                    className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left font-bold text-sm text-foreground"
                                >
                                    <span>{topic.trigger}</span>
                                    <ChevronDown
                                        size={16}
                                        className={cn("text-muted-foreground shrink-0 transition-transform duration-200", openTopic === topic.id ? "rotate-180" : "")}
                                    />
                                </button>
                                <AnimatePresence>
                                    {openTopic === topic.id && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="p-4 pt-0 text-sm border-t border-border/50 bg-background/30">
                                                <div className="pt-4">
                                                    {topic.content}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Legal Links */}
                <div className="p-4 bg-muted/50 rounded-2xl border border-border/50 space-y-4">
                    <p className="font-bold text-foreground">Rechtliches</p>
                    <div className="flex flex-col gap-2">
                        <a href="/imprint" target="_blank" className="text-sm text-primary hover:underline flex items-center gap-2">
                            <Info size={14} /> Impressum
                        </a>
                        <a href="/terms" target="_blank" className="text-sm text-primary hover:underline flex items-center gap-2">
                            <Info size={14} /> Nutzungsbedingungen (Terms)
                        </a>
                        <a href="/privacy" target="_blank" className="text-sm text-primary hover:underline flex items-center gap-2">
                            <Info size={14} /> Datenschutzerklärung (Privacy)
                        </a>
                    </div>
                </div>
            </div>
        </Card>
    );
}
