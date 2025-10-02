#!/bin/bash

# Advanced database backup script for USA Notary application
# This script reads database connection from .env file and creates backups

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

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found!"
    print_error "Please ensure you're running this script from the project root directory."
    exit 1
fi

# Load environment variables from .env
export $(grep -v '^#' .env | xargs)

# Parse DATABASE_URL if it exists, otherwise use individual variables
if [ ! -z "$DATABASE_URL" ]; then
    # Extract components from DATABASE_URL
    # Format: postgresql://username:password@host:port/database
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
else
    print_error "DATABASE_URL not found in .env file"
    exit 1
fi

# Create timestamp for backup filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups"
BACKUP_FILE="usa_notray_backup_${TIMESTAMP}.sql"
COMPRESSED_BACKUP="${BACKUP_FILE}.gz"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

print_status "=== USA Notary Database Backup ==="
print_status "Host: $DB_HOST:$DB_PORT"
print_status "Database: $DB_NAME"
print_status "User: $DB_USER"
print_status "Backup file: $BACKUP_DIR/$COMPRESSED_BACKUP"
echo ""

# Set PGPASSWORD environment variable to avoid password prompt
export PGPASSWORD="$DB_PASS"

print_status "Creating database backup..."

# Create the backup with comprehensive options
pg_dump -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --verbose \
        --format=plain \
        --no-owner \
        --no-privileges \
        --create \
        --clean \
        --if-exists \
        --inserts \
        --column-inserts \
        > "$BACKUP_DIR/$BACKUP_FILE" 2>/dev/null

# Check if backup was successful
if [ $? -eq 0 ]; then
    print_success "Database backup completed successfully!"
    
    # Compress the backup
    print_status "Compressing backup file..."
    gzip "$BACKUP_DIR/$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        print_success "Backup compressed successfully!"
        print_success "Backup saved to: $BACKUP_DIR/$COMPRESSED_BACKUP"
        
        # Show file size
        FILE_SIZE=$(du -h "$BACKUP_DIR/$COMPRESSED_BACKUP" | cut -f1)
        print_status "Backup size: $FILE_SIZE"
        
        # Show table count in backup
        TABLE_COUNT=$(zcat "$BACKUP_DIR/$COMPRESSED_BACKUP" | grep -c "CREATE TABLE")
        print_status "Tables backed up: $TABLE_COUNT"
        
        echo ""
        print_status "📋 Backup Information:"
        echo "   File: $BACKUP_DIR/$COMPRESSED_BACKUP"
        echo "   Size: $FILE_SIZE"
        echo "   Tables: $TABLE_COUNT"
        echo "   Created: $(date)"
        
        echo ""
        print_status "📋 To view backup contents:"
        echo "   zcat $BACKUP_DIR/$COMPRESSED_BACKUP | head -20"
        
        echo ""
        print_status "📋 To restore this backup:"
        echo "   gunzip -c $BACKUP_DIR/$COMPRESSED_BACKUP | psql -h [host] -U [user] -d [database]"
        
        # Clean up old backups (keep last 10)
        print_status "Cleaning up old backups (keeping last 10)..."
        cd "$BACKUP_DIR"
        ls -t usa_notray_backup_*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm --
        cd - > /dev/null
        
        REMAINING_BACKUPS=$(ls -1 "$BACKUP_DIR"/usa_notray_backup_*.sql.gz 2>/dev/null | wc -l)
        print_status "Total backups in directory: $REMAINING_BACKUPS"
        
    else
        print_error "Failed to compress backup file"
        print_warning "Uncompressed backup available at: $BACKUP_DIR/$BACKUP_FILE"
    fi
else
    print_error "Database backup failed!"
    print_error "Please check your database connection and credentials."
    exit 1
fi

# Clear password from environment
unset PGPASSWORD

echo ""
print_warning "🔒 Security note: The backup contains sensitive data. Store it securely."
print_success "✅ Backup process completed!"
