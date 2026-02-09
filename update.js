#!/usr/bin/env node

/**
 * Automatic Update Script with Database Migration
 * 
 * This script:
 * 1. Creates a database backup
 * 2. Finds and runs all pending migrations in server/migrations/
 * 3. Restarts the server
 * 
 * Usage: node update.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DB_PATH = path.join(__dirname, 'server', 'database.sqlite');
const MIGRATIONS_DIR = path.join(__dirname, 'server', 'migrations');
const BACKUP_DIR = path.join(__dirname, 'server', 'backups');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function createBackup() {
    log('\n Creating Database Backup...', 'blue');

    // Create backups directory if it doesn't exist
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        log('✓ Created backups directory', 'green');
    }

    // Create timestamp-based backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupPath = path.join(BACKUP_DIR, `database_${timestamp}.sqlite`);

    try {
        fs.copyFileSync(DB_PATH, backupPath);
        log(`✓ Backup created: ${path.basename(backupPath)}`, 'green');
        return backupPath;
    } catch (err) {
        log(`✗ Backup failed: ${err.message}`, 'red');
        throw err;
    }
}

function findMigrations() {
    log('\n Searching for migrations...', 'blue');

    if (!fs.existsSync(MIGRATIONS_DIR)) {
        log('✓ No migrations directory found - skipping migrations', 'yellow');
        return [];
    }

    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(file => file.endsWith('.js') && file.startsWith('migrate_'))
        .sort(); // Alphabetical order (e.g., migrate_v0.10.0.js, migrate_v0.11.0.js)

    if (files.length === 0) {
        log('✓ No migration scripts found - skipping migrations', 'yellow');
        return [];
    }

    log(`Found ${files.length} migration(s):`, 'green');
    files.forEach(file => log(`  - ${file}`, 'reset'));

    return files;
}

function runMigration(migrationFile) {
    log(`\n Running migration: ${migrationFile}`, 'blue');

    const migrationPath = path.join(MIGRATIONS_DIR, migrationFile);

    try {
        // Run migration script
        execSync(`node "${migrationPath}"`, {
            stdio: 'inherit',
            cwd: __dirname
        });
        log(`✓ Migration ${migrationFile} completed successfully`, 'green');
        return true;
    } catch (err) {
        log(`✗ Migration ${migrationFile} failed!`, 'red');
        throw err;
    }
}

function restoreBackup(backupPath) {
    log('\n Restoring database from backup...', 'yellow');

    try {
        fs.copyFileSync(backupPath, DB_PATH);
        log('✓ Database restored successfully', 'green');
    } catch (err) {
        log(`✗ Restore failed: ${err.message}`, 'red');
        throw err;
    }
}

function cleanOldBackups() {
    log('\n Cleaning old backups (keeping last 10)...', 'blue');

    if (!fs.existsSync(BACKUP_DIR)) return;

    const backups = fs.readdirSync(BACKUP_DIR)
        .filter(file => file.startsWith('database_') && file.endsWith('.sqlite'))
        .map(file => ({
            name: file,
            path: path.join(BACKUP_DIR, file),
            time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

    // Keep only the 10 most recent backups
    const toDelete = backups.slice(10);

    toDelete.forEach(backup => {
        try {
            fs.unlinkSync(backup.path);
            log(`✓ Deleted old backup: ${backup.name}`, 'green');
        } catch (err) {
            log(`✗ Could not delete ${backup.name}: ${err.message}`, 'yellow');
        }
    });

    if (toDelete.length === 0) {
        log('✓ No old backups to clean', 'green');
    }
}

async function main() {
    log('\n╔════════════════════════════════════════╗', 'bright');
    log('║   GabelGuru Update Script v1.0      ║', 'bright');
    log('╚════════════════════════════════════════╝', 'bright');

    let backupPath = null;
    let preUpdateHash = null;

    try {
        // Step 0: Capture pre-update state for code fallback
        try {
            preUpdateHash = execSync('git rev-parse HEAD', { cwd: __dirname }).toString().trim();
            log(`\n Pre-update Git state: ${preUpdateHash.slice(0, 7)}`, 'blue');
        } catch (gitErr) {
            log('\n  Git identification failed - code fallback will be disabled.', 'yellow');
        }

        // Step 1: Check if database exists
        if (!fs.existsSync(DB_PATH)) {
            log('\n  Database not found - first run? Skipping migrations.', 'yellow');
            return;
        }

        // Step 2: Find migrations
        const migrations = findMigrations();

        // Step 3: Create backup (only if migrations exist)
        if (migrations.length > 0) {
            backupPath = createBackup();

            // Step 4: Run migrations
            log('\n Running Migrations...', 'blue');
            for (const migration of migrations) {
                runMigration(migration);
            }

            log('\n All migrations completed successfully!', 'green');
        }

        // Step 5: Clean old backups
        cleanOldBackups();

        // Step 6: Success summary
        log('\n╔════════════════════════════════════════╗', 'bright');
        log('║          Update Complete! ✓            ║', 'green');
        log('╚════════════════════════════════════════╝', 'bright');

        if (backupPath) {
            log(`\n Backup saved at: ${path.basename(backupPath)}`, 'blue');
        }

        log('\n Next steps:', 'blue');
        log('  1. Restart your server: pm2 restart einkaufsapp', 'reset');
        log('  2. Check logs: pm2 logs einkaufsapp', 'reset');

    } catch (error) {
        log('\n Update Failed!', 'red');
        log(`Error: ${error.message}`, 'red');

        // Restore Code
        if (preUpdateHash) {
            log('\n Attempting to restore code to previous state...', 'yellow');
            try {
                execSync(`git reset --hard ${preUpdateHash}`, { stdio: 'inherit', cwd: __dirname });
                log('✓ Code reverted to pre-update state', 'green');
            } catch (codeRestoreErr) {
                log(`✗ Code restore failed: ${codeRestoreErr.message}`, 'red');
                log(`Please manually run: git reset --hard ${preUpdateHash}`, 'yellow');
            }
        }

        // Restore Database
        if (backupPath) {
            log('\n Attempting to restore database from backup...', 'yellow');
            try {
                restoreBackup(backupPath);
                log('\n✓ Database restored to pre-update state', 'green');
            } catch (restoreErr) {
                log('\n✗ Restore failed! Manual intervention required.', 'red');
                log(`Backup location: ${backupPath}`, 'yellow');
                log('Please manually copy the backup to restore the database.', 'yellow');
            }
        }

        process.exit(1);
    }
}

// Run the update
main();
