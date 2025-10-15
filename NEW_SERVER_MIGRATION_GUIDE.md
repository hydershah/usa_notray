# USA Notary - New Server Migration Guide

**Target Server:** `root@31.220.50.80`  
**Migration Date:** October 15, 2025  
**Branch:** v10.7

## Overview

This guide walks you through migrating the USA Notary application from the old server to the new server at `31.220.50.80`.

## Prerequisites

Before starting the migration, ensure you have:

- [x] SSH access to the new server (`ssh root@31.220.50.80`)
- [x] Git repository access
- [x] Current database backup (if migrating data)
- [x] All environment variables documented
- [x] Domain DNS access (if applicable)

## Migration Methods

### Method 1: Automated Script (Recommended)

Use the provided migration script for a streamlined process:

```bash
# Make the script executable
chmod +x migrate-to-new-server.sh

# Run the migration script
./migrate-to-new-server.sh
```

The script will:
1. Test SSH connection
2. Install system dependencies (Node.js, Nginx, PostgreSQL, Redis)
3. Clone the repository
4. Transfer environment configuration
5. Build the application
6. Configure reverse proxy (optional)
7. Restore database backup (optional)
8. Start the application with PM2
9. Verify deployment

### Method 2: Manual Migration

If you prefer manual control or the script fails, follow these steps:

#### Step 1: Prepare New Server

```bash
# SSH into the new server
ssh root@31.220.50.80

# Update system
apt-get update && apt-get upgrade -y

# Install dependencies
apt-get install -y curl git build-essential nginx postgresql postgresql-contrib redis-server

# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Install Node.js
nvm install 20.19.4
nvm use 20.19.4
nvm alias default 20.19.4

# Install PM2
npm install -g pm2

# Create directories
mkdir -p /opt/usa_notray/logs
mkdir -p /opt/usa_notray/uploads
mkdir -p /opt/usa_notray/certificates
```

#### Step 2: Clone Repository

```bash
cd /opt
git clone https://github.com/hydershah/usa_notray.git
cd usa_notray
git checkout v10.7
```

#### Step 3: Configure Environment

```bash
# Create .env file
nano .env
```

Add all required environment variables (see Environment Variables section below).

#### Step 4: Install and Build

```bash
# Install dependencies
npm ci --include=dev

# Build application
npm run build:production

# Prune dev dependencies
npm prune --omit=dev
```

#### Step 5: Setup Database

```bash
# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE usa_notray;
CREATE USER notary_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE usa_notray TO notary_user;
\q
EOF

# If restoring from backup (on your local machine):
scp backups/your_backup.sql root@31.220.50.80:/tmp/

# Then on the server:
sudo -u postgres psql usa_notray < /tmp/your_backup.sql
```

#### Step 6: Configure Nginx (Optional)

```bash
# Create Nginx configuration
cat > /etc/nginx/sites-available/usa-notary << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Static files
    location /uploads/ {
        alias /opt/usa_notray/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable the site
ln -s /etc/nginx/sites-available/usa-notary /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

#### Step 7: Start Application

```bash
cd /opt/usa_notray

# Start with PM2
pm2 start ecosystem.config.cjs --env production

# Save PM2 configuration
pm2 save

# Enable PM2 startup
pm2 startup systemd -u root --hp /root
```

#### Step 8: Verify Deployment

```bash
# Check PM2 status
pm2 list

# View logs
pm2 logs usa-notray --lines 50

# Test health endpoint
curl http://localhost:3000/health

# Test from outside
curl http://31.220.50.80:3000/health
```

## Environment Variables

Ensure these environment variables are set in `/opt/usa_notray/.env`:

```bash
# Application
NODE_ENV=production
PORT=3000
SERVE_STATIC_FILES=true

# Database
DATABASE_URL=postgresql://notary_user:password@localhost:5432/usa_notray

# Session
SESSION_SECRET=your_session_secret_here

# Redis (if using)
REDIS_URL=redis://localhost:6379

# Email (SendGrid/Postmark)
SENDGRID_API_KEY=your_sendgrid_key
# OR
POSTMARK_API_KEY=your_postmark_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_PUBLISHABLE_KEY=your_stripe_public_key

