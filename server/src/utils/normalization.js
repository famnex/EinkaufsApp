/**
 * Normalizes a German product name to its singular base form for comparison.
 * @param {string} name - The product name to normalize
 * @returns {string[]} - An array of potential singular forms (and the original)
 */
function normalizeGermanProduct(name) {
    if (!name) return [];

    const term = name.trim().toLowerCase();
    const variations = new Set([term]);

    // Common German Plural Suffixes: -n, -en, -e, -s, -er
    // We try stripping them to find a singular match.
    // Note: This is "fuzzy" and over-generates, but we only use it to QUERY the DB/List.

    const suffixes = ['n', 'en', 'e', 's', 'er'];

    for (const suffix of suffixes) {
        if (term.endsWith(suffix)) {
            // Remove suffix
            const base = term.slice(0, -suffix.length);
            if (base.length > 2) { // Avoid stripping too short words
                variations.add(base);

                // Special case: Umlauts often change in plural (Apfel -> Äpfel) but usually we just want to match strings.
                // If we really want robust matching, we might need a mapping or check both ways.
                // For now, simple suffix stripping.
            }
        }
    }

    // Also try ADDING suffixes to the input (if input is singular, but DB has plural)
    for (const suffix of suffixes) {
        variations.add(term + suffix);
    }

    // Umlaut normalization (optional, but helpful: Äpfel -> Apfel is hard without dictionary, 
    // but maybe we ignore case/accent?)
    // For now, let's stick to suffix stemming.

    return Array.from(variations);
}

module.exports = { normalizeGermanProduct };
