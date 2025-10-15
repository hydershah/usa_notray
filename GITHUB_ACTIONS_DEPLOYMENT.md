# GitHub Actions Deployment - Complete Setup Guide

## ✅ Setup Status

### Completed Steps:
- ✅ SSH key generated for GitHub Actions
- ✅ Public key added to new server (31.220.50.80)
- ✅ SSH connection tested and working
- ✅ Server directory structure created
- ✅ PostgreSQL database created
- ✅ Environment file configured

---

## 🔑 Step 1: Add GitHub Secrets

**You need to add these 3 secrets to your GitHub repository:**

### Where to Add:
1. Go to: `https://github.com/hydershah/usa_notray/settings/secrets/actions`
2. Click **"New repository secret"** for each one below

### Secrets to Add:

#### Secret 1: VPS_SSH_KEY
- **Name**: `VPS_SSH_KEY`
- **Value**: (Copy the private key below - including BEGIN and END lines)

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACC1jaPiKOts+s3BzcawDzocYGMd/dQSnqK+djMoMTsgfgAAAKiFdm6VhXZu
lQAAAAtzc2gtZWQyNTUxOQAAACC1jaPiKOts+s3BzcawDzocYGMd/dQSnqK+djMoMTsgfg
AAAEC5fcFwGGv5LVN68MsNiMTklVzVXSgTorvix5O7VoFGPrWNo+Io62z6zcHNxrAPOhxg
Yx391BKeor52MygxOyB+AAAAIGdpdGh1Yi1hY3Rpb25zLWRlcGxveS11c2Etbm90cmF5AQ
IDBAU=
-----END OPENSSH PRIVATE KEY-----
```

#### Secret 2: VPS_HOST
- **Name**: `VPS_HOST`
- **Value**: `31.220.50.80`

#### Secret 3: VPS_USER
- **Name**: `VPS_USER`
- **Value**: `root`

---

## 🚀 Step 2: Trigger Deployment

Your GitHub Actions workflow is already configured and ready to go! The workflow will automatically trigger when you push code to these branches:
- `main`, `master`
- `staging-9.2`, `staging-v9.3`, `staging-v9.4`, `staging-v9.5`
- `staging-v10.5`, `v10.6`, `v10.7`

### Option A: Push Code (Automatic Deployment)

```bash
cd /home/hyder/usa_notray

# Make sure you're on v10.7 branch
git checkout v10.7

# Add any pending changes (if needed)
git add .
git commit -m "Configure for new server deployment"

# Push to trigger deployment
git push origin v10.7
```

### Option B: Manual Trigger (Without Pushing Code)

1. Go to: `https://github.com/hydershah/usa_notray/actions/workflows/deploy.yml`
2. Click **"Run workflow"** button
3. Select branch: **v10.7**
4. Click **"Run workflow"**

---

## 📊 Step 3: Monitor Deployment

### Watch GitHub Actions:
1. Go to: `https://github.com/hydershah/usa_notray/actions`
2. Click on the latest workflow run
3. Watch the deployment progress in real-time

### Watch Server Logs:
Open a new terminal and run:
```bash
ssh root@31.220.50.80
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
pm2 logs usa-notray --lines 50 --follow
```

---

## ✅ Step 4: Verify Deployment

After the GitHub Action completes successfully:

### Test Health Endpoint:
```bash
curl http://31.220.50.80:3000/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Check PM2 Status:
```bash
ssh root@31.220.50.80
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
pm2 status
```

### Check Application:
```bash
# Check if app is listening on port 3000
ssh root@31.220.50.80 "netstat -tlnp | grep :3000"
```

### Test in Browser:
Open: `http://31.220.50.80:3000`

---

## 📦 What the GitHub Action Does

The workflow (`.github/workflows/deploy.yml`) automatically:

