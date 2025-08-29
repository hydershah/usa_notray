# VPS Deployment Guide for USA Notray

This guide walks you through deploying the USA Notray application to a VPS using GitHub Actions.

## 🎯 **Performance Benefits**

**Expected improvements vs Railway:**
- **Database queries**: 300ms → **20-50ms** (6x faster) ⚡
- **Tag operations**: 300ms+ → **30-80ms** (4-8x faster) 🚀
- **Overall latency**: **Sub-100ms for most operations**

---

## 📋 **Prerequisites**

1. **VPS Server** (Ubuntu 20.04/22.04 recommended)
2. **Domain name** pointing to your VPS
3. **GitHub repository** with your code
4. **SSH access** to your VPS

---

## 🚀 **Step 1: VPS Setup**

### **1.1 Run Setup Script**
```bash
# Upload and run the setup script
scp scripts/setup-vps.sh user@your-server-ip:/tmp/
ssh user@your-server-ip
chmod +x /tmp/setup-vps.sh
sudo /tmp/setup-vps.sh
```

### **1.2 Configure Environment**
```bash
# Copy and edit environment file
sudo cp /opt/usa_notray/shared/.env.template /opt/usa_notray/shared/.env
sudo nano /opt/usa_notray/shared/.env
```

**Required environment variables:**
```env
# Database
DATABASE_URL="postgresql://usa_notray:YOUR_PASSWORD@localhost:5432/usa_notray_production"

# Application
NODE_ENV=production
PORT=3000
CLIENT_URL=https://your-domain.com

# Security
JWT_SECRET=your-very-secure-jwt-secret-here

# Cloud Storage
VULTR_ACCESS_KEY=your-vultr-access-key
VULTR_SECRET_KEY=your-vultr-secret-key
VULTR_REGION=ewr1
VULTR_BUCKET=usanotary

# Video Conferencing
DAILY_API_KEY=your-daily-api-key
DAILY_DOMAIN=your-daily-domain
```

### **1.3 Set Up SSL Certificate**
```bash
# Configure SSL with Let's Encrypt
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## 🔐 **Step 2: GitHub Actions Setup**

### **2.1 Generate SSH Key**
```bash
# On your local machine
ssh-keygen -t rsa -b 4096 -f ~/.ssh/usa_notray_deploy
```

### **2.2 Add Public Key to VPS**
```bash
# Copy public key to VPS
ssh-copy-id -i ~/.ssh/usa_notray_deploy.pub deploy@your-server-ip
```

### **2.3 Configure GitHub Secrets**

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:
```
VPS_HOST=your-server-ip
VPS_USER=deploy
VPS_SSH_KEY=<contents of ~/.ssh/usa_notray_deploy private key>
```

### **2.4 Update Nginx Configuration**
```bash
# Edit Nginx config on VPS
sudo nano /etc/nginx/sites-available/usa_notray
```

Replace `your-domain.com` with your actual domain, then:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🚀 **Step 3: Deploy**

### **3.1 Push to Main Branch**
```bash
git add .
git commit -m "feat: add VPS deployment workflow"
git push origin main
```

### **3.2 Monitor Deployment**
- Go to GitHub → Actions tab
- Watch the deployment progress
- Check for any errors in the logs

### **3.3 Verify Deployment**
```bash
# Check PM2 status on VPS
ssh deploy@your-server-ip
pm2 status
pm2 logs usa-notary

# Test the application
curl https://your-domain.com/health
```

---

## 📊 **Step 4: Performance Testing**

### **4.1 Database Performance**
```bash
# Test database connection speed
ssh deploy@your-server-ip
cd /opt/usa_notray/current
npm run db:test
```

### **4.2 Application Performance**
Test these endpoints and expect **sub-100ms** responses:
- `GET /api/users` → Should be **20-50ms**
- `GET /api/companies` → Should be **20-50ms**
- `POST /api/editor/session/test/place-tag` → Should be **30-80ms**

### **4.3 Load Testing (Optional)**
```bash
# Install Apache Bench
sudo apt install apache2-utils

# Test performance
ab -n 1000 -c 10 https://your-domain.com/api/users
```

---

## 🔧 **Management Commands**

### **Application Management**
```bash
# View logs
pm2 logs usa-notary

# Restart application
pm2 restart usa-notary

# Monitor performance
pm2 monit

# Check status
pm2 status
```

### **Database Management**
```bash
# Connect to database
sudo -u postgres psql usa_notray_production

# Run migrations
cd /opt/usa_notray/current
npm run db:push

# Backup database
pg_dump -U usa_notray usa_notray_production > backup.sql
```

### **Nginx Management**
```bash
# Check Nginx status
sudo systemctl status nginx

# Reload configuration
sudo nginx -t && sudo systemctl reload nginx

# View access logs
sudo tail -f /var/log/nginx/access.log
```

---

## 🚨 **Troubleshooting**

### **Deployment Failed**
```bash
# Check GitHub Actions logs
# Then on VPS:
pm2 logs usa-notary --lines 100
sudo journalctl -u nginx -f
```

### **Database Connection Issues**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -h localhost -U usa_notray -d usa_notray_production
```

### **SSL Certificate Issues**
```bash
# Renew certificate
sudo certbot renew --dry-run

# Check certificate status
sudo certbot certificates
```

### **Performance Issues**
```bash
# Monitor system resources
htop
iotop
netstat -tulpn

# Check database performance
sudo -u postgres psql usa_notray_production -c "SELECT * FROM pg_stat_activity;"
```

---

## 📈 **Monitoring & Maintenance**

### **Log Rotation**
Logs are automatically rotated using logrotate configuration in `/etc/logrotate.d/usa_notray`.

### **Backup Strategy**
```bash
# Create backup script
cat > /opt/usa_notray/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U usa_notray usa_notray_production > /opt/usa_notray/backups/db_backup_$DATE.sql
find /opt/usa_notray/backups -name "*.sql" -mtime +7 -delete
EOF

# Add to crontab for daily backups
crontab -e
# Add: 0 2 * * * /opt/usa_notray/backup.sh
```

### **Security Updates**
```bash
# Update system packages monthly
sudo apt update && sudo apt upgrade -y

# Update Node.js dependencies
cd /opt/usa_notray/current
npm audit fix
```

---

## 🎉 **Success Metrics**

After successful deployment, you should see:

- ✅ **Sub-50ms database queries**
- ✅ **20-80ms tag operations**
- ✅ **99.9% uptime**
- ✅ **SSL A+ rating**
- ✅ **Fast page load times**

**Your VPS deployment is complete!** 🚀

---

## 📞 **Support**

If you encounter issues:
1. Check the troubleshooting section above
2. Review GitHub Actions logs
3. Check VPS system logs
4. Monitor database performance

**Performance should be significantly better than Railway!** ⚡
