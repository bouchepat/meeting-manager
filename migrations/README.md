# Database Migrations

This folder contains all database migrations, schemas, and seed data for the Meeting Manager application.

## Folder Structure

```
migrations/
├── schema/                    # Schema migrations (CREATE, ALTER, DROP)
│   ├── 001_initial_schema.sql
│   ├── 002_*.sql             # Future migrations
│   └── TEMPLATE_alter.sql    # Template for new migrations
├── seeds/                     # Seed data for development
│   └── 001_seed_data.sql
├── drop_and_recreate.sql      # Drops and recreates all tables
├── run_migrations.sh          # Migration runner (Linux/Mac)
├── run_migrations.bat         # Migration runner (Windows)
└── README.md                  # This file
```

## Quick Start

### Windows
```bash
# Run all schema migrations
migrations\run_migrations.bat migrate

# Load seed data
migrations\run_migrations.bat seed

# Fresh start (drops all tables and recreates)
migrations\run_migrations.bat fresh

# Fresh start + seed data
migrations\run_migrations.bat reset
```

### Linux/Mac
```bash
# Make script executable (first time only)
chmod +x migrations/run_migrations.sh

# Run all schema migrations
./migrations/run_migrations.sh migrate

# Load seed data
./migrations/run_migrations.sh seed

# Fresh start (drops all tables and recreates)
./migrations/run_migrations.sh fresh

# Fresh start + seed data
./migrations/run_migrations.sh reset
```

## Creating New Migrations

### For Schema Changes (ALTER, CREATE, DROP)

1. Copy the template:
   ```bash
   cp migrations/schema/TEMPLATE_alter.sql migrations/schema/002_add_feature_name.sql
   ```

2. Edit the new file:
   - Update the header comments (migration number, description, date, author)
   - Add your SQL statements (ALTER TABLE, CREATE TABLE, etc.)
   - Document rollback steps at the bottom

3. Run the migration:
   ```bash
   # Windows
   migrations\run_migrations.bat migrate

   # Linux/Mac
   ./migrations/run_migrations.sh migrate
   ```

### Naming Convention

Schema migrations should follow this pattern:
- `XXX_descriptive_name.sql`
- Where XXX is a sequential number (001, 002, 003, etc.)
- Use underscores for spaces
- Use lowercase

Examples:
- `002_add_transcription_table.sql`
- `003_add_user_roles_column.sql`
- `004_create_notification_system.sql`

### For Seed Data

1. Create a new seed file:
   ```bash
   migrations/seeds/002_additional_test_data.sql
   ```

2. Add your INSERT statements

3. Run seeds:
   ```bash
   # Windows
   migrations\run_migrations.bat seed

   # Linux/Mac
   ./migrations/run_migrations.sh seed
   ```

## Migration Commands

| Command | Description | Data Loss? |
|---------|-------------|------------|
| `migrate` | Run all schema migrations in order | No |
| `seed` | Run all seed data scripts | No |
| `fresh` | Drop all tables and recreate from scratch | **YES** |
| `reset` | Fresh migration + seed data | **YES** |
| `file <path>` | Run a specific SQL file | Depends |

## Best Practices

1. **Never modify existing migrations** - Always create new ones
2. **Test migrations locally first** before running in production
3. **Document rollback steps** in each migration file
4. **Use transactions** when possible (START TRANSACTION; ... COMMIT;)
5. **Keep migrations small** - One logical change per migration
6. **Version control** - Commit migrations with your code changes
7. **Sequential numbering** - Use the next available number

## Development Workflow

### Starting Fresh
If you want to reset your database to a clean state:

```bash
# Windows
migrations\run_migrations.bat reset

# Linux/Mac
./migrations/run_migrations.sh reset
```

This will:
1. Drop all existing tables
2. Recreate tables from schema migrations
3. Load seed data for testing

### Adding a New Feature

1. Create your feature branch
2. Create a new migration file
3. Run the migration locally
4. Test your changes
5. Commit both code and migration
6. Push to repository

### Example: Adding a New Table

```sql
-- migrations/schema/002_add_transcriptions_table.sql
-- Migration: 002_add_transcriptions_table
-- Description: Add table to store audio transcriptions
-- Created: 2025-11-26
-- Author: Your Name

USE meeting_manager;

START TRANSACTION;

CREATE TABLE IF NOT EXISTS transcriptions (
    id VARCHAR(36) PRIMARY KEY,
    meetingId VARCHAR(36) NOT NULL,
    transcriptText LONGTEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    confidence DECIMAL(5,2),
    processingStatus ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (meetingId) REFERENCES meetings(id) ON DELETE CASCADE,
    INDEX idx_meetingId (meetingId),
    INDEX idx_status (processingStatus)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;

-- Rollback:
-- DROP TABLE IF EXISTS transcriptions;
```

## Troubleshooting

### Container not running
```bash
docker-compose up -d
```

### Permission denied (Linux/Mac)
```bash
chmod +x migrations/run_migrations.sh
```

### Migration failed
1. Check the error message
2. Fix the SQL in your migration file
3. If needed, manually rollback using the rollback steps documented in the migration
4. Re-run the migration

### Reset everything
```bash
# Stop containers
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker volume rm meeting-manager_mysql_data

# Start fresh
docker-compose up -d
./migrations/run_migrations.sh reset
```

## Database Connection

- **Host**: localhost
- **Port**: 3306
- **Database**: meeting_manager
- **User**: meetinguser
- **Password**: meetingpass

## Notes

- Migrations run inside the Docker container
- The scripts copy SQL files to the container and execute them
- All migrations use the `meeting_manager` database
- Foreign key constraints are enforced
- UTF8MB4 character set is used for full Unicode support
