#!/bin/bash

echo "🚀 USA Notary Platform - Deployment Manager"
echo "==========================================="

# Check if fly CLI is available
if ! command -v flyctl &> /dev/null; then
    echo "❌ flyctl not found. Please install fly CLI first."
    echo "Run: curl -L https://fly.io/install.sh | sh"
    exit 1
fi

echo ""
echo "📋 Available environments:"
echo "1. Staging   - https://usa-notray-staging.fly.dev"
echo "2. Production - https://usa-notray-muddy-sound-7799.fly.dev"
echo ""

# Get user choice
read -p "Select environment (1=staging, 2=production): " -n 1 -r
echo ""

case $REPLY in
    1)
        echo "🧪 Deploying to STAGING..."
        ./scripts/deploy-staging.sh
        ;;
    2)
        echo "🔥 Deploying to PRODUCTION..."
        ./scripts/deploy-production.sh
        ;;
    *)
        echo "❌ Invalid option. Please choose 1 or 2."
        exit 1
        ;;
esac 