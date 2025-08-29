#!/bin/bash

# Database Migration Script: Railway → Coolify
# Run this after updating DATABASE_URL in .env

echo "🚀 Starting Railway → Coolify Migration"

# Step 1: Test new connection
echo "📡 Testing Coolify database connection..."
npx tsx scripts/check-current-db.ts

# Step 2: Run schema migrations
echo "🏗️  Running Drizzle schema migrations..."
npm run db:push

# Step 3: Seed essential data
echo "🌱 Seeding closing types..."
npx tsx scripts/seed-closing-types.ts

echo "🌱 Seeding participant roles..."
npx tsx scripts/seed-basic-participant-roles.ts

# Step 4: Performance test
echo "⚡ Testing new database performance..."
npx tsx scripts/compare-db-performance.ts

echo "✅ Migration completed! Check the results above."
