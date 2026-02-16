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
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    role: { type: DataTypes.ENUM('admin', 'user'), defaultValue: 'user' },
    isLdap: { type: DataTypes.BOOLEAN, defaultValue: false },
    alexaApiKey: { type: DataTypes.STRING, allowNull: true },
    sharingKey: { type: DataTypes.STRING, allowNull: true, unique: true },
    cookbookTitle: { type: DataTypes.STRING, defaultValue: 'MEIN KOCHBUCH' },
    isPublicCookbook: { type: DataTypes.BOOLEAN, defaultValue: false },
    cookbookImage: { type: DataTypes.STRING, allowNull: true },
    householdId: { type: DataTypes.INTEGER, allowNull: true },
    tier: {
        type: DataTypes.ENUM('Plastikgabel', 'Silbergabel', 'Goldgabel', 'Rainbowspoon'),
        defaultValue: 'Plastikgabel'
    },
    aiCredits: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00 },
    newsletterSignedUp: { type: DataTypes.BOOLEAN, defaultValue: false },
    newsletterSignupDate: { type: DataTypes.DATE, allowNull: true },
    bannedAt: { type: DataTypes.DATE, allowNull: true },
    resetPasswordToken: { type: DataTypes.STRING, allowNull: true },
    resetPasswordExpires: { type: DataTypes.DATE, allowNull: true }
});

const Manufacturer = sequelize.define('Manufacturer', {
    name: { type: DataTypes.STRING, allowNull: false }
}, {
    indexes: [{ unique: true, fields: ['name', 'UserId'] }]
});

const Store = sequelize.define('Store', {
    name: { type: DataTypes.STRING, allowNull: false },
    logo_url: { type: DataTypes.STRING, allowNull: true }
}, {
    indexes: [{ unique: true, fields: ['name', 'UserId'] }]
});

const Product = sequelize.define('Product', {
    name: { type: DataTypes.STRING, allowNull: false },
    category: { type: DataTypes.STRING },
    price_hint: { type: DataTypes.DECIMAL(10, 2) },
    unit: { type: DataTypes.ENUM('Stück', 'g', 'kg', 'ml', 'l'), defaultValue: 'Stück' },
    note: { type: DataTypes.TEXT, allowNull: true },
    isNew: { type: DataTypes.BOOLEAN, defaultValue: false },
    source: { type: DataTypes.STRING, defaultValue: 'manual' }, // 'manual', 'alexa', 'ai'
    synonyms: { type: DataTypes.JSON, defaultValue: [] }
});

Product.belongsTo(Manufacturer);
Product.belongsTo(Store);

// User associations
Manufacturer.belongsTo(User);
Store.belongsTo(User);
Product.belongsTo(User);
User.hasMany(Manufacturer);
User.hasMany(Store);
User.hasMany(Product);

const ProductSubstitution = sequelize.define('ProductSubstitution', {
    originalProductId: { type: DataTypes.INTEGER, allowNull: false },
    substituteProductId: { type: DataTypes.INTEGER, allowNull: false }
});

ProductSubstitution.belongsTo(User);
User.hasMany(ProductSubstitution);

const List = sequelize.define('List', {
    name: { type: DataTypes.STRING, allowNull: true },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    status: { type: DataTypes.ENUM('active', 'completed', 'archived'), defaultValue: 'active' },
    total_cost: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00 }
});

List.belongsTo(Store, { as: 'CurrentStore', foreignKey: 'CurrentStoreId' });
List.belongsTo(User);
User.hasMany(List);

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
ListItem.belongsTo(User);
List.hasMany(ListItem);
User.hasMany(ListItem);

const ProductRelation = sequelize.define('ProductRelation', {
    StoreId: { type: DataTypes.INTEGER, allowNull: false }, // Context
    PredecessorId: { type: DataTypes.INTEGER, allowNull: false },
    SuccessorId: { type: DataTypes.INTEGER, allowNull: false },
    weight: { type: DataTypes.INTEGER, defaultValue: 1 }
});

ProductRelation.belongsTo(Store);
ProductRelation.belongsTo(Product, { as: 'Predecessor', foreignKey: 'PredecessorId' });
ProductRelation.belongsTo(Product, { as: 'Successor', foreignKey: 'SuccessorId' });
ProductRelation.belongsTo(User);
Store.hasMany(ProductRelation);
User.hasMany(ProductRelation);

