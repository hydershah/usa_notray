# VPS Setup Commands

Run these commands on your VPS (you're already connected as root@vultr):

## 1. Run the setup script
```bash
chmod +x /tmp/setup-vps.sh
/tmp/setup-vps.sh
```

## 2. After setup completes, configure environment
```bash
cp /opt/usa_notray/shared/.env.template /opt/usa_notray/shared/.env
nano /opt/usa_notray/shared/.env
```

Update these key values in the .env file:
```env
# Database (update password)
DATABASE_URL="postgresql://usa_notray:CHANGE_THIS_PASSWORD@localhost:5432/usa_notray_production"

# Application 
CLIENT_URL=https://your-domain.com

# Security (generate a random JWT secret)
JWT_SECRET=your-very-secure-jwt-secret-here

# Daily.co (your existing keys)
DAILY_API_KEY=your-daily-api-key
DAILY_DOMAIN=your-daily-domain

# Vultr (your existing keys)
VULTR_ACCESS_KEY=your-vultr-access-key
VULTR_SECRET_KEY=your-vultr-secret-key
```

## 3. Set proper ownership
```bash
chown -R deploy:www-data /opt/usa_notray
chmod -R 755 /opt/usa_notray
```

## 4. Exit and return to local machine
```bash
exit
```
