#!/bin/bash

# Simple database backup script
# Direct backup using the provided DATABASE_URL

# Database connection details
DB_HOST="144.202.30.172"
DB_PORT="5432"
DB_NAME="usa_notray_production"
DB_USER="usa_notray_user"
DB_PASS="secure_password_2024"

# Create timestamp for backup filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups"
BACKUP_FILE="usa_notray_backup_${TIMESTAMP}.sql"
COMPRESSED_BACKUP="${BACKUP_FILE}.gz"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "🚀 Starting database backup..."
echo "📊 Host: $DB_HOST:$DB_PORT"
echo "📊 Database: $DB_NAME"
echo "📊 User: $DB_USER"
echo "📁 Backup file: $BACKUP_DIR/$COMPRESSED_BACKUP"
echo ""

# Set password environment variable
export PGPASSWORD="$DB_PASS"

# Create the backup
echo "📦 Creating backup..."
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
        > "$BACKUP_DIR/$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database backup completed successfully!"
    
    # Compress the backup
    echo "🗜️  Compressing backup..."
    gzip "$BACKUP_DIR/$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        echo "✅ Backup compressed successfully!"
        
        # Show file info
        FILE_SIZE=$(du -h "$BACKUP_DIR/$COMPRESSED_BACKUP" | cut -f1)
        echo ""
        echo "📋 Backup Summary:"
        echo "   📁 File: $BACKUP_DIR/$COMPRESSED_BACKUP"
        echo "   📊 Size: $FILE_SIZE"
        echo "   📅 Created: $(date)"
        
        echo ""
        echo "✅ Backup process completed successfully!"
        
    else
        echo "❌ Failed to compress backup"
        echo "📁 Uncompressed backup available: $BACKUP_DIR/$BACKUP_FILE"
    fi
else
    echo "❌ Database backup failed!"
    echo "Please check database connection and credentials."
    exit 1
fi

# Clear password from environment
unset PGPASSWORD

echo ""
echo "🔒 Backup contains sensitive data - store securely!"
