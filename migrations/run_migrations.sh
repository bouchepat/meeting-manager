#!/bin/bash

# Database Migration Runner for Meeting Manager
# This script runs migrations inside the Docker MySQL container

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Database configuration
DB_CONTAINER="meeting-manager-db"
DB_USER="meetinguser"
DB_PASSWORD="meetingpass"
DB_NAME="meeting_manager"

# Function to print colored messages
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker container is running
check_container() {
    if ! docker ps | grep -q $DB_CONTAINER; then
        print_error "Database container '$DB_CONTAINER' is not running!"
        print_info "Please start the container with: docker-compose up -d"
        exit 1
    fi
    print_info "Database container is running"
}

# Run a SQL file in the container
run_sql_file() {
    local file=$1
    local filename=$(basename "$file")

    print_info "Running migration: $filename"

    # Execute SQL file by piping content to mysql
    cat "$file" | docker exec -i $DB_CONTAINER mysql -u$DB_USER -p$DB_PASSWORD $DB_NAME 2>&1 | grep -v "Using a password"

    if [ ${PIPESTATUS[1]} -eq 0 ]; then
        print_info "✓ Successfully executed: $filename"
    else
        print_error "✗ Failed to execute: $filename"
        exit 1
    fi
}

# Run all schema migrations in order
run_schema_migrations() {
    print_info "=== Running Schema Migrations ==="

    for file in ./migrations/schema/[0-9]*.sql; do
        if [ -f "$file" ]; then
            run_sql_file "$file"
        fi
    done
}

# Run seed data
run_seeds() {
    print_info "=== Running Seed Data ==="

    for file in ./migrations/seeds/[0-9]*.sql; do
        if [ -f "$file" ]; then
            run_sql_file "$file"
        fi
    done
}

# Drop and recreate all tables
fresh_migration() {
    print_warning "=== FRESH MIGRATION - ALL DATA WILL BE LOST ==="
    read -p "Are you sure you want to drop all tables? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        print_info "Migration cancelled"
        exit 0
    fi

    print_info "Dropping and recreating all tables..."

    # Run drop and recreate script
    docker exec $DB_CONTAINER mysql -u$DB_USER -p$DB_PASSWORD <<-EOSQL
        USE $DB_NAME;
        SET FOREIGN_KEY_CHECKS = 0;
        DROP TABLE IF EXISTS meeting_summaries;
        DROP TABLE IF EXISTS tasks;
        DROP TABLE IF EXISTS guests;
        DROP TABLE IF EXISTS meetings;
        DROP TABLE IF EXISTS users;
        SET FOREIGN_KEY_CHECKS = 1;
EOSQL

    # Run schema migrations
    run_schema_migrations

    print_info "Fresh migration completed!"
}

# Show help
show_help() {
    cat <<EOF
Database Migration Runner for Meeting Manager

Usage: $0 [command] [options]

Commands:
    migrate         Run all pending schema migrations
    seed            Run seed data (development data)
    fresh           Drop all tables and recreate from scratch (WARNING: deletes all data)
    reset           Fresh migration + seed data
    file <path>     Run a specific SQL file
    help            Show this help message

Examples:
    $0 migrate                          # Run schema migrations
    $0 seed                             # Run seed data
    $0 fresh                            # Fresh migration (drops all tables)
    $0 reset                            # Fresh migration + seeds
    $0 file migrations/schema/002_*.sql # Run specific migration

EOF
}

# Main script
main() {
    check_container

    case "${1:-help}" in
        migrate)
            run_schema_migrations
            print_info "All migrations completed successfully!"
            ;;
        seed)
            run_seeds
            print_info "Seed data loaded successfully!"
            ;;
        fresh)
            fresh_migration
            ;;
        reset)
            fresh_migration
            run_seeds
            print_info "Database reset completed!"
            ;;
        file)
            if [ -z "$2" ]; then
                print_error "Please specify a file path"
                print_info "Usage: $0 file <path-to-sql-file>"
                exit 1
            fi
            run_sql_file "$2"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
