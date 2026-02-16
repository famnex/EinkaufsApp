import { sortIngredientsBySteps } from './client/src/lib/recipe-parser.js';

const ingredients = [
    { id: 1, name: 'Salz' },
    { id: 2, name: 'Pfeffer' },
    { id: 3, name: 'Öl' },
    { id: 4, name: 'Wasser' }
];

const steps = [
    'Zuerst Öl in die Pfanne geben, dann Salz und Pfeffer hinzufügen.',
    'Danach mit Wasser ablöschen.'
];

console.log('Original ingredients:', ingredients.map(i => i.name));

const sorted = sortIngredientsBySteps(ingredients, steps);

console.log('Sorted ingredients:', sorted.map(i => i.name));

// Expected order: Öl, Salz, Pfeffer, Wasser
const expected = ['Öl', 'Salz', 'Pfeffer', 'Wasser'];
const actual = sorted.map(i => i.name);

if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log('✅ TEST PASSED');
} else {
    console.log('❌ TEST FAILED');
    console.log('Expected:', expected);
    console.log('Actual:', actual);
    process.exit(1);
}
