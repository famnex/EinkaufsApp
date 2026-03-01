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
    isCommunityVisible: { type: DataTypes.BOOLEAN, defaultValue: false },
    cookbookImage: { type: DataTypes.STRING, allowNull: true },
    householdId: { type: DataTypes.INTEGER, allowNull: true },
    tier: {
        type: DataTypes.ENUM('Plastikgabel', 'Silbergabel', 'Goldgabel', 'Rainbowspoon'),
        defaultValue: 'Plastikgabel'
    },
    aiCredits: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00 },
    subscriptionStatus: {
        type: DataTypes.ENUM('active', 'canceled', 'past_due', 'none'),
        defaultValue: 'none'
    },
    subscriptionExpiresAt: { type: DataTypes.DATE, allowNull: true },
    cancelAtPeriodEnd: { type: DataTypes.BOOLEAN, defaultValue: false },
    stripeCustomerId: { type: DataTypes.STRING, allowNull: true },
    stripeSubscriptionId: { type: DataTypes.STRING, allowNull: true },
    pendingTier: { type: DataTypes.ENUM('Silbergabel', 'none'), defaultValue: 'none' },
    lastRefillAt: { type: DataTypes.DATE, allowNull: true },
    newsletterSignedUp: { type: DataTypes.BOOLEAN, defaultValue: false },
    newsletterSignupDate: { type: DataTypes.DATE, allowNull: true },
    bannedAt: { type: DataTypes.DATE, allowNull: true },
    banReason: { type: DataTypes.TEXT, allowNull: true },
    banExpiresAt: { type: DataTypes.DATE, allowNull: true },
    isPermanentlyBanned: { type: DataTypes.BOOLEAN, defaultValue: false },
    resetPasswordToken: { type: DataTypes.STRING, allowNull: true },
    resetPasswordExpires: { type: DataTypes.DATE, allowNull: true },
    isEmailVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    emailVerificationToken: { type: DataTypes.STRING, allowNull: true },
    pendingEmail: { type: DataTypes.STRING, allowNull: true },
    tokenVersion: { type: DataTypes.INTEGER, defaultValue: 0 },
    cookbookClicks: { type: DataTypes.INTEGER, defaultValue: 0 },
    intoleranceDisclaimerAccepted: { type: DataTypes.BOOLEAN, defaultValue: false },
    followNotificationsEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    lastFollowedUpdatesCheck: { type: DataTypes.DATE, allowNull: true }
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
    unit: { type: DataTypes.STRING, defaultValue: 'Stück' },
    isNew: { type: DataTypes.BOOLEAN, defaultValue: false },
    source: { type: DataTypes.STRING, defaultValue: 'manual' }, // 'manual', 'alexa', 'ai'
    synonyms: { type: DataTypes.JSON, defaultValue: [] }
});

Product.belongsTo(Store);

// User associations
Store.belongsTo(User);
Product.belongsTo(User);
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
    note: { type: DataTypes.TEXT, allowNull: true }, // Added note to ListItem
    MenuId: { type: DataTypes.INTEGER, allowNull: true }, // Track origin menu
    ProductVariationId: { type: DataTypes.INTEGER, allowNull: true } // Link to specific variation if selected
});

ListItem.belongsTo(List);
ListItem.belongsTo(Product);
ListItem.belongsTo(User);
List.hasMany(ListItem);
User.hasMany(ListItem);

