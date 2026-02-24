const { User, CreditTransaction } = require('../models');

/**
 * Service to manage AI credits (coins)
 */
const creditService = {
    /**
     * Costs for different AI actions based on user tier
     */
    COSTS: {
        'TEXT': {
            'Plastikgabel': 0, // Should be blocked anyway
            'Silbergabel': 5,
            'Goldgabel': 0
        },
        'IMAGE': {
            'Plastikgabel': 0, // Should be blocked anyway
            'Silbergabel': 60,
            'Goldgabel': 40
        }
    },

    /**
     * Gets the cost for an action based on user tier
     */
    getCost(type, tier) {
        if (!this.COSTS[type]) return 0;
        return this.COSTS[type][tier] || 0;
    },

    /**
     * Deducts credits from a user
     * @param {number} userId 
     * @param {string} type 'TEXT' or 'IMAGE'
     * @param {string} description Reason for transaction
     * @returns {Promise<boolean>} Success
     */
    async deductCredits(userId, type, description) {
        let user = await User.findByPk(userId);
        if (!user) throw new Error('User not found');

        // Household logic: always deduct from owner
        const effectiveUserId = user.householdId || user.id;
        const effectiveUser = effectiveUserId === user.id ? user : await User.findByPk(effectiveUserId);

        if (!effectiveUser) throw new Error('Owner not found');

        const cost = this.getCost(type, effectiveUser.tier);
        if (cost === 0) return true; // Free action

        const balance = parseFloat(effectiveUser.aiCredits || 0);
        if (balance < cost) {
            throw new Error('Nicht genügend Credits vorhanden.');
        }

        const newBalance = (balance - cost).toFixed(2);

        // Enrich description if it was a member action
        const finalDescription = effectiveUserId !== userId
            ? `${description} (durch ${user.username})`
            : description;

        await sequelize.transaction(async (t) => {
            await effectiveUser.update({ aiCredits: newBalance }, { transaction: t });
            await CreditTransaction.create({
                UserId: effectiveUserId,
                delta: -cost,
                description: finalDescription,
                type: 'usage'
            }, { transaction: t });
        });

        return true;
    },

    /**
     * Adds credits to a user (e.g. monthly refill or purchase)
     */
    async addCredits(userId, amount, description) {
        let user = await User.findByPk(userId);
        if (!user) throw new Error('User not found');

        const effectiveUserId = user.householdId || user.id;
        const effectiveUser = effectiveUserId === user.id ? user : await User.findByPk(effectiveUserId);

        if (!effectiveUser) throw new Error('Owner not found');

        const balance = parseFloat(effectiveUser.aiCredits || 0);
        const newBalance = (balance + amount).toFixed(2);

        await sequelize.transaction(async (t) => {
            await effectiveUser.update({ aiCredits: newBalance }, { transaction: t });
            await CreditTransaction.create({
                UserId: effectiveUserId,
                delta: amount,
                description,
                type: 'booking'
            }, { transaction: t });
        });

        return true;
    }
};

const { sequelize } = require('../models'); // Needed for transactions

module.exports = creditService;
