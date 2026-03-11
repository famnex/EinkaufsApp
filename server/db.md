# Database Structure

## Tables

### Users
- id (Integer, Primary Key)
- username (String)
- password (String, Hashed)
- email (String)
- role (Enum: 'admin', 'user')
- householdId (Integer, Foreign Key)
- tier (Enum: 'Plastikgabel', ...)
- aiCredits (Decimal)
- newsletterSignedUp (Boolean)
- newsletterSignupDate (DateTime)
- bannedAt (DateTime)
- banReason (Text)
- banExpiresAt (DateTime)
- isPermanentlyBanned (Boolean)
- resetPasswordToken (String, Nullable, for password reset)
- resetPasswordExpires (DateTime, Nullable, for password reset)
- subscriptionStatus (Enum: 'active', 'canceled', 'past_due', 'none')
- subscriptionExpiresAt (DateTime, Nullable)
- cancelAtPeriodEnd (Boolean, default false)
- stripeCustomerId (String, Nullable)
- stripeSubscriptionId (String, Nullable)
- pendingTier (Enum: 'Silbergabel', 'none')
- lastRefillAt (DateTime, Nullable)
- isEmailVerified (Boolean)
- emailVerificationToken (String)
- pendingEmail (String)
- tokenVersion (Integer)
- cookbookTitle (String)
- cookbookImage (String)
- sharingKey (String)
- alexaApiKey (String)
- isPublicCookbook (Boolean)
- isCommunityVisible (Boolean)
- cookbookClicks (Integer)
- followNotificationsEnabled (Boolean, default true, controls email & push)
- intoleranceDisclaimerAccepted (Boolean, default false)
- isTrialUsed (Boolean, default false)
- isOnboardingCompleted (Boolean, default false)
- onboardingPreferences (JSON, nullable)
- lastFollowedUpdatesCheck (DateTime, nullable)
- lastFollowedUpdatesNudgeSent (DateTime, nullable)
- forkyTutorialsSeen (JSON, nullable, default {}) – tracks which short Forky tutorial bubbles a user has already seen (keys: 'lists', 'menu', 'recipes', 'community', 'listdetail')

### PushSubscriptions
- id (Integer, Primary Key)
- endpoint (Text, Unique)
- p256dh (String)
- auth (String)
- UserId (Integer, Foreign Key -> Users)
- createdAt (DateTime)
- updatedAt (DateTime)

### SentPushNotifications
- id (Integer, Primary Key)
- message (Text)
- recipientCount (Integer, default 0)
- successCount (Integer, default 0)
- failureCount (Integer, default 0)
- createdAt (DateTime)
- updatedAt (DateTime)

### Recipes
- id (Integer, Primary Key)
- title (String)
- category (String)
- image_url (String)
- prep_time (Integer)
- total_time (Integer)
- servings (Integer, default 1)
- clicks (Integer, default 0)
- bannedAt (DateTime, Nullable)
- UserId (Integer, Foreign Key -> Users)
- createdAt (DateTime)
- updatedAt (DateTime)

### Ingredients -> Handled via RecipeIngredient and Product relations

### RecipeIngredients
- id (Integer, Primary Key)
- amount (Float)
- unit (String)
- RecipeId (Integer, Foreign Key -> Recipes)
- ProductId (Integer, Foreign Key -> Products)
- UserId (Integer, Foreign Key -> Users)

### Products
- id (Integer, Primary Key)
- name (String)
- category (String)
- price_hint (Decimal)
- unit (String)
- isNew (Boolean)
- source (String)
- synonyms (JSON)
- StoreId (Integer, Foreign Key -> Stores)
- UserId (Integer, Foreign Key -> Users)

### Stores
- id (Integer, Primary Key)
- name (String)
- logo_url (String)
- UserId (Integer, Foreign Key -> Users)

### Lists
- id (Integer, Primary Key)
- name (String)
- date (DateOnly)
- status (Enum: 'active', 'completed', 'archived')
- total_cost (Decimal)
- CurrentStoreId (Integer, Foreign Key -> Stores)
- UserId (Integer, Foreign Key -> Users)

