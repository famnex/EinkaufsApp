const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

async function updateEmail() {
    const dbPath = path.resolve(__dirname, '../database.sqlite');
    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: dbPath,
        logging: console.log,
    });

    const User = sequelize.define('User', {
        username: { type: DataTypes.STRING, allowNull: false, unique: true },
        email: { type: DataTypes.STRING, allowNull: true, unique: true }
    });

    try {
        await sequelize.authenticate();
        console.log('Connected to database.');

        const user = await User.findOne({ where: { username: 'famnex' } });
        if (!user) {
            console.log('User famnex not found.');
            return;
        }

        console.log(`Updating email for ${user.username} from ${user.email} to fleischer.steffen@googlemail.com`);
        await user.update({ email: 'fleischer.steffen@googlemail.com' });
        console.log('Email updated successfully.');

    } catch (error) {
        console.error('Error updating email:', error);
    } finally {
        await sequelize.close();
    }
}

updateEmail();
