#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Add Node.js 20 to PATH
export PATH="/usr/local/opt/node@20/bin:$PATH"

# Ensure we use .env DATABASE_URL instead of system environment variable
unset DATABASE_URL

echo "🚀 Starting NotaryPro..."

# Check if we should run in production mode
if [ "$1" = "production" ] || [ "$NODE_ENV" = "production" ]; then
    echo "🎯 Production Mode - Two-Port Architecture"
    echo ""
    echo "🌐 Frontend: http://localhost:3002"
    echo "🔌 API Server: http://localhost:3000"
    echo ""
    
    # Set environment variables for production two-port setup
    export NODE_ENV=production
    export SERVE_STATIC_FILES=false
    
    # Build the application
    echo "📦 Building application..."
    npm run build
    
    # Start both servers
    echo "🚀 Starting production servers..."
    npm run start:production
else
    echo "🔧 Development Mode"
    echo ""
    echo "🌐 Frontend: http://localhost:3002 (with proxy to API)"
    echo "🔌 API Server: http://localhost:3000"
    echo ""
    echo "Login credentials:"
    echo "Email: admin@usanotary.com"
    echo "Password: admin123"
    echo ""

    # Function to cleanup background processes
    cleanup() {
        echo "Shutting down development server..."
        kill $(jobs -p) 2>/dev/null || true
        exit
    }

    # Set trap to cleanup on script exit
    trap cleanup SIGINT SIGTERM EXIT

    # Start the development servers
    npm run dev
fi 