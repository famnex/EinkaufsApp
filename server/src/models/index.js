const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../database.sqlite'),
    logging: false,
});

const User = sequelize.define('User', {
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    role: { type: DataTypes.ENUM('admin', 'user'), defaultValue: 'user' },
    isLdap: { type: DataTypes.BOOLEAN, defaultValue: false }
});

const Manufacturer = sequelize.define('Manufacturer', {
    name: { type: DataTypes.STRING, allowNull: false, unique: true }
});

const Store = sequelize.define('Store', {
    name: { type: DataTypes.STRING, allowNull: false, unique: true }
});

const Product = sequelize.define('Product', {
    name: { type: DataTypes.STRING, allowNull: false },
    category: { type: DataTypes.STRING },
    price_hint: { type: DataTypes.DECIMAL(10, 2) }
});

Product.belongsTo(Manufacturer);
Product.belongsTo(Store);

const List = sequelize.define('List', {
    date: { type: DataTypes.DATEONLY, allowNull: false },
    status: { type: DataTypes.ENUM('active', 'completed', 'archived'), defaultValue: 'active' },
    total_cost: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00 }
});

const ListItem = sequelize.define('ListItem', {
    quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
    is_bought: { type: DataTypes.BOOLEAN, defaultValue: false },
    price_actual: { type: DataTypes.DECIMAL(10, 2) }
});

ListItem.belongsTo(List);
ListItem.belongsTo(Product);
List.hasMany(ListItem);

const Menu = sequelize.define('Menu', {
    date: { type: DataTypes.DATEONLY, allowNull: false },
    meal_type: { type: DataTypes.ENUM('breakfast', 'lunch', 'dinner', 'snack'), defaultValue: 'lunch' },
    description: { type: DataTypes.TEXT }
});

const Expense = sequelize.define('Expense', {
    title: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    category: { type: DataTypes.STRING }
});

module.exports = {
    sequelize,
    User,
    Manufacturer,
    Store,
    Product,
    List,
    ListItem,
    Menu,
    Expense
};
