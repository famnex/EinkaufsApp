/**
 * Calculates Levenshtein distance between two strings
 * @param {string} a 
 * @param {string} b 
 * @returns {number}
 */
export function getLevenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    // increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1 // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Normalizes text for comparison (lower case, trim, remove punctuation)
 */
function normalize(str) {
    return str.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
}

/**
 * Expands a range to full word boundaries
 */
function expandToWordBoundaries(text, start, end) {
    const isWordChar = (char) => /[\wäöüÄÖÜß]/i.test(char);
    let newStart = start;
    let newEnd = end;

    while (newStart > 0 && isWordChar(text[newStart - 1])) {
        newStart--;
    }
    while (newEnd < text.length && isWordChar(text[newEnd])) {
        newEnd++;
    }

    return {
        start: newStart,
        end: newEnd,
        text: text.substring(newStart, newEnd)
    };
}

/**
 * Stop words list (German) - these are excluded from ingredient matching
 */
const STOP_WORDS = new Set([
    // Konjunktionen / Satzwörter
    'und', 'oder', 'aber', 'denn', 'doch', 'jedoch', 'sondern', 'weil', 'da', 'wenn', 'falls', 'ob', 'wie', 'als',
    'dass', 'damit', 'sobald', 'solange', 'während', 'bevor', 'nachdem', 'obwohl', 'wennauch', 'sowie',

    // Präpositionen
    'mit', 'ohne', 'für', 'von', 'bis', 'aus', 'bei', 'nach', 'zu', 'vor', 'an', 'auf', 'über', 'unter', 'zwischen',
    'gegen', 'durch', 'entlang', 'innerhalb', 'außerhalb', 'trotz', 'während', 'seit', 'ab', 'um', 'pro',

    // Artikel / Pronomen / Determinanten
    'der', 'die', 'das', 'dem', 'den', 'des',
    'ein', 'eine', 'einer', 'eines', 'einem', 'einen',
    'dies', 'diese', 'dieser', 'dieses', 'jenes', 'jene', 'jener',
    'mein', 'meine', 'meiner', 'meines', 'meinem', 'meinen',
    'dein', 'deine', 'deiner', 'deines', 'deinem', 'deinen',
    'sein', 'seine', 'seiner', 'seines', 'seinem', 'seinen',
    'ihr', 'ihre', 'ihrer', 'ihres', 'ihrem', 'ihren',
    'unser', 'unsere', 'unserer', 'unseres', 'unserem', 'unseren',
    'euer', 'eure', 'eurer', 'eures', 'eurem', 'euren',
    'man', 'jemand', 'niemand', 'alle', 'alles', 'jeder', 'jede', 'jedes',

    // Verschmelzungen
    'am', 'im', 'vom', 'zum', 'zur', 'ins', 'ans', 'ums', 'aufs', 'übers', 'unters', 'beim', 'beim', 'beiden',

    // Häufige Rezept-Adverbien / Füllwörter
    'so', 'dann', 'nur', 'auch', 'noch', 'schon', 'mal', 'sehr', 'etwa', 'vielleicht', 'gar', 'gerade', 'eben', 'halt',
    'bitte', 'einfach', 'kurz', 'lange', 'sofort', 'zuerst', 'danach', 'anschließend', 'zumindest', 'gegebenenfalls',
    'optional', 'alternativ', 'nachbelieben', 'nachgeschmack', 'eventuell', 'idealerweise', 'am besten',

    // Zeit / Reihenfolge
    'min', 'mins', 'minute', 'minuten', 'sek', 'sekunde', 'sekunden', 'stunde', 'stunden',
    'zeit', 'dauer', 'währenddessen', 'zwischendurch', 'gleichzeitig',

    // Temperatur / Garstufen / Gerät
    'grad', '°c', 'c', 'heiß', 'warm', 'kalt', 'lauwarm', 'handwarm',
    'vorheizen', 'aufheizen', 'abkühlen', 'kühlen', 'einfrieren', 'auftauen',
    'ofen', 'backofen', 'herd', 'pfanne', 'topf', 'kochtopf', 'dampfgarer', 'mikrowelle', 'airfryer', 'heißluftfritteuse',
    'grill', 'wasserbad',

    // Mengen- & Maßwörter (typisch: keine Zutaten)
    'g', 'gramm', 'kg', 'kilo', 'kilogramm',
    'ml', 'milliliter', 'l', 'liter', 'cl',
    'el', 'esslöffel', 'tl', 'teelöffel',
    'prise', 'prisen', 'messerspitze',
    'tasse', 'tassen', 'becher', 'schuss', 'spritzer',
    'stück', 'stücke', 'scheibe', 'scheiben', 'würfel', 'würfeln',
    'handvoll', 'bund', 'päckchen', 'packung', 'dose', 'glas', 'flasche',
    'portion', 'portionen',

    // Mengen-/Qualitätsangaben (eher keine Zutaten)
    'etwas', 'wenig', 'weniger', 'mehr', 'viel', 'viele', 'genug', 'reichlich', 'ca', 'circa', 'ungefähr', 'knapp',
    'groß', 'große', 'großer', 'großes', 'klein', 'kleine', 'kleiner', 'kleines', 'mittel', 'mittlere', 'mittlerer', 'mittleres',
    'dünn', 'dick', 'fein', 'grob',
    'frisch', 'tiefgekühlt', 'gefroren', 'aufgetaut',
    'trocken', 'nass',

    // Küchenverben / Zubereitung (Grundformen)
    'schneiden', 'hacken', 'würfeln', 'reiben', 'raspeln', 'zupfen', 'zerdrücken', 'stampfen', 'pürieren',
    'mischen', 'vermengen', 'verrühren', 'rühren', 'schlagen', 'unterheben', 'kneten', 'formen',
    'braten', 'anbraten', 'dünsten', 'schmoren', 'kochen', 'aufkochen', 'köcheln', 'sieden', 'backen', 'grillen', 'frittieren',
    'erhitzen', 'schmelzen', 'ablöschen', 'reduzieren', 'einkochen',
    'abschmecken', 'würzen', 'salzen', 'pfeffern',
    'servieren', 'anrichten', 'garnieren',

    // Typische Anweisungswörter
    'geben', 'hinzugeben', 'dazugeben', 'hinzufügen', 'zugeben', 'einrühren', 'unterrühren',
    'verteilen', 'bestreichen', 'belegen', 'füllen', 'aufstreichen',
    'abgießen', 'abseihen', 'waschen', 'schälen', 'entkernen', 'putzen',
    'dekorieren', 'optional', 'nach', 'belieben',

    // Konsistenz / Zustand
    'bis', 'dass', 'damit', 'sobald', 'solange',
    'glatt', 'cremig', 'sämig', 'dicklich', 'flüssig', 'fest', 'weich', 'knusprig', 'goldbraun', 'durch',
    'al', 'dente'
]);

