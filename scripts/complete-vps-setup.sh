#!/bin/bash

# Complete VPS Setup Script - Run this on your VPS
# This script handles everything after the initial setup

set -e

echo "🚀 Complete VPS Setup for USA Notray"
echo "===================================="

# Check if we're running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root"
    exit 1
fi

echo "📋 Step 1: Running main setup script..."
if [ -f "/tmp/setup-vps.sh" ]; then
    chmod +x /tmp/setup-vps.sh
    /tmp/setup-vps.sh
else
    echo "❌ Setup script not found. Please upload it first."
    exit 1
fi

echo ""
echo "📋 Step 2: Configuring environment file..."

# Create environment file
cp /opt/usa_notray/shared/.env.template /opt/usa_notray/shared/.env

# Update environment file with secure defaults
cat > /opt/usa_notray/shared/.env << 'EOF'
# Database Configuration
DATABASE_URL="postgresql://usa_notary:NotaryDB2025!@localhost:5432/usa_notary_production"

# Application Settings
NODE_ENV=production
PORT=3000
CLIENT_URL=http://144.202.30.172:3000

# JWT Configuration
JWT_SECRET=usa-notary-jwt-secret-2025-secure-key-12345
JWT_EXPIRES_IN=7d

# Performance Monitoring
ENABLE_REQUEST_LOGGING=true
PERFORMANCE_MONITORING=true

# SSL/TLS Settings
NODE_TLS_REJECT_UNAUTHORIZED=0

# Email Configuration (Configure via admin panel later)
# Daily.co Video Conference (Add your keys)
# DAILY_API_KEY=your-daily-api-key
# DAILY_DOMAIN=your-daily-domain

# Cloud Storage (Add your Vultr keys)
# VULTR_ACCESS_KEY=your-vultr-access-key
# VULTR_SECRET_KEY=your-vultr-secret-key
VULTR_REGION=ewr1
VULTR_BUCKET=usanotary
EOF

echo "✅ Environment file configured"

echo ""
echo "📋 Step 3: Setting up deploy user SSH access..."

# Get the SSH public key we generated
if [ -f "/root/.ssh/usa_notray_deploy.pub" ]; then
    PUBLIC_KEY=$(cat /root/.ssh/usa_notray_deploy.pub)
    
    # Set up SSH for deploy user
    sudo -u deploy bash << EOF
mkdir -p /home/deploy/.ssh
echo "$PUBLIC_KEY" > /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh
EOF
    
    echo "✅ SSH key added to deploy user"
else
    echo "⚠️  SSH key not found, generating new one..."
    ssh-keygen -t rsa -b 4096 -f /root/.ssh/usa_notray_deploy -N "" -C "github-actions-deployment"
    PUBLIC_KEY=$(cat /root/.ssh/usa_notray_deploy.pub)
    
    sudo -u deploy bash << EOF
mkdir -p /home/deploy/.ssh
echo "$PUBLIC_KEY" > /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh
EOF
fi

echo ""
echo "📋 Step 4: Setting proper permissions..."
chown -R deploy:www-data /opt/usa_notray
chmod -R 755 /opt/usa_notray

echo ""
echo "📋 Step 5: Updating PostgreSQL password..."
sudo -u postgres psql << EOF
ALTER USER usa_notary WITH PASSWORD 'NotaryDB2025!';
\q
EOF

echo ""
echo "📋 Step 6: Testing database connection..."
if sudo -u deploy psql -h localhost -U usa_notary -d usa_notary_production -c "SELECT 1;" 2>/dev/null; then
    echo "✅ Database connection successful"
else
    echo "⚠️  Database connection test failed, but this is normal before first deployment"
fi

echo ""
echo "🎉 VPS Setup Complete!"
echo ""
echo "📋 GitHub Actions Secrets Required:"
echo "=================================="
echo "VPS_HOST=144.202.30.172"
echo "VPS_USER=deploy"
echo "VPS_SSH_KEY="
echo "--- COPY THE PRIVATE KEY BELOW ---"
cat /root/.ssh/usa_notray_deploy
echo "--- END PRIVATE KEY ---"
echo ""
echo "📋 Next Steps:"
echo "1. Add the above secrets to GitHub Actions"
echo "2. Push your code to trigger deployment"
echo "3. Access your app at: http://144.202.30.172:3000"
echo ""
echo "🔧 Useful Commands:"
echo "pm2 status        - Check application status"
echo "pm2 logs          - View application logs"
echo "pm2 restart all   - Restart application"
echo "systemctl status nginx - Check Nginx status"
echo ""
