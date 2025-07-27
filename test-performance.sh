#!/bin/bash

# 🧪 Performance Test Runner for Job Creation Optimizations
# Tests the parallel optimizations we implemented

echo "🚀 JOB CREATION PERFORMANCE TEST RUNNER"
echo "========================================"

# Check if server is running
echo "🔗 Checking if server is running..."
if ! curl -s http://localhost:3000/health >/dev/null 2>&1; then
    echo "❌ Server is not running on http://localhost:3000"
    echo "Please start the server with: npm run dev"
    exit 1
fi

echo "✅ Server is running"

# Get authentication token (if needed)
echo "🔑 Setting up authentication..."
export TEST_TOKEN=${1:-"your-test-token"}

if [ "$TEST_TOKEN" = "your-test-token" ]; then
    echo "⚠️  Using default test token. Pass your actual token as first argument:"
    echo "   ./test-performance.sh YOUR_ACTUAL_TOKEN"
fi

# Run the performance tests
echo "🧪 Running performance tests..."
echo ""

node test-job-creation-performance.js

echo ""
echo "🎯 TEST COMPLETED!"
echo ""
echo "📋 WHAT TO LOOK FOR:"
echo "• Job creation time < 6 seconds (vs previous 15-20s)"
echo "• Performance improvement > 60%"
echo "• Success rate > 90%"
echo "• Parallel bcrypt operations working"
echo "• Parallel file uploads working"
echo ""
echo "📊 Results saved to performance-test-results-*.json" 