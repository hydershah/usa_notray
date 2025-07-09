#!/bin/bash

echo "🚀 Deploying USA Notary Platform to STAGING"
echo "============================================="

# Check if fly CLI is available
if ! command -v flyctl &> /dev/null; then
    echo "❌ flyctl not found. Please install fly CLI first."
    exit 1
fi

# Set environment variables for staging
export NODE_ENV=staging
export FLY_APP_NAME=usa-notray-staging

echo "📋 Staging Environment Details:"
echo "   App: $FLY_APP_NAME"
echo "   Environment: $NODE_ENV"
echo "   URL: https://usa-notray-staging.fly.dev"
echo ""

# Deploy to staging
echo "🔨 Building and deploying to staging..."
flyctl deploy --config fly.staging.toml

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Staging deployment successful!"
    echo "🌐 Visit: https://usa-notray-staging.fly.dev"
    echo ""
    echo "🧪 Next steps:"
    echo "1. Test your changes on staging"
    echo "2. If everything works, run: ./scripts/deploy-production.sh"
else
    echo ""
    echo "❌ Staging deployment failed!"
    echo "Check the logs above for errors."
    exit 1
fi 