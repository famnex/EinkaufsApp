const creditService = require('./server/src/services/creditService');

async function test() {
    console.log('--- Testing Rainbowspoon Costs ---');
    ['Rainbowspoon', 'Regenbogengabel'].forEach(tier => {
        ['TEXT', 'IMAGE', 'RECIPE_MODIFY'].forEach(action => {
            const cost = creditService.getCost(tier, action);
            console.log(`Tier: ${tier}, Action: ${action}, Cost: ${cost} -> ${cost === 0 ? 'OK' : 'FAIL'}`);
        });
    });
}
test();
