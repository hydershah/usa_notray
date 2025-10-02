#!/bin/bash

# Database backup script for USA Notary application
# This script creates a compressed backup of the PostgreSQL database

# Set variables from .env or use defaults
DB_HOST="144.202.30.172"
DB_PORT="5432"
DB_NAME="usa_notray_production"
DB_USER="usa_notray_user"

# Create timestamp for backup filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups"
BACKUP_FILE="usa_notray_backup_${TIMESTAMP}.sql"
COMPRESSED_BACKUP="${BACKUP_FILE}.gz"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "Starting database backup..."
echo "Host: $DB_HOST"
echo "Database: $DB_NAME"
echo "Backup file: $BACKUP_DIR/$COMPRESSED_BACKUP"
echo ""

# Prompt for password (more secure than putting it in script)
echo "You will be prompted for the database password."
echo "Password hint: secure_password_2024"
echo ""

# Create the backup
pg_dump -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --verbose \
        --no-password \
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
    echo "Compressing backup file..."
    gzip "$BACKUP_DIR/$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        echo "✅ Backup compressed successfully!"
        echo "📁 Backup saved to: $BACKUP_DIR/$COMPRESSED_BACKUP"
        
        # Show file size
        FILE_SIZE=$(du -h "$BACKUP_DIR/$COMPRESSED_BACKUP" | cut -f1)
        echo "📊 Backup size: $FILE_SIZE"
        
        # Show backup contents summary
        echo ""
        echo "📋 To view backup contents:"
        echo "   zcat $BACKUP_DIR/$COMPRESSED_BACKUP | head -20"
        echo ""
        echo "📋 To restore this backup:"
        echo "   gunzip -c $BACKUP_DIR/$COMPRESSED_BACKUP | psql -h [host] -U [user] -d [database]"
    else
        echo "❌ Failed to compress backup file"
        echo "📁 Uncompressed backup available at: $BACKUP_DIR/$BACKUP_FILE"
    fi
else
    echo "❌ Database backup failed!"
    echo "Please check your database connection and credentials."
    exit 1
fi

echo ""
echo "🔒 Security note: The backup contains sensitive data. Store it securely."
