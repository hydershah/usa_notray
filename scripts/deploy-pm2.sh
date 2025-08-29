#!/bin/bash

# PM2 Deployment Script for USA Notary
# This script can be used for manual deployment or testing

set -e  # Exit on any error

# Configuration
APP_NAME="usa-notary"
APP_DIR="/opt/usa_notray"
CURRENT_DIR="$APP_DIR/current"
RELEASES_DIR="$APP_DIR/releases"
SHARED_DIR="$APP_DIR/shared"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RELEASE_DIR="$RELEASES_DIR/$TIMESTAMP"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   error "This script should not be run as root"
   exit 1
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    error "PM2 is not installed. Please install it first: npm install -g pm2"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    error "Node.js is not installed. Please install it first."
    exit 1
fi

log "Starting PM2 deployment for $APP_NAME..."

# Create directories if they don't exist
log "Creating directory structure..."
mkdir -p "$RELEASES_DIR" "$SHARED_DIR" "$APP_DIR/logs" "$APP_DIR/uploads" "$APP_DIR/certificates"

# Check if we're in the right directory (should be in project root)
if [ ! -f "package.json" ] || [ ! -f "ecosystem.config.js" ]; then
    error "Please run this script from the project root directory"
    exit 1
fi

# Build the application
log "Building application..."
npm run build:client
npm run build:server

# Create release directory
log "Creating release directory: $RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

# Copy files to release directory
log "Copying application files..."
cp -r dist/ "$RELEASE_DIR/"
cp -r shared/ "$RELEASE_DIR/"
cp -r migrations/ "$RELEASE_DIR/"
cp package.json "$RELEASE_DIR/"
cp package-lock.json "$RELEASE_DIR/"
cp ecosystem.config.js "$RELEASE_DIR/"

# Copy essential scripts
if [ -f "scripts/seed-essential-data.ts" ]; then
    cp scripts/seed-essential-data.ts "$RELEASE_DIR/scripts/"
fi
if [ -f "scripts/health-check.ts" ]; then
    cp scripts/health-check.ts "$RELEASE_DIR/scripts/"
fi

# Navigate to release directory
cd "$RELEASE_DIR"

# Install production dependencies
log "Installing production dependencies..."
npm ci --production --silent

# Copy environment file
if [ -f "$SHARED_DIR/.env" ]; then
    log "Copying environment file..."
    cp "$SHARED_DIR/.env" .env
else
    warning "No .env file found in $SHARED_DIR"
fi

# Create necessary directories
mkdir -p uploads certificates logs
chmod 755 uploads certificates logs

# Run database migrations
log "Running database migrations..."
if npm run db:push &> /dev/null; then
    success "Database migrations completed"
else
    warning "Database migrations failed or not configured"
fi

# Seed essential data (only on first deployment)
if [ ! -f "$SHARED_DIR/.seeded" ] && npm run db:seed &> /dev/null; then
    log "Seeding essential data..."
    touch "$SHARED_DIR/.seeded"
    success "Essential data seeded"
fi

# Update symlink
log "Updating current symlink..."
ln -sfn "$RELEASE_DIR" "$CURRENT_DIR"
success "Symlink updated to $RELEASE_DIR"

# Deploy with PM2
log "Deploying with PM2..."
if pm2 describe "$APP_NAME" &> /dev/null; then
    log "Restarting existing PM2 process..."
    pm2 restart "$APP_NAME"
else
    log "Starting new PM2 process..."
    pm2 start ecosystem.config.js
fi

# Save PM2 configuration
pm2 save

# Wait for app to start
log "Waiting for application to start..."
sleep 15

# Check PM2 status
log "Checking PM2 status..."
pm2 status

# Health check
log "Performing health check..."
if curl -f http://localhost:3000/health &> /dev/null; then
    success "Health check passed!"
else
    warning "Health check failed. Application might still be starting..."
fi

# Cleanup old releases (keep only 5 most recent)
log "Cleaning up old releases..."
cd "$RELEASES_DIR"
ls -t | tail -n +6 | xargs -r rm -rf

# Final status
log "Deployment completed!"
success "Application deployed to: $RELEASE_DIR"
success "PM2 process: $APP_NAME"
log "Current symlink: $CURRENT_DIR"
log "PM2 logs: pm2 logs $APP_NAME"
log "PM2 status: pm2 status"
log "Health check: curl http://localhost:3000/health"

# Show recent logs
log "Recent PM2 logs:"
pm2 logs "$APP_NAME" --lines 10
