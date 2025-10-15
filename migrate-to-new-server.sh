#!/bin/bash

# USA Notary - New Server Migration Script
# Target Server: 31.220.50.80
# Date: October 15, 2025

set -e  # Exit on error

echo "=========================================="
echo "USA Notary - Server Migration Script"
echo "=========================================="
echo ""

# Configuration
NEW_SERVER_IP="31.220.50.80"
NEW_SERVER_USER="root"
APP_DIR="/opt/usa_notray"
REPO_URL="https://github.com/hydershah/usa_notray.git"
BRANCH="v10.7"
NODE_VERSION="20.19.4"

echo "Target Server: $NEW_SERVER_USER@$NEW_SERVER_IP"
echo "App Directory: $APP_DIR"
echo "Branch: $BRANCH"
echo ""

# Step 1: Test SSH Connection
echo "Step 1: Testing SSH connection..."
ssh -o ConnectTimeout=10 $NEW_SERVER_USER@$NEW_SERVER_IP "echo 'SSH connection successful'" || {
    echo "Error: Cannot connect to server. Please check:"
    echo "  - Server IP is correct"
    echo "  - SSH is running on the server"
    echo "  - Your SSH key is added to the server"
    exit 1
}
echo "✓ SSH connection verified"
echo ""

# Step 2: Setup Server Environment
echo "Step 2: Setting up server environment..."
ssh $NEW_SERVER_USER@$NEW_SERVER_IP << 'ENDSSH'
set -e

echo "Installing system dependencies..."
apt-get update
apt-get install -y curl git build-essential nginx postgresql postgresql-contrib redis-server

echo "Installing NVM..."
if [ ! -d "$HOME/.nvm" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "Installing Node.js..."
nvm install 20.19.4
nvm use 20.19.4
nvm alias default 20.19.4

echo "Installing PM2 globally..."
npm install -g pm2

echo "Creating application directory..."
mkdir -p /opt/usa_notray/logs
mkdir -p /opt/usa_notray/uploads
mkdir -p /opt/usa_notray/certificates

echo "✓ Server environment setup complete"
ENDSSH
echo ""

# Step 3: Clone Repository
echo "Step 3: Cloning repository..."
ssh $NEW_SERVER_USER@$NEW_SERVER_IP << ENDSSH
set -e

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd /opt

if [ -d "usa_notray/.git" ]; then
    echo "Repository exists, pulling latest changes..."
    cd usa_notray
    git fetch origin
    git checkout $BRANCH
    git pull origin $BRANCH
else
    echo "Cloning repository..."
    git clone $REPO_URL usa_notray
    cd usa_notray
    git checkout $BRANCH
fi

echo "✓ Repository ready"
ENDSSH
echo ""

# Step 4: Transfer Environment File
echo "Step 4: Transferring environment configuration..."
if [ -f ".env" ]; then
    echo "Copying .env file to server..."
    scp .env $NEW_SERVER_USER@$NEW_SERVER_IP:$APP_DIR/.env
    echo "✓ Environment file transferred"
else
    echo "⚠ Warning: No .env file found locally"
    echo "Please create .env file on the server with required environment variables"
fi
echo ""

# Step 5: Install Dependencies and Build
echo "Step 5: Installing dependencies and building..."
ssh $NEW_SERVER_USER@$NEW_SERVER_IP << 'ENDSSH'
set -e

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd /opt/usa_notray

echo "Installing dependencies..."
npm ci --include=dev

echo "Building application..."
npm run build:production

echo "Pruning dev dependencies..."
npm prune --omit=dev

echo "✓ Build complete"
ENDSSH
echo ""

# Step 6: Configure Nginx (optional reverse proxy)
echo "Step 6: Configure Nginx..."
read -p "Do you want to configure Nginx as reverse proxy? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter domain name (or press Enter to skip): " DOMAIN_NAME
    
    if [ ! -z "$DOMAIN_NAME" ]; then
        ssh $NEW_SERVER_USER@$NEW_SERVER_IP << ENDSSH
cat > /etc/nginx/sites-available/usa-notary << 'EOF'
server {
    listen 80;
    server_name $DOMAIN_NAME;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/usa-notary /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo "✓ Nginx configured for $DOMAIN_NAME"
ENDSSH
    fi
fi
echo ""

# Step 7: Setup Database
echo "Step 7: Database setup..."
read -p "Do you need to restore a database backup? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Available backup files:"
    ls -lh backups/*.sql 2>/dev/null || echo "No backup files found in ./backups/"
    read -p "Enter backup file path (or press Enter to skip): " BACKUP_FILE
    
    if [ ! -z "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE" ]; then
        echo "Uploading backup file..."
        scp "$BACKUP_FILE" $NEW_SERVER_USER@$NEW_SERVER_IP:/tmp/backup.sql
        
        read -p "Enter database name: " DB_NAME
        read -p "Enter database user: " DB_USER
        read -sp "Enter database password: " DB_PASS
        echo
        
        ssh $NEW_SERVER_USER@$NEW_SERVER_IP << ENDSSH
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" || true
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql $DB_NAME < /tmp/backup.sql
rm /tmp/backup.sql
echo "✓ Database restored"
ENDSSH
    fi
fi
echo ""

# Step 8: Start Application with PM2
echo "Step 8: Starting application with PM2..."
ssh $NEW_SERVER_USER@$NEW_SERVER_IP << 'ENDSSH'
set -e

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd /opt/usa_notray

echo "Starting application..."
pm2 delete usa-notray 2>/dev/null || true
pm2 start ecosystem.config.cjs --env production

echo "Saving PM2 configuration..."
pm2 save

echo "Setting up PM2 startup..."
pm2 startup systemd -u root --hp /root

echo "✓ Application started"
ENDSSH
echo ""

# Step 9: Verify Deployment
echo "Step 9: Verifying deployment..."
ssh $NEW_SERVER_USER@$NEW_SERVER_IP << 'ENDSSH'
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "PM2 Status:"
pm2 list

echo ""
echo "Application Logs (last 20 lines):"
pm2 logs usa-notray --lines 20 --nostream

echo ""
echo "Testing health endpoint..."
sleep 5
curl -s http://localhost:3000/health || echo "Health check failed"
ENDSSH
echo ""

echo "=========================================="
echo "Migration Complete!"
echo "=========================================="
echo ""
echo "Your application should now be running on $NEW_SERVER_IP:3000"
echo ""
echo "Next steps:"
echo "1. Test the application: http://$NEW_SERVER_IP:3000"
echo "2. Configure your domain DNS to point to $NEW_SERVER_IP"
echo "3. Setup SSL certificate (run: ssh $NEW_SERVER_USER@$NEW_SERVER_IP 'certbot --nginx')"
echo "4. Monitor logs: ssh $NEW_SERVER_USER@$NEW_SERVER_IP 'pm2 logs usa-notray'"
echo ""
echo "Useful commands:"
echo "  - View status: ssh $NEW_SERVER_USER@$NEW_SERVER_IP 'pm2 list'"
echo "  - View logs: ssh $NEW_SERVER_USER@$NEW_SERVER_IP 'pm2 logs'"
echo "  - Restart app: ssh $NEW_SERVER_USER@$NEW_SERVER_IP 'pm2 restart usa-notray'"
echo ""

