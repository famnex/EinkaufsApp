const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
    try {
        console.log('Starting migration v0.29.3 (Newsletter System)...');

        // Create Newsletters table
        await queryInterface.createTable('Newsletters', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            subject: {
                type: DataTypes.STRING,
                allowNull: false
            },
            body: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            status: {
                type: DataTypes.ENUM('draft', 'sending', 'completed', 'failed'),
                defaultValue: 'draft'
            },
            recipientsCount: {
                type: DataTypes.INTEGER,
                defaultValue: 0
            },
            sentCount: {
                type: DataTypes.INTEGER,
                defaultValue: 0
            },
            failedCount: {
                type: DataTypes.INTEGER,
                defaultValue: 0
            },
            batchSize: {
                type: DataTypes.INTEGER,
                defaultValue: 50
            },
            waitMinutes: {
                type: DataTypes.INTEGER,
                defaultValue: 5
            },
            footer: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false
            }
        });

        // Create NewsletterRecipients table
        await queryInterface.createTable('NewsletterRecipients', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            NewsletterId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'Newsletters',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            UserId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'Users',
                    key: 'id'
                }
            },
            status: {
                type: DataTypes.ENUM('pending', 'sent', 'failed'),
                defaultValue: 'pending'
            },
            error: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            sentAt: {
                type: DataTypes.DATE,
                allowNull: true
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false
            }
        });

        console.log('Migration v0.29.3 completed successfully.');
    } catch (error) {
        console.error('Migration v0.29.3 failed:', error);
        throw error;
    }
}

async function down({ context: queryInterface }) {
    await queryInterface.dropTable('NewsletterRecipients');
    await queryInterface.dropTable('Newsletters');
}

if (require.main === module) {
    const { sequelize } = require('../src/models');
    up({ context: sequelize.getQueryInterface() })
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = { up, down };
