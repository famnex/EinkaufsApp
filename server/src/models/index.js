const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Ensure consistent path relative to server root
const dbPath = path.resolve(__dirname, '../../database.sqlite');
console.log('Database Path:', dbPath); // Debug Log

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false, // Set to console.log to see SQL queries if needed
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
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    logo_url: { type: DataTypes.STRING, allowNull: true }
});

const Product = sequelize.define('Product', {
    name: { type: DataTypes.STRING, allowNull: false },
    category: { type: DataTypes.STRING },
    price_hint: { type: DataTypes.DECIMAL(10, 2) },
    unit: { type: DataTypes.ENUM('Stück', 'g', 'kg', 'ml', 'l'), defaultValue: 'Stück' }
});

Product.belongsTo(Manufacturer);
Product.belongsTo(Store);

const List = sequelize.define('List', {
    name: { type: DataTypes.STRING, allowNull: true },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    status: { type: DataTypes.ENUM('active', 'completed', 'archived'), defaultValue: 'active' },
    total_cost: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00 }
});

List.belongsTo(Store, { as: 'CurrentStore', foreignKey: 'CurrentStoreId' });

const ListItem = sequelize.define('ListItem', {
    quantity: { type: DataTypes.FLOAT, defaultValue: 1 },
    unit: { type: DataTypes.STRING }, // Allow custom unit override
    is_bought: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_committed: { type: DataTypes.BOOLEAN, defaultValue: false }, // "Locked" in store history
    sort_order: { type: DataTypes.FLOAT, defaultValue: 0 }, // For manual ordering
    sort_store_id: { type: DataTypes.INTEGER, allowNull: true }, // Store context for sort_order
    bought_at: { type: DataTypes.DATE }, // Track when item was bought
    price_actual: { type: DataTypes.DECIMAL(10, 2) },
    MenuId: { type: DataTypes.INTEGER, allowNull: true } // Track origin menu
});

ListItem.belongsTo(List);
ListItem.belongsTo(Product);
List.hasMany(ListItem);

const ProductRelation = sequelize.define('ProductRelation', {
    StoreId: { type: DataTypes.INTEGER, allowNull: false }, // Context
    PredecessorId: { type: DataTypes.INTEGER, allowNull: false },
    SuccessorId: { type: DataTypes.INTEGER, allowNull: false },
    weight: { type: DataTypes.INTEGER, defaultValue: 1 }
});

ProductRelation.belongsTo(Store);
ProductRelation.belongsTo(Product, { as: 'Predecessor', foreignKey: 'PredecessorId' });
ProductRelation.belongsTo(Product, { as: 'Successor', foreignKey: 'SuccessorId' });
Store.hasMany(ProductRelation);

const Menu = sequelize.define('Menu', {
    date: { type: DataTypes.DATEONLY, allowNull: false },
    meal_type: { type: DataTypes.ENUM('breakfast', 'lunch', 'dinner', 'snack'), defaultValue: 'lunch' },
    description: { type: DataTypes.TEXT }, // Manual entry
    // RecipeId will be added automatically by association, but we can depend on it
});

const Expense = sequelize.define('Expense', {
    title: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    category: { type: DataTypes.STRING }
});

const Settings = sequelize.define('Settings', {
    key: { type: DataTypes.STRING, unique: true, allowNull: false },
    value: { type: DataTypes.TEXT, allowNull: true }
});

const Recipe = require('./Recipe')(sequelize);
const RecipeIngredient = require('./RecipeIngredient')(sequelize);
const Tag = require('./Tag')(sequelize);

Recipe.hasMany(Menu);
Menu.belongsTo(Recipe);

Menu.hasMany(ListItem);
ListItem.belongsTo(Menu);

Recipe.belongsToMany(Product, { through: RecipeIngredient });
Product.belongsToMany(Recipe, { through: RecipeIngredient });
Recipe.hasMany(RecipeIngredient);
RecipeIngredient.belongsTo(Recipe);
RecipeIngredient.belongsTo(Product);

const RecipeTag = sequelize.define('RecipeTag', {});
Recipe.belongsToMany(Tag, { through: RecipeTag });
Tag.belongsToMany(Recipe, { through: RecipeTag });

const HiddenCleanup = sequelize.define('HiddenCleanup', {
    context: { type: DataTypes.ENUM('category', 'manufacturer', 'unit'), allowNull: false }
});

HiddenCleanup.belongsTo(Product);
Product.hasMany(HiddenCleanup);

module.exports = {
    sequelize,
    User,
    Manufacturer,
    Store,
    Product,
    List,
    ListItem,
    Menu,
    Expense,
    Recipe,
    RecipeIngredient,
    Tag,
    RecipeTag,
    ProductRelation,
    Settings,
    HiddenCleanup
};