### ListItems
- id (Integer, Primary Key)
- quantity (Float)
- unit (String)
- is_bought (Boolean)
- is_committed (Boolean)
- sort_order (Float)
- sort_store_id (Integer)
- bought_at (DateTime)
- price_actual (Decimal)
- note (Text, Nullable)
- MenuId (Integer)
- ListId (Integer, Foreign Key -> Lists)
- ProductId (Integer, Foreign Key -> Products)
- UserId (Integer, Foreign Key -> Users)

### ProductSubstitutions
- id (Integer, Primary Key)
- ListId (Integer, Foreign Key -> Lists)
- originalProductId (Integer, Foreign Key -> Products)
- substituteProductId (Integer, Foreign Key -> Products)
- UserId (Integer, Foreign Key -> Users)

### ProductRelations
- id (Integer, Primary Key)
- StoreId (Integer, Foreign Key -> Stores)
- PredecessorId (Integer, Foreign Key -> Products)
- SuccessorId (Integer, Foreign Key -> Products)
- weight (Integer)
- UserId (Integer, Foreign Key -> Users)

### Tags
- id (Integer, Primary Key)
- name (String)
- UserId (Integer, Foreign Key -> Users)

### RecipeTag
- RecipeId (Integer)
- TagId (Integer)
- UserId (Integer)

### Menus
- id (Integer, Primary Key)
- date (DateOnly)
- meal_type (Enum)
- description (Text)
- is_eating_out (Boolean)
- RecipeId (Integer)
- UserId (Integer)

### Expenses
- id (Integer, Primary Key)
- title (String)
- amount (Decimal)
- date (DateOnly)
- category (String)
- UserId (Integer)

### HiddenCleanups
- id (Integer, Primary Key)
- context (Enum: 'category', 'unit')
- ProductId (Integer)
- UserId (Integer)

### Settings
- id (Integer, Primary Key)
- key (String)
- value (Text)
- UserId (Integer, Foreign Key -> Users)

### LoginLogs
- id (Integer, Primary Key)
- username (String)
- UserId (Integer, Foreign Key -> Users)
- event (Enum)
- ipHash (String)
- userAgent (String)

### SubscriptionLogs
- id (Integer, Primary Key)
- UserId (Integer, Foreign Key -> Users)
- username (String)
- event (String)
- tier (String)
- amount (Decimal)
- details (Text)

### CreditTransactions
- id (Integer, Primary Key)
- UserId (Integer, Foreign Key -> Users)
- delta (Decimal)
- description (Text)
- type (Enum)

### Emails
- id (Integer, Primary Key)
- messageId (String)
- folder (Enum)
- fromAddress (String)
- toAddress (String)
- subject (String)
- body (Text)
- isRead (Boolean)
- UserId (Integer, Foreign Key -> Users)

### PublicVisits
- id (Integer, Primary Key)
- UserID (Integer)
- visitorIpHash (String)
- visitedAt (DateTime)

### ProductVariants
- id (Integer, Primary Key)
- title (String, Not Null)
- UserId (Integer, Foreign Key -> Users)
- createdAt (DateTime)
- updatedAt (DateTime)

### Intolerances (Global)
- id (Integer, Primary Key)
- name (String, Unique)
- warningText (String, Nullable)

### UserIntolerances (M:N User <-> Intolerance)
- UserId (Integer)
- IntoleranceId (Integer)

### ProductIntolerances (M:N Product <-> Intolerance)
- id (Integer, Primary Key)
- ProductId (Integer)
- IntoleranceId (Integer)
- probability (Integer, default 100)

### UserProductIntolerances (M:N User <-> Product, Personal Exclusions)
- UserId (Integer)
- ProductId (Integer)