const Menu = sequelize.define('Menu', {
    date: { type: DataTypes.DATEONLY, allowNull: false },
    meal_type: { type: DataTypes.ENUM('breakfast', 'lunch', 'dinner', 'snack'), defaultValue: 'lunch' },
    description: { type: DataTypes.TEXT }, // Manual entry
    is_eating_out: { type: DataTypes.BOOLEAN, defaultValue: false },
    // RecipeId will be added automatically by association, but we can depend on it
});

const Expense = sequelize.define('Expense', {
    title: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    category: { type: DataTypes.STRING }
});

Menu.belongsTo(User);
Expense.belongsTo(User);
User.hasMany(Menu);
User.hasMany(Expense);

const Settings = sequelize.define('Settings', {
    key: { type: DataTypes.STRING, allowNull: false },
    value: { type: DataTypes.TEXT, allowNull: true }
}, {
    indexes: [{ unique: true, fields: ['key', 'UserId'] }]
});

Settings.belongsTo(User);
User.hasMany(Settings);

const CreditTransaction = sequelize.define('CreditTransaction', {
    delta: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    description: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.ENUM('booking', 'usage'), defaultValue: 'usage' } // booking = +/- by admin, usage = spent on AI
});

CreditTransaction.belongsTo(User);
User.hasMany(CreditTransaction);

const Recipe = require('./Recipe')(sequelize);
const RecipeIngredient = require('./RecipeIngredient')(sequelize);
const Tag = require('./Tag')(sequelize);
const LoginLog = require('./LoginLog')(sequelize);
const ComplianceReport = require('./ComplianceReport')(sequelize);

LoginLog.belongsTo(User);
User.hasMany(LoginLog);

ComplianceReport.belongsTo(User, { as: 'accusedUser', foreignKey: 'accusedUserId' });
User.hasMany(ComplianceReport, { as: 'strikes', foreignKey: 'accusedUserId' });

Recipe.hasMany(Menu);
Menu.belongsTo(Recipe);

Recipe.belongsTo(User);
User.hasMany(Recipe);

Menu.hasMany(ListItem);
ListItem.belongsTo(Menu);

Recipe.belongsToMany(Product, { through: RecipeIngredient });
Product.belongsToMany(Recipe, { through: RecipeIngredient });
Recipe.hasMany(RecipeIngredient);
RecipeIngredient.belongsTo(Recipe);
RecipeIngredient.belongsTo(Product);
RecipeIngredient.belongsTo(User);
User.hasMany(RecipeIngredient);

const RecipeTag = sequelize.define('RecipeTag', {});
RecipeTag.belongsTo(User);
User.hasMany(RecipeTag);

Recipe.belongsToMany(Tag, { through: RecipeTag });
Tag.belongsToMany(Recipe, { through: RecipeTag });

Tag.belongsTo(User);
User.hasMany(Tag);

const HiddenCleanup = sequelize.define('HiddenCleanup', {
    context: { type: DataTypes.ENUM('category', 'manufacturer', 'unit'), allowNull: false }
});

HiddenCleanup.belongsTo(Product);
HiddenCleanup.belongsTo(User);
User.hasMany(HiddenCleanup);
Product.hasMany(HiddenCleanup);

// ProductSubstitution associations
ProductSubstitution.belongsTo(List, { foreignKey: 'ListId' });
ProductSubstitution.belongsTo(Product, { as: 'OriginalProduct', foreignKey: 'originalProductId' });
ProductSubstitution.belongsTo(Product, { as: 'SubstituteProduct', foreignKey: 'substituteProductId' });
List.hasMany(ProductSubstitution, { foreignKey: 'ListId' });

const Email = sequelize.define('Email', {
    messageId: { type: DataTypes.STRING, allowNull: true, unique: true },
    folder: { type: DataTypes.ENUM('inbox', 'sent', 'trash'), defaultValue: 'inbox' },
    fromAddress: { type: DataTypes.STRING, allowNull: false },
    toAddress: { type: DataTypes.STRING, allowNull: false },
    cc: { type: DataTypes.TEXT, allowNull: true },
    bcc: { type: DataTypes.TEXT, allowNull: true },
    subject: { type: DataTypes.STRING, allowNull: true, defaultValue: '' },
    body: { type: DataTypes.TEXT, allowNull: true },
    bodyText: { type: DataTypes.TEXT, allowNull: true },
    isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
    date: { type: DataTypes.DATE, allowNull: true },
    inReplyTo: { type: DataTypes.STRING, allowNull: true }
});

Email.belongsTo(User);
User.hasMany(Email);

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
    HiddenCleanup,
    ProductSubstitution,
    CreditTransaction,
    LoginLog,
    Email,
    ComplianceReport
};
