#!/bin/bash

echo "🧪 Testing build process..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
npm run build:clean

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm ci
fi

# Build the application
echo "🔨 Building application..."
npm run build:production

# Verify build output
echo "✅ Verifying build output..."
if [ -f "dist/index.cjs" ]; then
    echo "✅ dist/index.cjs found successfully"
    echo "📁 Build contents:"
    ls -la dist/
    
    # Test if the built file can be executed
    echo "🧪 Testing built file..."
    if node -c dist/index.cjs; then
        echo "✅ Built file syntax is valid"
    else
        echo "❌ Built file has syntax errors"
        exit 1
    fi
else
    echo "❌ dist/index.cjs not found"
    echo "📁 Current directory contents:"
    ls -la
    echo "📁 dist/ directory contents (if exists):"
    ls -la dist/ 2>/dev/null || echo "dist/ directory does not exist"
    exit 1
fi

echo "🎉 Build test completed successfully!"
