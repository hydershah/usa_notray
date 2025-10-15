# Remote Database Access Configuration

**Date**: October 15, 2025  
**Server**: 31.220.50.80  
**Database**: usa_notray_production

---

## ✅ Configuration Complete

Your PostgreSQL database is now publicly accessible and your local development environment is configured to use it.

---

## 🗄️ Database Connection Details

### **Connection String:**
```
postgresql://usa_notray_user:SecurePassword2024!ChangeThis@31.220.50.80:5432/usa_notray_production
```

### **Individual Parameters:**
- **Host**: `31.220.50.80`
- **Port**: `5432`
- **Database**: `usa_notray_production`
- **Username**: `usa_notray_user`
- **Password**: `SecurePassword2024!ChangeThis`

---

## 📊 Database Statistics

- **PostgreSQL Version**: 16.10
- **Tables**: 54 tables
- **Data**: Restored from `server_backup_2025-10-04.sql` (51MB)
- **Schema**: public

---

## 🔐 Security Configuration

### **Firewall Rules:**
- ✅ Port 22 (SSH)
- ✅ Port 80 (HTTP)
- ✅ Port 443 (HTTPS)
- ✅ Port 5432 (PostgreSQL)

### **Authentication:**
- Method: `scram-sha-256` (secure password authentication)
- Access: Configured for remote connections from any IP
- SSL: Not enforced (can be configured if needed)

### **PostgreSQL Configuration:**
- `listen_addresses = '*'` (listening on all interfaces)
- Remote connections enabled in `pg_hba.conf`

---

## 💻 Local Development Setup

Your local `.env` file has been updated to use the remote database:

```bash
DATABASE_URL="postgresql://usa_notray_user:SecurePassword2024!ChangeThis@31.220.50.80:5432/usa_notray_production"
```

### **Backup Created:**
- Location: `.env.backup.YYYYMMDD_HHMMSS`
- Your old .env is safely backed up

---

## 🧪 Testing Connection

### **From Command Line:**
```bash
# Using psql
PGPASSWORD='SecurePassword2024!ChangeThis' psql -h 31.220.50.80 -U usa_notray_user -d usa_notray_production

# Test query
PGPASSWORD='SecurePassword2024!ChangeThis' psql -h 31.220.50.80 -U usa_notray_user -d usa_notray_production -c "SELECT version();"
```

### **From Your Application:**
Your app will automatically use the updated DATABASE_URL from .env file.

### **Using Database Client:**
Use any PostgreSQL client (DBeaver, pgAdmin, TablePlus, etc.) with these credentials:
- Host: `31.220.50.80`
- Port: `5432`
- Database: `usa_notray_production`
- Username: `usa_notray_user`
- Password: `SecurePassword2024!ChangeThis`

---

## 🔧 Common Operations

### **Connect to Database:**
```bash
ssh root@31.220.50.80
sudo -u postgres psql usa_notray_production
```

### **Create Backup:**
```bash
ssh root@31.220.50.80
sudo -u postgres pg_dump usa_notray_production > backup_$(date +%Y%m%d_%H%M%S).sql
```

### **Restore Backup:**
```bash
scp backup_file.sql root@31.220.50.80:/tmp/
ssh root@31.220.50.80
sudo -u postgres psql usa_notray_production < /tmp/backup_file.sql
```

### **View Active Connections:**
```bash
ssh root@31.220.50.80
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity WHERE datname = 'usa_notray_production';"
```

### **View Database Size:**
```bash
ssh root@31.220.50.80
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('usa_notray_production'));"
```

---

## 🔒 Security Best Practices

### **Recommended Improvements:**

1. **Change Default Password:**
   ```sql
   ALTER USER usa_notray_user WITH PASSWORD 'your_new_secure_password';
   ```
   Then update .env files and restart applications.

2. **Restrict IP Access (Optional):**
   Edit `/etc/postgresql/16/main/pg_hba.conf`:
   ```
   # Instead of 0.0.0.0/0, specify your IP
   host    usa_notray_production    usa_notray_user    YOUR_IP/32    scram-sha-256
   ```

3. **Enable SSL Connections (Recommended):**
   ```bash
   # Generate SSL certificates
   ssh root@31.220.50.80
   cd /var/lib/postgresql/16/main
   # Follow PostgreSQL SSL setup guide
   ```

4. **Regular Backups:**
   Set up automated daily backups (already documented in deployment guides).

5. **Monitor Connections:**
   Regularly check `pg_stat_activity` for suspicious connections.

---

## 🚨 Troubleshooting

### **Cannot Connect Remotely:**

1. **Check Firewall:**
   ```bash
   ssh root@31.220.50.80
   ufw status
   # Should show 5432/tcp ALLOW
   ```

2. **Check PostgreSQL is Listening:**
   ```bash
   ssh root@31.220.50.80
   netstat -tlnp | grep 5432
   # Should show 0.0.0.0:5432
   ```

3. **Check pg_hba.conf:**
   ```bash
   ssh root@31.220.50.80
   cat /etc/postgresql/16/main/pg_hba.conf | grep usa_notray
   ```

4. **Check PostgreSQL Logs:**
   ```bash
   ssh root@31.220.50.80
   tail -f /var/log/postgresql/postgresql-16-main.log
   ```

### **Connection Timeout:**
- Verify firewall allows port 5432
- Check if VPS provider has additional firewall rules
- Verify PostgreSQL is running: `systemctl status postgresql`

### **Authentication Failed:**
- Verify password is correct (no typos)
- Check username: `usa_notray_user`
- Verify database name: `usa_notray_production`

---

## 📋 Configuration Files

### **PostgreSQL Config:**
- Main config: `/etc/postgresql/16/main/postgresql.conf`
- Authentication: `/etc/postgresql/16/main/pg_hba.conf`
- Backups created: `*.backup` files in same directory

### **Firewall:**
- Rules: `ufw status`
- Config: `/etc/ufw/`

---

## 🎯 Quick Reference

### **Connection URLs:**

**Local Development (.env):**
```
DATABASE_URL="postgresql://usa_notray_user:SecurePassword2024!ChangeThis@31.220.50.80:5432/usa_notray_production"
```

**Server Production (.env on server):**
```
DATABASE_URL="postgresql://usa_notray_user:SecurePassword2024!ChangeThis@localhost:5432/usa_notray_production"
```

### **Test Commands:**

```bash
# Test connection
PGPASSWORD='SecurePassword2024!ChangeThis' psql -h 31.220.50.80 -U usa_notray_user -d usa_notray_production -c "SELECT 1;"

# Count tables
PGPASSWORD='SecurePassword2024!ChangeThis' psql -h 31.220.50.80 -U usa_notray_user -d usa_notray_production -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Check users
PGPASSWORD='SecurePassword2024!ChangeThis' psql -h 31.220.50.80 -U usa_notray_user -d usa_notray_production -c "SELECT COUNT(*) FROM users;"
```

---

## ✅ What Was Configured:

1. ✅ PostgreSQL listening on all interfaces (`0.0.0.0`)
2. ✅ Remote authentication configured in `pg_hba.conf`
3. ✅ Firewall port 5432 opened
4. ✅ Local .env updated with remote database URL
5. ✅ Connection tested and verified (54 tables)
6. ✅ Backups of configuration files created

---

## 🔗 Related Documentation:

- `GITHUB_ACTIONS_DEPLOYMENT.md` - Automated deployment guide
- `NEW_SERVER_MIGRATION_GUIDE.md` - Complete migration reference
- `migrate-to-new-server.sh` - Migration script

---

**Last Updated**: October 15, 2025  
**Status**: ✅ Active and Working

