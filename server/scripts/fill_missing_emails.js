const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

async function fillMissingEmails() {
    const dbPath = path.resolve(__dirname, '../database.sqlite');
    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: dbPath,
        logging: false,
    });

    const User = sequelize.define('User', {
        username: { type: DataTypes.STRING, allowNull: false, unique: true },
        email: { type: DataTypes.STRING, allowNull: true },
    });

    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        const users = await User.findAll();
        console.log(`Found ${users.length} users.`);

        for (const user of users) {
            if (!user.email || user.email.trim() === '') {
                const placeholderEmail = `${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}@gabelguru.local`;
                console.log(`Assigning ${placeholderEmail} to user ${user.username}...`);
                await user.update({ email: placeholderEmail });
            }
        }

        console.log('All users have emails now.');

    } catch (error) {
        console.error('Error filling emails:', error);
    } finally {
        await sequelize.close();
    }
}

fillMissingEmails();
