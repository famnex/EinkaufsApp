# AI Features Documentation

This project incorporates several AI-driven features using OpenAI's API to enhance user experience and streamline kitchen management.

## Features

### 1. Recipe Import & Analysis
- **Endpoint**: `/api/ai/parse`
- **Location**: `AiImportModal.jsx`
- **Description**: Extracts structured data (title, ingredients, steps, duration, etc.) from raw text or images (Vision).
- **Rules**: Strictly German output, standardized units, and automatic product matching.

### 2. Instagram Post Generation (Admin Only)
- **Endpoint**: `/api/ai/insta-post`
- **Location**: `Recipes.jsx`
- **Description**: Generates a formatted Instagram post from a recipe.
- **Features**:
    - Vorschau des Posts im Modal.
    - Button zum Kopieren in die Zwischenablage.
    - Button zum Teilen (Web Share API).
- **Format**:
    - Title
    - Short introduction text
    - Ingredients list with emojis (no changes to original recipe)
    - Preparation steps (no changes to original recipe)
    - 5 Hashtags
- **Access**: Restricted to users with the `admin` role.

### 3. AI Image Generation
- **Endpoints**: `/api/ai/generate-image`, `/api/ai/regenerate-image`
- **Description**: Generates appetizing food photography for recipes.
- **Model**: DALL-E 3 (Landscape 1792x1024).

### 4. Smart Substitution Suggestions
- **Endpoints**: `/api/ai/suggest-substitute`, `/api/ai/suggest-recipe-substitute`
- **Description**: Suggests ingredient alternatives based on household intolerances and recipe context.

### 5. AI Cleanup (Deduplication & Categorization)
- **Endpoints**: `/api/ai/cleanup`, `/api/ai/find-duplicates`
- **Description**: Helps maintain a clean product database by identifying duplicates and suggesting categories/units.

## Configuration
AI features require a valid OpenAI API key stored in the `Settings` table under the key `openai_key`. Credit deduction is handled for non-admin users via the `creditService`.
