#!/bin/bash

# Database restore script for USA Notary application
# This script restores a compressed backup to a PostgreSQL database

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [backup_file] [target_database_url]"
    echo ""
    echo "Arguments:"
    echo "  backup_file        Path to the backup file (.sql.gz or .sql)"
    echo "  target_database_url Optional: Target database URL (defaults to .env DATABASE_URL)"
    echo ""
    echo "Examples:"
    echo "  $0 backups/usa_notray_backup_20231201_120000.sql.gz"
    echo "  $0 backups/usa_notray_backup_20231201_120000.sql.gz postgresql://user:pass@localhost:5432/testdb"
    echo ""
    echo "Available backups:"
    ls -la backups/usa_notray_backup_*.sql.gz 2>/dev/null | tail -5 || echo "  No backups found in ./backups/"
}

# Check arguments
if [ $# -lt 1 ]; then
    print_error "Missing backup file argument"
    show_usage
    exit 1
fi

BACKUP_FILE="$1"
TARGET_DATABASE_URL="$2"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    print_error "Backup file not found: $BACKUP_FILE"
    show_usage
    exit 1
fi

# If no target database URL provided, use the one from .env
if [ -z "$TARGET_DATABASE_URL" ]; then
    if [ ! -f ".env" ]; then
        print_error ".env file not found and no target database URL provided!"
        show_usage
        exit 1
    fi
    
    # Load environment variables from .env
    export $(grep -v '^#' .env | xargs)
    TARGET_DATABASE_URL="$DATABASE_URL"
fi

# Parse DATABASE_URL
DB_USER=$(echo $TARGET_DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $TARGET_DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $TARGET_DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $TARGET_DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $TARGET_DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

print_status "=== USA Notary Database Restore ==="
print_status "Backup file: $BACKUP_FILE"
print_status "Target host: $DB_HOST:$DB_PORT"
print_status "Target database: $DB_NAME"
print_status "Target user: $DB_USER"
echo ""

# Check file size
FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
print_status "Backup file size: $FILE_SIZE"

# Warning about destructive operation
print_warning "⚠️  WARNING: This operation will REPLACE all data in the target database!"
print_warning "⚠️  Current database '$DB_NAME' will be completely overwritten!"
echo ""

# Confirmation prompt
read -p "Are you sure you want to continue? Type 'yes' to proceed: " -r
echo
if [[ ! $REPLY =~ ^yes$ ]]; then
    print_status "Restore operation cancelled."
    exit 0
fi

# Set PGPASSWORD environment variable
export PGPASSWORD="$DB_PASS"

print_status "Starting database restore..."

# Determine if file is compressed
if [[ "$BACKUP_FILE" == *.gz ]]; then
    print_status "Decompressing and restoring from: $BACKUP_FILE"
    gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1
else
    print_status "Restoring from: $BACKUP_FILE"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 -f "$BACKUP_FILE"
fi

# Check if restore was successful
if [ $? -eq 0 ]; then
    print_success "Database restore completed successfully!"
    
    # Verify the restore by checking table count
    print_status "Verifying restore..."
    TABLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
    
    if [ ! -z "$TABLE_COUNT" ] && [ "$TABLE_COUNT" -gt 0 ]; then
        print_success "Verification successful: $TABLE_COUNT tables found in restored database"
    else
        print_warning "Could not verify table count in restored database"
    fi
    
    echo ""
    print_status "📋 Restore Summary:"
    echo "   Source: $BACKUP_FILE"
    echo "   Target: $DB_HOST:$DB_PORT/$DB_NAME"
    echo "   Tables: $TABLE_COUNT"
    echo "   Completed: $(date)"
    
else
    print_error "Database restore failed!"
    print_error "Please check the backup file and database connection."
    exit 1
fi

# Clear password from environment
unset PGPASSWORD

echo ""
print_success "✅ Restore process completed!"
print_status "Database '$DB_NAME' has been restored from backup."
