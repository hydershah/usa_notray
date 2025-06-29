#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Add Node.js 20 to PATH
export PATH="/usr/local/opt/node@20/bin:$PATH"

# Ensure we use .env DATABASE_URL instead of system environment variable
unset DATABASE_URL

# Start the development server
echo "Starting NotaryPro development server..."
echo "Access the app at: http://localhost:3000"
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

# Start the client (Vite) - run in background
if [ -d "client" ]; then
    echo "Starting client development server..."
    (cd client && npm run dev) &
    CLIENT_PID=$!
else
    echo "Warning: client directory not found, skipping client server"
fi

# Start the server (Express with tsx) - run in background
echo "Starting server..."
NODE_ENV=development npx tsx --watch server/index.ts &
SERVER_PID=$!

# Wait for user interrupt (Ctrl+C)
echo "Development servers started. Press Ctrl+C to stop."
wait 