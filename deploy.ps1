# USA Notary Deployment Script for Windows
# This script handles the complete deployment process on Windows

param(
    [string]$Environment = "production"
)

Write-Host "🚀 Starting USA Notary deployment..." -ForegroundColor Green

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Error "package.json not found. Please run this script from the project root."
    exit 1
}

# Check if PM2 is installed
try {
    $pm2Version = pm2 --version
    Write-Status "PM2 version: $pm2Version"
} catch {
    Write-Error "PM2 is not installed. Please install it first: npm install -g pm2"
    exit 1
}

Write-Status "Deploying to environment: $Environment"

# Clean previous builds
Write-Status "Cleaning previous builds..."
npm run build:clean

# Install dependencies (include dev deps for build)
Write-Status "Installing dependencies..."
npm ci

# Build the application
Write-Status "Building application..."
npm run build:production

# Validate build
if (-not (Test-Path "dist/index.cjs")) {
    Write-Error "Build failed - dist/index.cjs not found"
    exit 1
}

Write-Status "Build completed successfully!"

# Prune devDependencies for runtime
Write-Status "Pruning dev dependencies for production runtime..."
npm prune --production

# Create logs directory if it doesn't exist
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" -Force
}

# Stop existing PM2 process if running
try {
    $pm2List = pm2 list
    if ($pm2List -match "usa-notray") {
        Write-Status "Stopping existing PM2 process..."
        pm2 stop usa-notray
        pm2 delete usa-notray
    }
} catch {
    Write-Warning "No existing PM2 process found or error stopping it"
}

# Start the application with PM2
Write-Status "Starting application with PM2..."
pm2 start ecosystem.config.js --env $Environment

# Save PM2 configuration
Write-Status "Saving PM2 configuration..."
pm2 save

# Setup PM2 to start on system boot
Write-Status "Setting up PM2 startup script..."
pm2 startup

# Show status
Write-Status "Deployment completed! Current PM2 status:"
pm2 list

# Show logs
Write-Status "Recent logs:"
pm2 logs usa-notray --lines 20

Write-Status "✅ Deployment completed successfully!"
Write-Status "📊 Monitor your app with: pm2 monit"
Write-Status "📝 View logs with: pm2 logs usa-notray"
Write-Status "🔄 Restart with: pm2 restart usa-notray"