### RecipeSubstitutions
- id (Integer, Primary Key)
- originalQuantity (Float, Nullable)
- originalUnit (String, Nullable)
- substituteQuantity (Float, Nullable)
- substituteUnit (String, Nullable)
- RecipeId (Integer, Foreign Key -> Recipes)
- originalProductId (Integer, Foreign Key -> Products)
- substituteProductId (Integer, Foreign Key -> Products)
- UserId (Integer, Foreign Key -> Users)
- createdAt (DateTime)
- updatedAt (DateTime)

### UserFollows (M:N User <-> User, Cookbook Following)
- userId (Integer, Foreign Key -> Users, the follower)
- followedUserId (Integer, Foreign Key -> Users, the cookbook owner)
- createdAt (DateTime)
- updatedAt (DateTime)

### ProductReports
- id (Integer, Primary Key)
- productName (String)
- issueType (Enum: 'unverstraeglichkeit', 'einheit', 'rechtschreibung', 'variante', 'produkt', 'sonstiges')
- description (Text)
- context (String)
- status (Enum: 'open', 'resolved', 'ignored')
- ProductId (Integer, Foreign Key -> Products)
- UserId (Integer, Foreign Key -> Users)
- createdAt (DateTime)
- updatedAt (DateTime)
 
 ### AppMessages
 - id (Integer, Primary Key)
 - title (String)
 - text (String)
 - recipientCount (Integer, default 0)
 - createdAt (DateTime)
 - updatedAt (DateTime)
 
 ### UserAppMessageRead (M:N User <-> AppMessage)
 - userId (Integer, Foreign Key -> Users)
 - appMessageId (Integer, Foreign Key -> AppMessages)
 - createdAt (DateTime)
 
 ### PlannedRecipe
 - id (Integer, Primary Key)
 - RecipeId (Integer, Foreign Key -> Recipes)
 - ListId (Integer, Foreign Key -> Lists)
 - UserId (Integer, Foreign Key -> Users)
 - createdAt (DateTime)
 - updatedAt (DateTime)


## Changes
- **v0.31.7**: Removed Manufacturer attribute from Products and dropped Manufacturers table.
- **v0.31.8**: Moved 'note' from Product to ListItem (Notes are now list-specific).
- **v0.31.9**: Added ProductVariants table (simple titles for product variations).
- **v0.32.1**: Changed `Product.unit` from ENUM to STRING to support retail units (Verkaufsgebinde).
- **v0.32.2**: Added `ProductVariation` and `ProductVariant` for better variant management in AI Cleanup.
- **v0.32.3**: Added `UserProductIntolerance` and global `Intolerance` system to support personal product exclusions and allergen warnings.
- **v0.32.4**: Added `probability` column to `ProductIntolerances` to store AI-calculated quantification of restrictions.
### 0.36.7
- Users: Add `lastFollowedUpdatesNudgeSent` column for email reminders.
- **v0.32.5**: Added `RecipeSubstitutions` table to support persistent ingredient replacements for specific recipes.
- **v0.32.6**: Added `originalQuantity`, `originalUnit`, `substituteQuantity`, and `substituteUnit` to `RecipeSubstitutions` for precise adjustments.
- **v0.32.7**: Added `UserFollows` many-to-many relationship for users to follow public/shared cookbooks. Added `followNotificationsEnabled` to `User` table.
- **v0.32.8**: Added `pushEnabled` to `User` table. Added `PushSubscriptions` table for Web Push notification management.
- **v0.36.4**: Added `SentPushNotifications` table to track broadcast history.
- **v0.36.8**: Added `ProductReports` table for user feedback on product errors.
- **v0.36.9**: Added `forkyTutorialsSeen` (JSON) to `Users` table to track which short Forky tutorial bubbles (lists, menu, recipes, community, listdetail) a user has seen. Persisted via PATCH `/auth/profile/forky-tutorials` endpoint.
- **v0.38.7**: Added `AppMessages` and `UserAppMessageRead` for in-app messaging system. Added `PlannedRecipe` for direct recipe-to-list planning.
- **v0.40.0**: Redesigned tutorial spotlight system (SVG-based). Implemented strict startup sequence (Onboarding -> News -> Tutorial -> PWA). Optimized cookbook update email nudge logic.
