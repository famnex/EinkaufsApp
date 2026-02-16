const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

async function checkEmails() {
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

        const emailMap = {};
        const missingEmails = [];
        const duplicateEmails = [];

        users.forEach(user => {
            if (!user.email) {
                missingEmails.push(user.username);
            } else {
                const email = user.email.toLowerCase();
                if (emailMap[email]) {
                    duplicateEmails.push({ email: email, users: [emailMap[email], user.username] });
                } else {
                    emailMap[email] = user.username;
                }
            }
        });

        if (missingEmails.length > 0) {
            console.log('WARNING: The following users have no email:', missingEmails);
            console.log('These users will not be able to login if we switch to email-only login!');
        } else {
            console.log('All users have an email address.');
        }

        if (duplicateEmails.length > 0) {
            console.log('WARNING: The following emails are used by multiple users:', duplicateEmails);
            console.log('These users will face issues with email login!');
        } else {
            console.log('All emails are unique.');
        }

    } catch (error) {
        console.error('Unable to connect to the database:', error);
    } finally {
        await sequelize.close();
    }
}

checkEmails();
