#!/bin/bash

# Quick manual tests for TypeScript issues
# Run this script to quickly check if the server starts and basic endpoints respond

echo "🧪 MANUAL TESTING CHECKLIST"
echo "=========================="

BASE_URL=${BASE_URL:-"http://localhost:3000"}

echo "Testing against: $BASE_URL"
echo ""

# Test 1: Server Health Check
echo "1. 🏥 Testing server health..."
if curl -s -f "$BASE_URL/api/health" > /dev/null; then
    echo "   ✅ Server is responding"
else
    echo "   ❌ Server is not responding"
    echo "   Make sure the server is running with: npm run dev"
    exit 1
fi

# Test 2: Registration endpoint accessibility
echo "2. 📝 Testing registration endpoint accessibility..."
REGISTER_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"test": "data"}')

if [ "$REGISTER_RESPONSE" != "000" ]; then
    echo "   ✅ Registration endpoint is accessible (HTTP $REGISTER_RESPONSE)"
else
    echo "   ❌ Registration endpoint is not accessible"
fi

# Test 3: Login endpoint accessibility
echo "3. 🔐 Testing login endpoint accessibility..."
LOGIN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"test": "data"}')

if [ "$LOGIN_RESPONSE" != "000" ]; then
    echo "   ✅ Login endpoint is accessible (HTTP $LOGIN_RESPONSE)"
else
    echo "   ❌ Login endpoint is not accessible"
fi

# Test 4: Jobs endpoint accessibility (requires auth)
echo "4. 💼 Testing jobs endpoint accessibility..."
JOBS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/api/jobs")

if [ "$JOBS_RESPONSE" != "000" ]; then
    echo "   ✅ Jobs endpoint is accessible (HTTP $JOBS_RESPONSE)"
else
    echo "   ❌ Jobs endpoint is not accessible"
fi

echo ""
echo "📋 MANUAL TEST CHECKLIST:"
echo "========================"
echo "Now test these manually in your browser or API client:"
echo ""
echo "🔗 Registration Test:"
echo "   POST $BASE_URL/api/auth/register"
echo "   Body: {"
echo "     \"email\": \"manual-test@example.com\","
echo "     \"password\": \"ManualTest123!\","
echo "     \"firstName\": \"Manual\","
echo "     \"lastName\": \"Test\""
echo "   }"
echo ""
echo "🔗 Login Test:"
echo "   POST $BASE_URL/api/auth/login"
echo "   Body: {"
echo "     \"email\": \"manual-test@example.com\","
echo "     \"password\": \"ManualTest123!\""
echo "   }"
echo ""
echo "🔗 File Upload Test:"
echo "   POST $BASE_URL/api/jobs (with Authorization header)"
echo "   Form data with file upload"
echo ""
echo "📊 What to look for:"
echo "   - TypeScript compilation errors in server logs"
echo "   - Runtime errors in API responses"
echo "   - 500 Internal Server Error responses"
echo "   - Database connection issues"
echo "   - File upload/download failures"
echo ""
echo "✅ Run the automated tests with:"
echo "   npm run test:registration"
echo "   npm run test:files"
echo "   npm run test:database"
