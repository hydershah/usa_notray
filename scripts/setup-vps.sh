#!/bin/bash

# VPS Setup Script for USA Notray
# Run this script on your VPS to prepare it for deployment

set -e

echo "🚀 Setting up VPS for USA Notray deployment..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
echo "📦 Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Install PostgreSQL
echo "🐘 Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
echo "🌐 Installing Nginx..."
sudo apt install -y nginx

# Install Docker (optional, for containerized deployment)
echo "🐳 Installing Docker..."
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io
sudo usermod -aG docker $USER

# Install Docker Compose
echo "🐳 Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create application directory structure
echo "📁 Creating application directories..."
sudo mkdir -p /opt/usa_notray/{releases,shared,logs}
sudo mkdir -p /opt/usa_notray/shared/{uploads,certificates}

# Create deployment user
echo "👤 Creating deployment user..."
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy
sudo usermod -aG www-data deploy

# Set up PostgreSQL
echo "🐘 Setting up PostgreSQL..."
sudo -u postgres psql << EOF
CREATE USER usa_notray WITH PASSWORD 'secure_password_here';
CREATE DATABASE usa_notray_production OWNER usa_notray;
GRANT ALL PRIVILEGES ON DATABASE usa_notray_production TO usa_notray;
ALTER USER usa_notray CREATEDB;
\q
EOF

# Configure PostgreSQL for performance
echo "🐘 Optimizing PostgreSQL configuration..."
sudo tee -a /etc/postgresql/*/main/postgresql.conf << EOF

# USA Notray Performance Optimizations
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
EOF

# Restart PostgreSQL
sudo systemctl restart postgresql

# Set up Nginx configuration
echo "🌐 Setting up Nginx..."
sudo tee /etc/nginx/sites-available/usa_notray << 'EOF'
upstream usa_notray_app {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    
    # SSL Configuration (will be configured with Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Client uploads
    client_max_body_size 50M;
    
    # Static files
    location /assets {
        alias /opt/usa_notray/current/client/dist/assets;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # WebViewer files
    location /public {
        alias /opt/usa_notray/current/client/public;
        expires 30d;
        add_header Cache-Control "public";
    }
    
    # Uploads
    location /uploads {
        alias /opt/usa_notray/shared/uploads;
        expires 1y;
        add_header Cache-Control "private";
    }
    
    # Health check
    location /health {
        proxy_pass http://usa_notary_app;
        proxy_connect_timeout 1s;
        proxy_read_timeout 1s;
    }
    
    # Main application
    location / {
        proxy_pass http://usa_notary_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/usa_notray /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Create PM2 ecosystem file
echo "⚙️ Creating PM2 configuration..."
sudo tee /opt/usa_notray/shared/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'usa-notary',
    script: '/opt/usa_notray/current/dist/index.cjs',
    cwd: '/opt/usa_notray/current',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/opt/usa_notray/logs/err.log',
    out_file: '/opt/usa_notray/logs/out.log',
    log_file: '/opt/usa_notray/logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
EOF

# Set up logrotate
echo "📝 Setting up log rotation..."
sudo tee /etc/logrotate.d/usa_notray << 'EOF'
/opt/usa_notray/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    notifempty
    create 644 deploy www-data
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# Install Certbot for SSL
echo "🔒 Installing Certbot for SSL..."
sudo apt install -y certbot python3-certbot-nginx

# Set up firewall
echo "🔥 Setting up firewall..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# Set proper ownership
echo "🔐 Setting proper ownership..."
sudo chown -R deploy:www-data /opt/usa_notray
sudo chmod -R 755 /opt/usa_notray

# Create environment template
echo "⚙️ Creating environment template..."
sudo tee /opt/usa_notray/shared/.env.template << 'EOF'
# Database Configuration
DATABASE_URL="postgresql://usa_notray:secure_password_here@localhost:5432/usa_notray_production"

# Application Settings
NODE_ENV=production
PORT=3000
CLIENT_URL=https://your-domain.com

# JWT Configuration
JWT_SECRET=your-very-secure-jwt-secret-here
JWT_EXPIRES_IN=7d

# Email Configuration (Configure via admin panel)
# SMTP_HOST=
# SMTP_PORT=
# SMTP_USER=
# SMTP_PASS=

# Cloud Storage (Vultr Object Storage)
VULTR_ACCESS_KEY=your-vultr-access-key
VULTR_SECRET_KEY=your-vultr-secret-key
VULTR_REGION=ewr1
VULTR_BUCKET=usanotary

# Daily.co Video Conference
DAILY_API_KEY=your-daily-api-key
DAILY_DOMAIN=your-daily-domain

# Performance Monitoring
ENABLE_REQUEST_LOGGING=true
PERFORMANCE_MONITORING=true

# SSL/TLS Settings
NODE_TLS_REJECT_UNAUTHORIZED=0
EOF

echo ""
echo "🎉 VPS setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Copy .env.template to .env and configure your secrets"
echo "2. Set up SSL certificate: sudo certbot --nginx -d your-domain.com"
echo "3. Add your SSH public key to GitHub repository secrets"
echo "4. Configure GitHub Actions secrets:"
echo "   - VPS_HOST: your server IP"
echo "   - VPS_USER: deploy"
echo "   - VPS_SSH_KEY: your private SSH key"
echo "5. Update your domain in Nginx config"
echo "6. Push to main branch to trigger deployment"
echo ""
echo "🔧 Commands to remember:"
echo "- View logs: pm2 logs usa-notary"
echo "- Restart app: pm2 restart usa-notary"
echo "- Check status: pm2 status"
echo "- Monitor: pm2 monit"
echo ""
