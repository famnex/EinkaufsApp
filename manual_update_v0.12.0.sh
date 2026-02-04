#!/bin/bash
# Manual Migration v0.12.0
# Add Product Substitution support and Product Notes

DB_FILE="server/database.sqlite"

if [ ! -f "$DB_FILE" ]; then
    echo "Error: $DB_FILE not found"
    exit 1
fi

echo "Creating backup..."
cp "$DB_FILE" "${DB_FILE}_backup_$(date +%Y%m%d_%H%M%S)"

echo "Applying v0.12.0 database changes..."

sqlite3 "$DB_FILE" <<EOF
-- Add note column to Products if it doesn't exist
-- SQLite doesn't have IF NOT EXISTS for ADD COLUMN directly in all versions, 
-- but these commands are standard for this app.
ALTER TABLE Products ADD COLUMN note TEXT;

-- Create ProductSubstitutions table
CREATE TABLE IF NOT EXISTS ProductSubstitutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    originalProductId INTEGER NOT NULL,
    substituteProductId INTEGER NOT NULL,
    ListId INTEGER,
    createdAt DATETIME NOT NULL,
    updatedAt DATETIME NOT NULL,
    FOREIGN KEY (originalProductId) REFERENCES Products (id),
    FOREIGN KEY (substituteProductId) REFERENCES Products (id),
    FOREIGN KEY (ListId) REFERENCES Lists (id)
);
EOF

echo "✓ Migration v0.12.0 applied successfully."