# AWS S3 / Vultr Object Storage
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=your_region
S3_BUCKET_NAME=your_bucket

# Daily.co (Video)
DAILY_API_KEY=your_daily_api_key

# Other services
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_encryption_key
```

## SSL Certificate Setup

After your domain DNS points to the new server:

```bash
# Install Certbot
apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal is configured automatically
```

## Firewall Configuration

```bash
# Install UFW
apt-get install -y ufw

# Configure firewall
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable

# Check status
ufw status
```

## Post-Migration Checklist

- [ ] Application is running (`pm2 list` shows status: online)
- [ ] Health endpoint responds: `curl http://localhost:3000/health`
- [ ] Database connection works
- [ ] User authentication works
- [ ] File uploads work
- [ ] Email notifications work
- [ ] Stripe payments work
- [ ] WebSocket connections work
- [ ] SSL certificate installed (if using domain)
- [ ] Firewall configured
- [ ] DNS updated to point to new server
- [ ] Old server redirects to new server (if applicable)
- [ ] Monitoring/alerts configured

## PM2 Management Commands

```bash
# View all processes
pm2 list

# View detailed process info
pm2 show usa-notray

# Monitor in real-time
pm2 monit

# View logs
pm2 logs usa-notray
pm2 logs usa-notray --lines 100
pm2 logs usa-notray --follow

# Restart application
pm2 restart usa-notray

# Reload without downtime
pm2 reload usa-notray

# Stop application
pm2 stop usa-notray

# Delete from PM2
pm2 delete usa-notray

# Save current PM2 state
pm2 save

# Restore saved PM2 state
pm2 resurrect
```

## Database Management

```bash
# Create backup
sudo -u postgres pg_dump usa_notray > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
sudo -u postgres psql usa_notray < backup_file.sql

# Connect to database
sudo -u postgres psql usa_notray

# View connections
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
```

## Troubleshooting

### Application Won't Start

```bash
# Check logs
pm2 logs usa-notray --lines 100

# Check if port is in use
lsof -i :3000

# Check environment variables
pm2 env 0  # Replace 0 with your app ID
```

### Database Connection Issues

```bash
# Test database connection
sudo -u postgres psql -c "SELECT version();"

# Check PostgreSQL status
systemctl status postgresql

# Restart PostgreSQL
systemctl restart postgresql

# Check database logs
tail -f /var/log/postgresql/postgresql-*.log
```

### Nginx Issues

```bash
# Test configuration
nginx -t

# Check Nginx logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log

# Restart Nginx
systemctl restart nginx
```

### Port Not Accessible Externally

```bash
# Check if application is listening
netstat -tulpn | grep :3000

# Check firewall
ufw status

# Open port if needed
ufw allow 3000/tcp
```

## Rollback Plan

If migration fails:

1. Keep old server running
2. Document the issue
3. Fix configuration on new server
4. Re-run deployment
5. Only decommission old server after 48 hours of stable operation

## Monitoring Setup

Consider setting up monitoring:

```bash
# Install PM2 Plus for monitoring
pm2 plus

# Or use PM2 keymetrics
pm2 link <secret> <public>
```

## Backup Strategy

```bash
# Create automated backup script
cat > /opt/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups"
mkdir -p $BACKUP_DIR
FILENAME="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
sudo -u postgres pg_dump usa_notray > $FILENAME
gzip $FILENAME
# Keep only last 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
EOF

chmod +x /opt/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /opt/backup-db.sh
```

## Security Hardening

```bash
# Disable root SSH login (after creating sudo user)
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd

# Install fail2ban
apt-get install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# Regular updates
apt-get update && apt-get upgrade -y
apt-get install -y unattended-upgrades
```

## Support

For issues during migration:
- Check logs: `pm2 logs usa-notray`
- Review this guide
- Check GitHub issues
- Contact development team

## Success Criteria

Migration is successful when:
- ✅ Application loads in browser
- ✅ Users can login
- ✅ All features work as expected
- ✅ No errors in logs
- ✅ Performance is acceptable
- ✅ SSL certificate is valid
- ✅ Monitoring is in place
- ✅ Backups are configured

---

**Last Updated:** October 15, 2025  
**Version:** 1.0