const ProductRelation = sequelize.define('ProductRelation', {
    StoreId: { type: DataTypes.INTEGER, allowNull: false }, // Context
    PredecessorId: { type: DataTypes.INTEGER, allowNull: false },
    PredecessorVariationId: { type: DataTypes.INTEGER, allowNull: true },
    SuccessorId: { type: DataTypes.INTEGER, allowNull: false },
    SuccessorVariationId: { type: DataTypes.INTEGER, allowNull: true },
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
const SubscriptionLog = require('./SubscriptionLog')(sequelize);
const ComplianceReport = require('./ComplianceReport')(sequelize);
const Newsletter = require('./Newsletter')(sequelize);
const NewsletterRecipient = require('./NewsletterRecipient')(sequelize);
const PublicVisit = require('./PublicVisit')(sequelize);
const RecipeInstructionOverride = require('./RecipeInstructionOverride')(sequelize);

LoginLog.belongsTo(User);
SubscriptionLog.belongsTo(User);
User.hasMany(LoginLog);
User.hasMany(SubscriptionLog);

ComplianceReport.belongsTo(User, { as: 'accusedUser', foreignKey: 'accusedUserId' });
User.hasMany(ComplianceReport, { as: 'strikes', foreignKey: 'accusedUserId' });

Newsletter.hasMany(NewsletterRecipient, { foreignKey: 'NewsletterId', onDelete: 'CASCADE' });
NewsletterRecipient.belongsTo(Newsletter, { foreignKey: 'NewsletterId' });
NewsletterRecipient.belongsTo(User, { foreignKey: 'UserId' });
User.hasMany(NewsletterRecipient, { foreignKey: 'UserId' });

User.belongsToMany(User, { through: 'UserFollows', as: 'FollowedCookbooks', foreignKey: 'userId', otherKey: 'followedUserId' });
User.belongsToMany(User, { through: 'UserFollows', as: 'CookbookFollowers', foreignKey: 'followedUserId', otherKey: 'userId' });

Recipe.hasMany(Menu);
Menu.belongsTo(Recipe);

Recipe.belongsTo(User);
User.hasMany(Recipe);

User.belongsToMany(Recipe, { through: 'FavoriteRecipes', as: 'Favorites' });
Recipe.belongsToMany(User, { through: 'FavoriteRecipes', as: 'FavoritedBy' });

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
    context: { type: DataTypes.ENUM('category', 'unit'), allowNull: false }
});

HiddenCleanup.belongsTo(Product);
HiddenCleanup.belongsTo(User);
User.hasMany(HiddenCleanup);
Product.hasMany(HiddenCleanup);

const ProductVariant = sequelize.define('ProductVariant', {
    title: { type: DataTypes.STRING, allowNull: false }
});

const ProductVariation = sequelize.define('ProductVariation', {
    category: { type: DataTypes.STRING },
    unit: { type: DataTypes.STRING, defaultValue: 'Stück' }
});

ProductVariant.belongsTo(User);
User.hasMany(ProductVariant);

ProductVariation.belongsTo(Product);
Product.hasMany(ProductVariation, { onDelete: 'CASCADE' });

ProductVariation.belongsTo(ProductVariant);
ProductVariant.hasMany(ProductVariation);

ProductVariation.belongsTo(User);
User.hasMany(ProductVariation);

ListItem.belongsTo(ProductVariation);
ProductVariation.hasMany(ListItem);

// ProductSubstitution associations
ProductSubstitution.belongsTo(List, { foreignKey: 'ListId' });
ProductSubstitution.belongsTo(Product, { as: 'OriginalProduct', foreignKey: 'originalProductId' });
ProductSubstitution.belongsTo(Product, { as: 'SubstituteProduct', foreignKey: 'substituteProductId' });
List.hasMany(ProductSubstitution, { foreignKey: 'ListId' });

const RecipeSubstitution = sequelize.define('RecipeSubstitution', {
    originalProductId: { type: DataTypes.INTEGER, allowNull: false },
    substituteProductId: { type: DataTypes.INTEGER, allowNull: true },
    originalQuantity: { type: DataTypes.FLOAT, allowNull: true },
    originalUnit: { type: DataTypes.STRING, allowNull: true },
    substituteQuantity: { type: DataTypes.FLOAT, allowNull: true },
    substituteUnit: { type: DataTypes.STRING, allowNull: true },
    isOmitted: { type: DataTypes.BOOLEAN, defaultValue: false }
});

RecipeSubstitution.belongsTo(User);
User.hasMany(RecipeSubstitution);

