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
 * Handles duplicate ingredients: the Nth text occurrence of a name is mapped
 * to the Nth ingredient entry with that name in the list.
 *
 * @param {string} stepText
 * @param {Array} ingredients - Array of ingredient objects { id, name, ... }
 * @param {Object} occurrencesBefore - { normalizedName -> count } of how many times
 *   each ingredient name was seen in PREVIOUS steps. Pass {} for the first step.
 * @returns {{ matches: Array, localOccurrences: Object }}
 *   matches: [{ ingredientId, ingredient, matchedText, index, length, type }]
 *   localOccurrences: { name -> count } for THIS step only (accumulate externally)
 */
export function findIngredientsInText(stepText, ingredients, occurrencesBefore = {}) {
    const matches = [];
    if (!stepText) return { matches, localOccurrences: {} };

    const lowerStep = stepText.toLowerCase();
    const localOccurrences = {}; // name -> count within this step

    // Group ingredients by normalised name to handle duplicates
    const nameGroups = {}; // normalizedName -> [ing, ing, ...]
    ingredients.forEach(ing => {
        const key = ing.name.toLowerCase();
        if (!nameGroups[key]) nameGroups[key] = [];
        nameGroups[key].push(ing);
    });

    // Strategy 1: Exact / Substring Match
    // We sort ingredients by length (desc) to match "Olivenöl" before "Öl"
    const sortedIngredients = [...ingredients].sort((a, b) => b.name.length - a.name.length);

    // Keep track of matched ranges to avoid overlapping matches
    const matchedRanges = []; // [start, end]
    const isOverlapping = (start, end) => {
        return matchedRanges.some(r => (start < r[1] && end > r[0]));
    };

    /**
     * Pick the right ingredient from the name group based on global occurrence count.
     * Increments the local counter for that name.
     */
    const pickIngredient = (key) => {
        const globalIdx = (occurrencesBefore[key] || 0) + (localOccurrences[key] || 0);
        localOccurrences[key] = (localOccurrences[key] || 0) + 1;
        const group = nameGroups[key] || [];
        return group[Math.min(globalIdx, group.length - 1)] || group[0];
    };

    // Track which names have been processed so we don't double-process duplicates
    const processedNames = new Set();

    sortedIngredients.forEach(ing => {
        const namesToTry = [ing.name.toLowerCase()];
        if (ing.originalName && ing.originalName.toLowerCase() !== namesToTry[0]) {
            namesToTry.push(ing.originalName.toLowerCase());
        }

        namesToTry.forEach(lowerName => {
            // Skip stop words and already-processed names (within this ingredient's context)
            if (STOP_WORDS.has(lowerName)) return;

            // --- RULE 1: Strict "Ei"/"Eier" Check ---
            if (lowerName === 'ei' || lowerName === 'eier') {
                const regex = new RegExp(`\\b${lowerName}\\b`, 'gi');
                const iter = stepText.matchAll(regex);
                for (const m of iter) {
                    const start = m.index;
                    const end = start + m[0].length;
                    const matchedText = m[0].toLowerCase();

                    if (!isOverlapping(start, end) && !STOP_WORDS.has(matchedText)) {
                        const expanded = expandToWordBoundaries(stepText, start, end);
                        const chosenIng = pickIngredient(ing.name.toLowerCase());
                        matches.push({
                            ingredientId: chosenIng.id,
                            ingredient: chosenIng,
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

            // Standard Substring Match
            let idx = lowerStep.indexOf(lowerName);
            while (idx !== -1) {
                const end = idx + lowerName.length;
                const matchedText = stepText.substring(idx, end).toLowerCase();

                if (!isOverlapping(idx, end) && !STOP_WORDS.has(matchedText)) {
                    const expanded = expandToWordBoundaries(stepText, idx, end);
                    const chosenIng = pickIngredient(ing.name.toLowerCase());
                    matches.push({
                        ingredientId: chosenIng.id,
                        ingredient: chosenIng,
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
    });

    // Strategy 1b: Synonym Matching
    // For ingredients that haven't been matched yet (or that still have unmatched slots),
    // try all their synonyms as substring matches. This is more precise than suffix/fuzzy.
    sortedIngredients.forEach(ing => {
        const lowerName = ing.name.toLowerCase();
        if (STOP_WORDS.has(lowerName)) return;
        if (!ing.synonyms || ing.synonyms.length === 0) return;

        ing.synonyms.forEach(syn => {
            const lowerSyn = (syn || '').toLowerCase().trim();
            if (!lowerSyn || lowerSyn.length < 2 || STOP_WORDS.has(lowerSyn)) return;

            let idx = lowerStep.indexOf(lowerSyn);
            while (idx !== -1) {
                const end = idx + lowerSyn.length;
                const matchedText = stepText.substring(idx, end).toLowerCase();

                if (!isOverlapping(idx, end) && !STOP_WORDS.has(matchedText)) {
                    const expanded = expandToWordBoundaries(stepText, idx, end);
                    // Use the ingredient's main name key so occurrence tracking is consistent
                    const chosenIng = pickIngredient(lowerName);
                    matches.push({
                        ingredientId: chosenIng.id,
                        ingredient: chosenIng,
                        matchedText: expanded.text,
                        index: expanded.start,
                        length: expanded.text.length,
                        type: 'synonym'
                    });
                    matchedRanges.push([expanded.start, expanded.end]);
                }
                idx = lowerStep.indexOf(lowerSyn, end);
            }
        });
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
            const key = foundIng.name.toLowerCase();
            const expanded = expandToWordBoundaries(stepText, start, end);
            const chosenIng = pickIngredient(key);
            matches.push({
                ingredientId: chosenIng.id,
                ingredient: chosenIng,
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
                    const key = lowerIngName;
                    const expanded = expandToWordBoundaries(stepText, start, end);
                    const chosenIng = pickIngredient(key);
                    matches.push({
                        ingredientId: chosenIng.id,
                        ingredient: chosenIng,
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

    return {
        matches: matches.sort((a, b) => a.index - b.index),
        localOccurrences
    };
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
    let occurrencesBefore = {}; // cumulative counts for sorting

    steps.forEach((step, stepIdx) => {
        const { matches, localOccurrences } = findIngredientsInText(step, ingredients, occurrencesBefore);
        matches.forEach(m => {
            if (firstAppearance[m.ingredientId] === undefined) {
                firstAppearance[m.ingredientId] = {
                    stepIdx,
                    matchIdx: m.index
                };
            }
        });

        // Accumulate for next step
        const next = { ...occurrencesBefore };
        Object.entries(localOccurrences).forEach(([k, v]) => {
            next[k] = (next[k] || 0) + v;
        });
        occurrencesBefore = next;
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
            // Extract a meaningful label: the last word before the next '.', 'und', or ','
            // (whichever comes first after the time match)
            let label = m[0]; // Fallback: the raw duration string (e.g. "10 Min")
            const afterMatch = text.substring(m.index + m[0].length);

            // Find the position of each delimiter after the match
            const delimiters = [
                { char: '.', idx: afterMatch.indexOf('.') },
                { char: ',', idx: afterMatch.indexOf(',') },
                // 'und' as a word boundary (not part of a word)
                { char: 'und', idx: (() => { const r = afterMatch.search(/\bund\b/i); return r; })() }
            ].filter(d => d.idx !== -1);

            // Take the earliest delimiter
            const nearest = delimiters.reduce((min, d) => d.idx < min.idx ? d : min,
                { idx: Infinity });

            if (nearest.idx !== Infinity) {
                // Segment from after the time to the delimiter
                const segment = afterMatch.substring(0, nearest.idx).trim();
                // Grab the last meaningful word in that segment (skip short/empty)
                const words = segment.match(/[\wäöüÄÖÜß]+/g);
                if (words && words.length > 0) {
                    // Skip weak/auxiliary verbs at the end – use the word before them
                    const SKIP_WORDS = new Set([
                        'lassen', 'werden', 'sein', 'haben',
                        'können', 'müssen', 'sollen', 'dürfen', 'wollen', 'mögen',
                        'bleiben', 'stehen', 'liegen', 'stellen', 'geben',
                    ]);
                    let pick = words.length - 1;
                    while (pick > 0 && SKIP_WORDS.has(words[pick].toLowerCase())) {
                        pick--;
                    }
                    const candidate = words[pick];
                    if (candidate && candidate.length > 1) {
                        label = candidate;
                    }
                }
            } else {
                // No delimiter found: fall back to first word after the match
                const nextWordMatch = afterMatch.trim().match(/^[\wäöüÄÖÜß]+/);
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