/**
 * Finds all occurrences of ingredients in a text step.
 * Returns an array of matches with metadata.
 * 
 * @param {string} stepText 
 * @param {Array} ingredients - Array of ingredient objects { id, name, ... }
 * @returns {Array} - [{ ingredientId, name, matchedText, index, length }]
 */
export function findIngredientsInText(stepText, ingredients) {
    const matches = [];
    if (!stepText) return matches;

    const lowerStep = stepText.toLowerCase();

    // Strategy 1: Exact / Substing Match
    // We sort ingredients by length (desc) to match "Olivenöl" before "Öl"
    const sortedIngredients = [...ingredients].sort((a, b) => b.name.length - a.name.length);

    // Keep track of matched ranges to avoid overlapping matches
    const matchedRanges = []; // [start, end]

    const isOverlapping = (start, end) => {
        return matchedRanges.some(r => (start < r[1] && end > r[0]));
    };

    sortedIngredients.forEach(ing => {
        const lowerName = ing.name.toLowerCase();

        // Skip if ingredient name itself is a stop word
        if (STOP_WORDS.has(lowerName)) return;

        // --- RULE 1: Strict "Ei"/"Eier" Check ---
        if (lowerName === 'ei' || lowerName === 'eier') {
            const regex = new RegExp(`\\b${ing.name}\\b`, 'gi');
            const iter = stepText.matchAll(regex);
            for (const m of iter) {
                const start = m.index;
                const end = start + m[0].length;
                const matchedText = m[0].toLowerCase();

                if (!isOverlapping(start, end) && !STOP_WORDS.has(matchedText)) {
                    const expanded = expandToWordBoundaries(stepText, start, end);
                    matches.push({
                        ingredientId: ing.id,
                        ingredient: ing,
                        matchedText: expanded.text,
                        index: expanded.start,
                        length: expanded.text.length,
                        type: 'exact-strict'
                    });
                    matchedRanges.push([expanded.start, expanded.end]);
                }
            }
            return;
        }

        // Standard Substring Match for others
        let idx = lowerStep.indexOf(lowerName);
        while (idx !== -1) {
            const end = idx + lowerName.length;
            const matchedText = stepText.substring(idx, end).toLowerCase();

            if (!isOverlapping(idx, end) && !STOP_WORDS.has(matchedText)) {
                const expanded = expandToWordBoundaries(stepText, idx, end);
                matches.push({
                    ingredientId: ing.id,
                    ingredient: ing,
                    matchedText: expanded.text,
                    index: expanded.start,
                    length: expanded.text.length,
                    type: 'exact'
                });
                matchedRanges.push([expanded.start, expanded.end]);
            }
            idx = lowerStep.indexOf(lowerName, end);
        }
    });

    // Strategy 2: Reverse Search (Compound / Suffix Match)
    const wordIter = stepText.matchAll(/[\wäöüÄÖÜß]+/g);
    for (const m of wordIter) {
        const word = m[0];
        const start = m.index;
        const end = start + word.length;
        const lowerWord = word.toLowerCase();

        if (isOverlapping(start, end) || STOP_WORDS.has(lowerWord)) continue;

        if (word.length < 3) continue;

        const foundIng = sortedIngredients.find(ing => {
            const lowerIngName = ing.name.toLowerCase();
            return lowerIngName.endsWith(lowerWord) && !STOP_WORDS.has(lowerIngName);
        });

        if (foundIng) {
            const expanded = expandToWordBoundaries(stepText, start, end);
            matches.push({
                ingredientId: foundIng.id,
                ingredient: foundIng,
                matchedText: expanded.text,
                index: expanded.start,
                length: expanded.text.length,
                type: 'reverse-suffix'
            });
            matchedRanges.push([expanded.start, expanded.end]);
        }
    }

    // Strategy 3: Fuzzy / Fallback
    const remainingWordIter = stepText.matchAll(/[\wäöüÄÖÜß]+/g);
    for (const m of remainingWordIter) {
        const word = m[0];
        const start = m.index;
        const end = start + word.length;
        const lowerWord = word.toLowerCase();

        if (isOverlapping(start, end) || STOP_WORDS.has(lowerWord)) continue;

        sortedIngredients.forEach(ing => {
            const lowerIngName = ing.name.toLowerCase();
            if (STOP_WORDS.has(lowerIngName)) return;

            if (Math.abs(ing.name.length - word.length) > 3) return;

            const dist = getLevenshteinDistance(normalize(ing.name), normalize(word));

            let threshold = 0;
            if (ing.name.length > 6) threshold = 2;
            else if (ing.name.length > 3) threshold = 1;

            if (dist <= threshold && dist > 0) {
                if (!isOverlapping(start, end)) {
                    const expanded = expandToWordBoundaries(stepText, start, end);
                    matches.push({
                        ingredientId: ing.id,
                        ingredient: ing,
                        matchedText: expanded.text,
                        index: expanded.start,
                        length: expanded.text.length,
                        type: 'fuzzy'
                    });
                    matchedRanges.push([expanded.start, expanded.end]);
                }
            }
        });
    }

    return matches.sort((a, b) => a.index - b.index);
}

