# Multi-User Transformation Plan

This document outlines the steps required to transform the current single/shared database application into a true multi-user system where all data is strictly isolated per user.

## 1. Database Schema Changes

We need to add a `UserId` column to almost all models to define ownership.

### User-Specific Entities
The following models MUST have a `UserId` field:
- **Lists** & **ListItems**: Shopping lists are private.
- **Products**: Users manage their own product database.
- **Recipes** & **RecipeIngredients**: Personal recipe collections.
- **Menu**: Personal meal planning.
- **Expenses**: Private financial tracking.
- **Stores** & **Manufacturers**: Custom store lists and brands.
- **Tags**: Personal categorization.
- **Settings**: Individual user preferences.
- **HiddenCleanup**: User-specific UI filters.

### Implementation Detail (Sequelize)
```javascript
// Example in models/index.js
const List = sequelize.define('List', { /* ... */ });
List.belongsTo(User);
User.hasMany(List);
```

---

## 2. API & Backend Logic

### Authentication Middleware
The existing `auth` middleware must ensure `req.user` is populated. Every controller/route must use `req.user.id` for filtering.

### Scoping Queries
All GET, PUT, and DELETE operations must include the `UserId` in the `where` clause.
- **GET /recipes**: `Recipe.findAll({ where: { UserId: req.user.id } })`
- **PUT /recipes/:id**: `Recipe.update(params, { where: { id: req.params.id, UserId: req.user.id } })`

### Creating Data
When creating new items, the `UserId` must be automatically assigned from the authenticated session.
```javascript
router.post('/recipes', auth, async (req, res) => {
    const recipe = await Recipe.create({ ...req.body, UserId: req.user.id });
});
```

---

## 3. Data Migration Strategy

For existing data on the production server, we have two options:
1. **The "Admin Inheritance" Model**: All existing items are assigned to the first administrator created.
2. **The "Shared Baseline" (Optional)**: Move current data to a "Global" user (ID 0 or null) that everyone can see but only admins can edit. *Note: User wants "alles benutzerbezogen", so isolation is preferred.*

### Migration Script
A script `scripts/migrate_to_multiuser.js` will be created to:
1. Identify the primary user.
2. Update all existing records with `UserId = primaryUserId`.
3. Set `allowNull: false` on `UserId` for future records.

---

## 4. Frontend Adjustments

- **User Context**: The frontend already has a `AuthContext`. It should ensure that sessions are handled gracefully.
- **Filtering**: Since the backend will strictly filter by `UserId`, the frontend logic mostly remains the same, but must handle the case where a user tries to access an ID they don't own (expecting 404).

---

## 5. Security & Isolation

- **File Uploads**: Image uploads (`/uploads/recipes/...`) currently use flat filenames. To prevent collisions and ensure security:
    - Path should be changed to `/uploads/users/:userId/recipes/...`.
- **Alexa Integration**: The Alexa API must be updated to identify which user is speaking (e.g., via Account Linking) to fetch the correct shopping list.

---

## Phase 1: Preparation (Example Order)
1. Document current state.
2. Add `UserId` to `User` model associations.
3. Modify `server/src/models/index.js` to add associations.
4. Run migration script.
5. Update all route files (`lists.js`, `products.js`, `recipes.js`, etc.).
6. Update Alexa API.
7. Update File Storage logic.
