#!/bin/bash

echo "🚀 Starting USA Notary Platform with Redis configuration..."

# Set Redis environment variables
export REDIS_URL="redis://localhost:6379"
export REDIS_PASSWORD=""
export CACHE_KEY_PREFIX="usa_notary:"

# Set other essential environment variables for development
export NODE_ENV="development"
export PORT=3000
export DATABASE_URL="postgresql://username:password@localhost:5432/notary_platform"
export JWT_SECRET="notary-platform-jwt-secret-dev"
export SESSION_SECRET="session-secret-dev"

# Application URLs
export CLIENT_URL="http://localhost:5173"
export SERVER_URL="http://localhost:3000"
export FRONTEND_URL="http://localhost:5173"
export BACKEND_URL="http://localhost:3000"
export WS_URL="ws://localhost:3000"
export API_URL="http://localhost:3000/api"

# Logging
export LOG_LEVEL="info"
export ENABLE_REQUEST_LOGGING=true

echo "✅ Environment variables configured:"
echo "   REDIS_URL: $REDIS_URL"
echo "   NODE_ENV: $NODE_ENV"
echo "   PORT: $PORT"

# Test Redis connection first
echo "🔍 Testing Redis connection..."
node test-redis-connection.js

if [ $? -eq 0 ]; then
    echo "✅ Redis test passed, starting application..."
    # Start the development server
    npm run dev
else
    echo "❌ Redis test failed. Please check Redis service."
    exit 1
fi 