1. ✅ Checks out your code
2. ✅ Builds the application (client + server)
3. ✅ Connects to your VPS via SSH
4. ✅ Creates a timestamped release directory
5. ✅ Uploads the built files
6. ✅ Installs Node.js and dependencies
7. ✅ Copies environment variables
8. ✅ Starts/restarts the app with PM2
9. ✅ Runs health checks
10. ✅ Cleans up old releases (keeps 5 most recent)

---

## 🔧 Server Configuration

### Database:
- **Host**: localhost
- **Port**: 5432
- **Database**: usa_notray_production
- **User**: usa_notray_user
- **Password**: SecurePassword2024!ChangeThis

### Application:
- **Deploy Path**: `/opt/usa_notray/`
- **Current Release**: `/opt/usa_notray/current` (symlink)
- **Releases**: `/opt/usa_notray/releases/TIMESTAMP/`
- **Logs**: `/opt/usa_notray/logs/`
- **Uploads**: `/opt/usa_notray/uploads/`
- **Port**: 3000
- **PM2 App Name**: usa-notray

---

## 🎯 Quick Commands Reference

### Deployment:
```bash
# Trigger deployment
git push origin v10.7

# Or manually from GitHub:
# https://github.com/hydershah/usa_notray/actions/workflows/deploy.yml
```

### Check Status:
```bash
ssh root@31.220.50.80
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# PM2 status
pm2 status

# View logs
pm2 logs usa-notray

# Monitor in real-time
pm2 monit
```

### Restart Application:
```bash
ssh root@31.220.50.80
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
pm2 restart usa-notray
```

### View Recent Logs:
```bash
ssh root@31.220.50.80
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
pm2 logs usa-notray --lines 100
```

---

## 🐛 Troubleshooting

### If Deployment Fails:

1. **Check GitHub Actions logs**: Look for error messages in the workflow run
2. **Verify secrets are correct**: Settings → Secrets → Actions
3. **Check server logs**: 
   ```bash
   ssh root@31.220.50.80
   export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
   pm2 logs usa-notray --err --lines 50
   ```

### If App Won't Start:

```bash
ssh root@31.220.50.80
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Check logs
pm2 logs usa-notray --lines 100

# Check environment
cd /opt/usa_notray/current
cat .env | grep -E "DATABASE_URL|NODE_ENV|PORT"

# Test database connection
psql -U usa_notray_user -d usa_notray_production -h localhost
```

### Common Issues:

**Issue**: SSH connection fails
- **Solution**: Verify VPS_SSH_KEY secret is correct (including BEGIN/END lines)

**Issue**: Database connection error
- **Solution**: Check DATABASE_URL in `/opt/usa_notray/.env` matches database credentials

**Issue**: Port 3000 already in use
- **Solution**: Kill existing process or restart server

**Issue**: PM2 not found
- **Solution**: Ensure Node.js is installed via NVM and PM2 is installed globally

---

## 📈 Next Steps (Optional)

### 1. Setup Nginx Reverse Proxy

```bash
ssh root@31.220.50.80

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

    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

ln -s /etc/nginx/sites-available/usa-notary /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 2. Setup SSL Certificate

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com -d www.your-domain.com
```

### 3. Setup Firewall

```bash
apt-get install -y ufw
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw enable
```

### 4. Setup Automated Backups

```bash
ssh root@31.220.50.80

# Create backup script
cat > /opt/backup-database.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups"
mkdir -p $BACKUP_DIR
FILENAME="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
sudo -u postgres pg_dump usa_notray_production > $FILENAME
gzip $FILENAME
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
EOF

chmod +x /opt/backup-database.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/backup-database.sh") | crontab -
```

---

## 🎉 Summary

**You're almost done! Just need to:**

1. **Add the 3 secrets to GitHub** (VPS_SSH_KEY, VPS_HOST, VPS_USER)
2. **Push code to v10.7 branch** or manually trigger the workflow
3. **Watch it deploy automatically!**

The server is ready and waiting for your deployment! 🚀

---

**Generated**: October 15, 2025  
**Server**: 31.220.50.80  
**Branch**: v10.7

