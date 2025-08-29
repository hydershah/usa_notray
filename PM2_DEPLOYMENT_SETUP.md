# PM2 Deployment Pipeline Setup Guide

This guide will help you set up the PM2 deployment pipeline for your USA Notary application.

## Prerequisites

1. **VPS/Server with Ubuntu/Debian**
2. **Node.js 18+ installed**
3. **PM2 installed globally**
4. **GitHub repository with your code**
5. **SSH access to your VPS**

## Step 1: Server Setup

### Install Node.js and PM2

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Verify installations
node --version
npm --version
pm2 --version
```

### Create Application Directory Structure

```bash
# Create application directory
sudo mkdir -p /opt/usa_notray
sudo mkdir -p /opt/usa_notray/releases
sudo mkdir -p /opt/usa_notray/shared
sudo mkdir -p /opt/usa_notray/logs
sudo mkdir -p /opt/usa_notray/uploads
sudo mkdir -p /opt/usa_notray/certificates

# Set proper permissions
sudo chown -R $USER:$USER /opt/usa_notray
sudo chmod -R 755 /opt/usa_notray

# Create symlink for current version
ln -s /opt/usa_notray/releases/$(date +%Y%m%d_%H%M%S) /opt/usa_notray/current
```

### Setup PM2 Startup Script

```bash
# Generate PM2 startup script
pm2 startup

# Follow the instructions provided by the command above
# Usually involves running a sudo command like:
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME

# Save current PM2 configuration
pm2 save
```

## Step 2: Environment Configuration

### Create Environment File

```bash
# Navigate to shared directory
cd /opt/usa_notray/shared

# Create .env file with your production environment variables
nano .env
```

**Example .env content:**
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=your_database_connection_string
JWT_SECRET=your_jwt_secret
# Add other environment variables as needed
```

### Setup Database

```bash
# Install PostgreSQL (if using PostgreSQL)
sudo apt install postgresql postgresql-contrib

# Or install MySQL (if using MySQL)
sudo apt install mysql-server

# Create database and user
# PostgreSQL example:
sudo -u postgres psql
CREATE DATABASE usa_notary;
CREATE USER notary_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE usa_notary TO notary_user;
\q
```

## Step 3: GitHub Secrets Configuration

### Add Repository Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions, and add:

1. **VPS_SSH_KEY**: Your private SSH key for VPS access
2. **VPS_HOST**: Your VPS IP address or domain
3. **VPS_USER**: Your VPS username

### Generate SSH Key Pair

```bash
# On your local machine
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# Copy public key to VPS
ssh-copy-id username@your_vps_ip

# Or manually add to VPS
cat ~/.ssh/id_rsa.pub | ssh username@your_vps_ip "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

## Step 4: First Deployment

### Manual First Deployment

```bash
# SSH to your VPS
ssh username@your_vps_ip

# Navigate to application directory
cd /opt/usa_notray/current

# Clone your repository
git clone https://github.com/yourusername/your-repo.git .

# Install dependencies
npm ci --production

# Copy environment file
cp /opt/usa_notray/shared/.env .env

# Build application
npm run build:client
npm run build:server

# Run database migrations
npm run db:push

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Check status
pm2 status
pm2 logs usa-notary
```

## Step 5: Test the Pipeline

### Trigger Deployment

1. **Push to main branch**: The pipeline will automatically trigger
2. **Manual trigger**: Go to Actions tab → Select workflow → Run workflow

### Monitor Deployment

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs usa-notary

# Monitor system resources
pm2 monit

# Check application health
curl http://your_vps_ip:3000/health
```

## Step 6: Post-Deployment Verification

### Verify Application

```bash
# Check if app is running
pm2 describe usa-notary

# Check logs for errors
pm2 logs usa-notary --err

# Test health endpoint
curl -f http://localhost:3000/health

# Check file permissions
ls -la /opt/usa_notray/current/
```

### Setup Nginx (Optional)

```bash
# Install Nginx
sudo apt install nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/usa-notary

# Add configuration
server {
    listen 80;
    server_name your_domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/usa-notary /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Troubleshooting

### Common Issues

1. **PM2 Process Not Starting**
   ```bash
   # Check logs
   pm2 logs usa-notary --err
   
   # Check if port is in use
   sudo netstat -tlnp | grep :3000
   
   # Restart PM2
   pm2 restart usa-notary
   ```

2. **Permission Issues**
   ```bash
   # Fix ownership
   sudo chown -R $USER:$USER /opt/usa_notray
   
   # Fix permissions
   sudo chmod -R 755 /opt/usa_notray
   ```

3. **Database Connection Issues**
   ```bash
   # Check database status
   sudo systemctl status postgresql
   
   # Test connection
   psql -h localhost -U notary_user -d usa_notary
   ```

### Useful PM2 Commands

```bash
# List all processes
pm2 list

# Restart application
pm2 restart usa-notary

# Stop application
pm2 stop usa-notary

# Delete application
pm2 delete usa-notary

# View logs
pm2 logs usa-notary

# Monitor resources
pm2 monit

# Save configuration
pm2 save

# Reload configuration
pm2 reload usa-notary
```

## Security Considerations

1. **Firewall Setup**
   ```bash
   # Allow only necessary ports
   sudo ufw allow 22    # SSH
   sudo ufw allow 80    # HTTP (if using Nginx)
   sudo ufw allow 443   # HTTPS (if using SSL)
   sudo ufw enable
   ```

2. **SSL Certificate (Optional)**
   ```bash
   # Install Certbot
   sudo apt install certbot python3-certbot-nginx
   
   # Get SSL certificate
   sudo certbot --nginx -d your_domain.com
   ```

## Monitoring and Maintenance

### Setup Log Rotation

```bash
# Create logrotate configuration
sudo nano /etc/logrotate.d/usa-notary

# Add configuration
/opt/usa_notray/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
}
```

### Regular Maintenance

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update PM2
npm update -g pm2

# Clean old releases
cd /opt/usa_notray/releases
ls -t | tail -n +6 | xargs -r rm -rf

# Check disk space
df -h
```

## Success Indicators

✅ **Pipeline runs successfully**  
✅ **Application deploys without errors**  
✅ **Health check endpoint responds**  
✅ **PM2 process shows as online**  
✅ **Application accessible via browser**  
✅ **Database migrations complete successfully**  

## Next Steps

1. **Setup monitoring** (e.g., PM2 Plus, New Relic)
2. **Configure backups** for database and files
3. **Setup staging environment** for testing
4. **Implement blue-green deployment** for zero downtime
5. **Add performance monitoring** and alerting

---

**Need Help?** Check the GitHub Actions logs for detailed error information and refer to the troubleshooting section above.
