#!/bin/bash

echo "🚀 USA Notary Platform - Deployment Preparation"
echo "=============================================="

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📁 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit for deployment"
fi

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    echo "Please run: npm install -g @railway/cli"
    echo "Then run this script again."
    exit 1
fi

echo "✅ Railway CLI found"

# Check for required files
echo "🔍 Checking deployment files..."
if [ ! -f "Dockerfile" ]; then
    echo "❌ Dockerfile not found"
    exit 1
fi

if [ ! -f "railway.json" ]; then
    echo "❌ railway.json not found"
    exit 1
fi

echo "✅ All deployment files present"

# Build test
echo "🔨 Testing local build..."
if npm run build; then
    echo "✅ Build successful"
else
    echo "❌ Build failed. Please fix build errors before deploying."
    exit 1
fi

echo ""
echo "🎯 Ready for deployment!"
echo ""
echo "Next steps:"
echo "1. Go to https://railway.app and sign up/login"
echo "2. Run: railway login"
echo "3. Run: railway init"
echo "4. Add PostgreSQL: railway add postgresql"
echo "5. Add Redis (optional): railway add redis"
echo "6. Set environment variables in Railway dashboard"
echo "7. Run: railway up"
echo ""
echo "📋 Don't forget to:"
echo "• Set your production environment variables in Railway dashboard"
echo "• Configure your domain in Railway settings"
echo "• Run database migrations after first deployment"
echo ""

# Make the script executable
chmod +x deploy.sh 