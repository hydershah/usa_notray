#!/bin/bash

echo "🔍 Verifying deployment files..."

# Check if required files exist
echo "📁 Checking required files..."

REQUIRED_FILES=(
    "dist/index.cjs"
    "package.json"
    "package-lock.json"
    "ecosystem.config.js"
)

MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file (missing)"
        MISSING_FILES+=("$file")
    fi
done

# Check if shared directory exists
if [ -d "shared" ]; then
    echo "✅ shared/ directory"
else
    echo "❌ shared/ directory (missing)"
    MISSING_FILES+=("shared/")
fi

# Check if dist directory has content
if [ -d "dist" ]; then
    echo "📦 dist/ directory contents:"
    ls -la dist/
    
    # Check if dist/index.cjs is executable
    if [ -x "dist/index.cjs" ]; then
        echo "✅ dist/index.cjs is executable"
    else
        echo "⚠️ dist/index.cjs is not executable (this is normal for .cjs files)"
    fi
else
    echo "❌ dist/ directory not found"
    MISSING_FILES+=("dist/")
fi

# Check ecosystem.config.js format
if [ -f "ecosystem.config.js" ]; then
    echo "🔧 Checking ecosystem.config.js format..."
    if node -e "
        try {
            const config = await import('./ecosystem.config.js');
            console.log('✅ ecosystem.config.js is valid ES module');
            console.log('📱 App name:', config.default.apps[0].name);
            console.log('📜 Script path:', config.default.apps[0].script);
        } catch (error) {
            console.error('❌ ecosystem.config.js error:', error.message);
            process.exit(1);
        }
    "; then
        echo "✅ ecosystem.config.js validation passed"
    else
        echo "❌ ecosystem.config.js validation failed"
        MISSING_FILES+=("ecosystem.config.js (invalid)")
    fi
fi

# Summary
if [ ${#MISSING_FILES[@]} -eq 0 ]; then
    echo "🎉 All required files are present and valid!"
    echo "📦 Ready for deployment"
    exit 0
else
    echo "❌ Missing or invalid files:"
    for file in "${MISSING_FILES[@]}"; do
        echo "   - $file"
    done
    echo "🔧 Please fix these issues before deploying"
    exit 1
fi
