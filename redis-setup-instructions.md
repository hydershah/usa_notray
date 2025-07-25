# Redis Setup Instructions

## Issue Fixed ✅
Redis is running properly on your system. The issue was missing environment variables.

## What was wrong:
- Redis service is running on localhost:6379 ✅
- Application couldn't connect because `REDIS_URL` environment variable was not set ❌

## Solution:

### Option 1: Quick Start (Recommended)
Run the application with Redis support:
```bash
./start-with-redis.sh
```

### Option 2: Manual Environment Setup
Create a `.env` file in the project root with these essential variables:

```env
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
CACHE_KEY_PREFIX=usa_notary:

# Essential App Variables
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://username:password@localhost:5432/notary_platform
JWT_SECRET=notary-platform-jwt-secret-dev
SESSION_SECRET=session-secret-dev
```

### Option 3: Export Environment Variables
```bash
export REDIS_URL="redis://localhost:6379"
export NODE_ENV="development"
# Then run: npm run dev
```

## Test Redis Connection
Run this anytime to verify Redis is working:
```bash
node test-redis-connection.js
```

## Files Created:
- `test-redis-connection.js` - Redis connection test script
- `start-with-redis.sh` - Startup script with Redis environment variables
- `redis-setup-instructions.md` - This instruction file

## Cleanup (Optional):
To remove test files after setup:
```bash
rm test-redis-connection.js redis-setup-instructions.md
``` 