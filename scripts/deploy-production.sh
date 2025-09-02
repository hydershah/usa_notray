#!/bin/bash

set -e

echo "Deploying to production via PM2..."

npm ci
npm run build:production
npm prune --production

if pm2 list | grep -q "usa-notray"; then
  pm2 reload ecosystem.config.js --update-env --env production
else
  pm2 start ecosystem.config.js --env production
fi

pm2 save
echo "Done."

#!/bin/bash

echo "🚀 Deploying USA Notary Platform to PRODUCTION"
echo "==============================================="

# Check if fly CLI is available
if ! command -v flyctl &> /dev/null; then
    echo "❌ flyctl not found. Please install fly CLI first."
    exit 1
fi

# Set environment variables for production
export NODE_ENV=production
export FLY_APP_NAME=usa-notray-muddy-sound-7799

echo "📋 Production Environment Details:"
echo "   App: $FLY_APP_NAME"
echo "   Environment: $NODE_ENV"
echo "   URL: https://usa-notray-muddy-sound-7799.fly.dev"
echo ""

# Safety check - ask for confirmation
echo "⚠️  You are about to deploy to PRODUCTION!"
echo "   This will affect live users."
echo ""
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Production deployment cancelled."
    exit 1
fi

echo ""
echo "🔨 Building and deploying to production..."
flyctl deploy --config fly.toml

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Production deployment successful!"
    echo "🌐 Visit: https://usa-notray-muddy-sound-7799.fly.dev"
    echo ""
    echo "📊 Post-deployment checklist:"
    echo "1. Check app health: flyctl status"
    echo "2. Monitor logs: flyctl logs"
    echo "3. Test critical features"
    echo "4. Notify team of deployment"
else
    echo ""
    echo "❌ Production deployment failed!"
    echo "Check the logs above for errors."
    echo "Consider rolling back if needed."
    exit 1
fi 