RecipeSubstitution.belongsTo(Recipe, { foreignKey: 'RecipeId' });
Recipe.hasMany(RecipeSubstitution, { foreignKey: 'RecipeId' });

RecipeSubstitution.belongsTo(Product, { as: 'OriginalProduct', foreignKey: 'originalProductId' });
RecipeSubstitution.belongsTo(Product, { as: 'SubstituteProduct', foreignKey: 'substituteProductId' });

RecipeInstructionOverride.belongsTo(User);
User.hasMany(RecipeInstructionOverride);
RecipeInstructionOverride.belongsTo(Recipe, { foreignKey: 'RecipeId' });
Recipe.hasMany(RecipeInstructionOverride, { foreignKey: 'RecipeId' });

const Email = sequelize.define('Email', {
    messageId: { type: DataTypes.STRING, allowNull: true, unique: true },
    folder: { type: DataTypes.ENUM('inbox', 'sent', 'sent_system', 'daemon', 'newsletter', 'trash'), defaultValue: 'inbox' },
    previousFolder: { type: DataTypes.STRING, allowNull: true },
    fromAddress: { type: DataTypes.STRING, allowNull: false },
    toAddress: { type: DataTypes.STRING, allowNull: false },
    cc: { type: DataTypes.TEXT, allowNull: true },
    bcc: { type: DataTypes.TEXT, allowNull: true },
    subject: { type: DataTypes.STRING, allowNull: true, defaultValue: '' },
    body: { type: DataTypes.TEXT, allowNull: true },
    bodyText: { type: DataTypes.TEXT, allowNull: true },
    isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
    date: { type: DataTypes.DATE, allowNull: true },
    inReplyTo: { type: DataTypes.STRING, allowNull: true },
    flag: { type: DataTypes.ENUM('none', 'flagged', 'completed'), defaultValue: 'none' }
});

const Intolerance = sequelize.define('Intolerance', {
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    warningText: { type: DataTypes.STRING, allowNull: true }
});

const UserIntolerance = sequelize.define('UserIntolerance', {
    UserId: { type: DataTypes.INTEGER, references: { model: 'Users', key: 'id' } },
    IntoleranceId: { type: DataTypes.INTEGER, references: { model: 'Intolerances', key: 'id' } }
});

const ProductIntolerance = sequelize.define('ProductIntolerance', {
    ProductId: { type: DataTypes.INTEGER, references: { model: 'Products', key: 'id' } },
    IntoleranceId: { type: DataTypes.INTEGER, references: { model: 'Intolerances', key: 'id' } },
    probability: { type: DataTypes.INTEGER, defaultValue: 100 }
});

const UserProductIntolerance = sequelize.define('UserProductIntolerance', {
    UserId: { type: DataTypes.INTEGER, references: { model: 'Users', key: 'id' } },
    ProductId: { type: DataTypes.INTEGER, references: { model: 'Products', key: 'id' } }
});

Email.belongsTo(User);
User.hasMany(Email);

// User <-> Intolerance (Many-to-Many)
User.belongsToMany(Intolerance, { through: UserIntolerance });
Intolerance.belongsToMany(User, { through: UserIntolerance });

// Product <-> Intolerance (Many-to-Many)
Product.belongsToMany(Intolerance, { through: ProductIntolerance });
Intolerance.belongsToMany(Product, { through: ProductIntolerance });

// User <-> Product (Personal Intolerance, Many-to-Many)
User.belongsToMany(Product, { through: UserProductIntolerance, as: 'IntolerantProducts' });
Product.belongsToMany(User, { through: UserProductIntolerance, as: 'IntolerantByUsers' });

module.exports = {
    sequelize,
    User,
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
    SubscriptionLog,
    Email,
    ComplianceReport,
    Newsletter,
    NewsletterRecipient,
    PublicVisit,
    ProductVariant,
    ProductVariation,
    Intolerance,
    ProductIntolerance,
    UserIntolerance,
    RecipeSubstitution,
    RecipeInstructionOverride
};
