#!/bin/bash

echo "🚀 Setting up USA Notary Platform Environment..."

# Create .env file with all required configurations
cat > .env << EOF
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/notary_platform"

# JWT Configuration
JWT_SECRET="notary-platform-jwt-secret-$(date +%s)"

# Email Configuration (Hostinger SMTP)
SMTP_HOST="smtp.hostinger.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-email@yourdomain.com"
SMTP_PASS="your-email-password"
EMAIL_FROM="USA Notary Platform <noreply@yourdomain.com>"

# EVS Solutions (BlueAssure) API Configuration
EVS_API_KEY="E27235-CE567A22-0D31-474A-B551-252882763208"
EVS_PASSWORD="8aeWPi0XV#AyS#I"
EVS_ENVIRONMENT="production"

# Whereby Video Conferencing
WHEREBY_API_KEY="your-whereby-api-key"
WHEREBY_API_URL="https://api.whereby.dev/v1"

# Stripe Payment Processing
STRIPE_SECRET_KEY="sk_test_your_stripe_secret_key"
STRIPE_PUBLISHABLE_KEY="pk_test_your_stripe_publishable_key"
STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret"

# AWS Services
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="notary-platform-documents"

# Redis Configuration
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD=""

# Google OAuth (Optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Security Configuration
SESSION_SECRET="session-secret-$(date +%s)"
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Application Configuration
NODE_ENV="development"
PORT=3000
FRONTEND_URL="http://localhost:5173"
BACKEND_URL="http://localhost:3000"

# File Upload Configuration
MAX_FILE_SIZE_MB=50
ALLOWED_FILE_TYPES="pdf,doc,docx,jpg,jpeg,png"

# Session Recording Storage
RECORDING_RETENTION_YEARS=10
RECORDING_STORAGE_PATH="./recordings"

# Knowledge-Based Authentication (KBA)
KBA_PROVIDER="evs"
KBA_API_KEY="E27235-CE567A22-0D31-474A-B551-252882763208"
KBA_PASSWORD="8aeWPi0XV#AyS#I"
KBA_ENVIRONMENT="production"

# Digital Certificate Authority
CA_API_KEY="your-ca-api-key"
CA_ENVIRONMENT="sandbox"

# Monitoring and Logging
LOG_LEVEL="info"
ENABLE_REQUEST_LOGGING=true
PERFORMANCE_MONITORING=true
EOF

echo "✅ Environment variables configured!"

# Run database migrations
echo "🔄 Running database migrations..."

# Migration 1: Complete EVS data storage
if [ -f "migration-complete-evs-data-storage.sql" ]; then
    echo "Running EVS data storage migration..."
    npm run db:migrate migration-complete-evs-data-storage.sql
    echo "✅ EVS data storage migration completed!"
else
    echo "⚠️ EVS data storage migration file not found"
fi

# Migration 2: ID verification requirements
if [ -f "migration-id-verification-requirements.sql" ]; then
    echo "Running ID verification requirements migration..."
    npm run db:migrate migration-id-verification-requirements.sql
    echo "✅ ID verification requirements migration completed!"
else
    echo "⚠️ ID verification requirements migration file not found"
fi

echo "🔧 Running additional setup tasks..."

# Create necessary directories
mkdir -p uploads
mkdir -p recordings
mkdir -p temp
mkdir -p logs

echo "📁 Directory structure created!"

# Install any missing dependencies
echo "📦 Installing dependencies..."
npm install

echo "🧪 Testing EVS integration..."
npm run evs:test

echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update your database URL in .env"
echo "2. Configure your email settings"
echo "3. Add your Whereby API key"
echo "4. Set up Stripe keys for payments"
echo "5. Configure AWS credentials for cloud storage"
echo ""
echo "🚀 Run 'npm run dev' to start the development server!" 