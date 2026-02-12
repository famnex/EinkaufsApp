# Database Structure

## Tables

### Users
- id (Integer, Primary Key)
- username (String)
- password (String, Hashed)
- role (Enum: 'admin', 'user')
- kitchenId (Integer, Foreign Key -> Kitchens)

### Recipes
- id (Integer, Primary Key)
- title (String)
- description (Text)
- instructions (Text)
- prepTime (Integer)
- cookTime (Integer)
- servings (Integer)
- image_url (String)
- original_url (String)
- source_type (Enum: 'manual', 'ai', 'scraped')
- UserId (Integer, Foreign Key -> Users)

### Ingredients
- id (Integer, Primary Key)
- name (String)
- unit (String)

### RecipeIngredients
- id (Integer, Primary Key)
- amount (Float)
- unit (String)
- RecipeId (Integer, Foreign Key -> Recipes)
- IngredientId (Integer, Foreign Key -> Ingredients)
- raw (String)

### Products
- id (Integer, Primary Key)
- name (String)
- category (String)
- defaultUnit (String)

### Lists
- id (Integer, Primary Key)
- name (String)
- type (Enum: 'shopping', 'pantry')
- HouseholdId (Integer, Foreign Key -> Households)

### ListItems
- id (Integer, Primary Key)
- name (String)
- amount (Float)
- unit (String)
- isChecked (Boolean)
- ListId (Integer, Foreign Key -> Lists)
- ProductId (Integer, Foreign Key -> Products)

### Settings
- id (Integer, Primary Key)
- key (String, Unique per User)
- value (Text)
- UserId (Integer, Foreign Key -> Users)

### LoginLogs
- id (Integer, Primary Key)
- username (String)
- UserId (Integer, Nullable, Foreign Key -> Users)
- event (Enum: 'login_success', 'login_failed', 'password_reset')
- ipHash (String)
- userAgent (String)
- createdAt (DateTime)

## Relations
- Users have many Recipes
- Recipes have many Ingredients (through RecipeIngredients)
- Lists have many ListItems
- Products can be in many ListItems
- Users have many Settings
- Users have many LoginLogs