/**
 * Sorts ingredients based on the step index where they FIRST appear.
 * Ingredients not in any step appear at the end.
 * @param {Array} ingredients 
 * @param {Array} steps 
 * @returns {Array} Sorted ingredients
 */
export function sortIngredientsBySteps(ingredients, steps) {
    if (!steps || steps.length === 0) return ingredients;

    const firstAppearance = {}; // ingId -> { stepIdx, matchIdx }

    steps.forEach((step, stepIdx) => {
        const matches = findIngredientsInText(step, ingredients);
        matches.forEach(m => {
            if (firstAppearance[m.ingredientId] === undefined) {
                firstAppearance[m.ingredientId] = {
                    stepIdx,
                    matchIdx: m.index
                };
            }
        });
    });

    return [...ingredients].sort((a, b) => {
        const appearanceA = firstAppearance[a.id] || { stepIdx: 9999, matchIdx: 9999 };
        const appearanceB = firstAppearance[b.id] || { stepIdx: 9999, matchIdx: 9999 };

        if (appearanceA.stepIdx !== appearanceB.stepIdx) {
            return appearanceA.stepIdx - appearanceB.stepIdx;
        }
        return appearanceA.matchIdx - appearanceB.matchIdx;
    });
}
/**
 * Finds all occurrences of time durations (min, sek, h) in a text.
 * Returns an array of matches with metadata.
 * 
 * @param {string} text 
 * @returns {Array} - [{ totalSeconds, matchedText, index, length }]
 */
export function findTimesInText(text) {
    const matches = [];
    if (!text) return matches;

    // Pattern for times: numbers followed by units
    // Handles: 10 Min, 5 Sekunden, 1.5 Stunden, 1 h, etc.
    const timeRegex = /(\d+(?:[.,]\d+)?)\s*(min(?:uten?)?|sek(?:unden?)?|std|stunden?|h)\b/gi;

    const iter = text.matchAll(timeRegex);
    for (const m of iter) {
        const value = parseFloat(m[1].replace(',', '.'));
        const unit = m[2].toLowerCase();
        let totalSeconds = 0;

        if (unit.startsWith('sek')) {
            totalSeconds = value;
        } else if (unit.startsWith('min')) {
            totalSeconds = value * 60;
        } else if (unit.startsWith('std') || unit.startsWith('stunden') || unit === 'h') {
            totalSeconds = value * 3600;
        }

        if (totalSeconds > 0) {
            // Check for following word as label
            let label = m[0]; // Fallback to duration string
            const afterMatch = text.substring(m.index + m[0].length).trim();
            if (afterMatch && !afterMatch.startsWith('.') && !afterMatch.startsWith(',')) {
                // Peek at the next word
                const nextWordMatch = afterMatch.match(/^[\wäöüÄÖÜß]+/);
                if (nextWordMatch && nextWordMatch[0].length > 1) {
                    label = nextWordMatch[0];
                }
            }

            matches.push({
                totalSeconds,
                matchedText: m[0],
                label,
                index: m.index,
                length: m[0].length,
                type: 'time'
            });
        }
    }

    return matches;
}
