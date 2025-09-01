#!/bin/bash

# USA Notary Deployment Script
# This script handles the complete deployment process

set -e  # Exit on any error

echo "🚀 Starting USA Notary deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_error "PM2 is not installed. Please install it first: npm install -g pm2"
    exit 1
fi

# Environment selection
ENV=${1:-production}
print_status "Deploying to environment: $ENV"

# Clean previous builds
print_status "Cleaning previous builds..."
npm run build:clean

# Install dependencies
print_status "Installing dependencies..."
npm ci --only=production

# Build the application
print_status "Building application..."
npm run build:production

# Validate build
if [ ! -f "dist/index.cjs" ]; then
    print_error "Build failed - dist/index.cjs not found"
    exit 1
fi

print_status "Build completed successfully!"

# Create logs directory if it doesn't exist
mkdir -p logs

# Stop existing PM2 process if running
if pm2 list | grep -q "usa-notary"; then
    print_status "Stopping existing PM2 process..."
    pm2 stop usa-notary || true
    pm2 delete usa-notary || true
fi

# Start the application with PM2
print_status "Starting application with PM2..."
pm2 start ecosystem.config.js --env $ENV

# Save PM2 configuration
print_status "Saving PM2 configuration..."
pm2 save

# Setup PM2 to start on system boot
print_status "Setting up PM2 startup script..."
pm2 startup

# Show status
print_status "Deployment completed! Current PM2 status:"
pm2 list

# Show logs
print_status "Recent logs:"
pm2 logs usa-notary --lines 20

print_status "✅ Deployment completed successfully!"
print_status "📊 Monitor your app with: pm2 monit"
print_status "📝 View logs with: pm2 logs usa-notary"
print_status "🔄 Restart with: pm2 restart usa-notary"
