#!/bin/bash

echo "🔍 Checking for processes using port 3000..."

# Find processes using port 3000
PROCESSES=$(lsof -ti:3000)

if [ -z "$PROCESSES" ]; then
    echo "✅ No processes found using port 3000"
else
    echo "🚫 Found processes using port 3000: $PROCESSES"
    echo "🔪 Killing processes..."
    kill -9 $PROCESSES
    echo "✅ Processes killed successfully"
fi

# Also kill any node processes that might be related
echo "🔍 Checking for Node.js processes..."
pkill -f "node.*usa_notray" 2>/dev/null || true
pkill -f "dist/index.js" 2>/dev/null || true

echo "🧹 Port 3000 is now available"
echo "🚀 You can now start the server with: npm start" 