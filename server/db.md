# Database Schema Documentation

## v0.18.2 - Synonyms
- **Table**: `Products`
- **Change**: Added `synonyms` column.
- **Type**: `TEXT` (JSON String)
- **Default**: `'[]'`
- **Purpose**: JSON array of string synonyms for better product lookup in search, Alexa, and AI import (e.g. `["Semmel"]` -> `Brötchen`).
- **Verified**: Column exists in SQLite schema as of v0.18.2.

## v0.18.5 - Recipe Image Source ENUM expansion
- **Table**: `Recipes`
- **Change**: Updated `imageSource` ENUM to include `'none'`.
- **Purpose**: Explicit status for recipes without images to distinguish from unknown or default states.

## v0.18.2 - Catch-up Migrations (from v0.17.x)
- **Table**: `Products`
- **Columns Ensured**:
  - `isNew` (BOOLEAN, Default: `false`)
  - `source` (STRING, Default: `'manual'`)
  - `is_hidden` (BOOLEAN, Default: `false`)
- **Table**: `Recipes`
- **Columns Ensured**:
  - `imageSource` (ENUM 'upload', 'scraped', 'ai', Default: `'scraped'`)
- **Table**: `Lists`
- **Columns Ensured**:
  - `status` (ENUM 'active', 'completed', 'archived', Default: `'active'`)
- **Note**: These columns might have been introduced in v0.17.x but are now explicitly checked/added in the v0.18.2 migration script to ensure consistency for all users.
