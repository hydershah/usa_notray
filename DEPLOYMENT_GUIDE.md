# USA Notary Deployment Guide

This guide covers deploying the USA Notary application using PM2 and the provided ecosystem configuration.

## Prerequisites

- Node.js 18+ installed
- PM2 installed globally: `npm install -g pm2`
- Git repository access
- Proper environment variables configured

## Quick Start

### 1. Install PM2 (if not already installed)
```bash
npm install -g pm2
```

### 2. Build and Deploy
```bash
# For Linux/Mac
./deploy.sh

# For Windows PowerShell
.\deploy.ps1

# Or manually
npm run build:production
pm2 start ecosystem.config.js --env production
```

## Ecosystem Configuration

The `ecosystem.config.js` file is configured with:

- **Multiple environments**: development, staging, production
- **Automatic restart**: On crashes and memory limits
- **Health checks**: Built-in health monitoring
- **Logging**: Structured logging with timestamps
- **Process management**: Memory limits and restart policies

### Key Features

- **Port**: 3000 (configurable per environment)
- **Memory limit**: 2GB before restart
- **Health check**: `/health` endpoint every 30 seconds
- **Logs**: Stored in `./logs/` directory
- **Auto-restart**: Enabled with 4-second delay

## Deployment Scripts

### Linux/Mac (`deploy.sh`)
- Automatic build process
- Dependency installation
- PM2 process management
- Log directory creation
- Status monitoring

### Windows (`deploy.ps1`)
- PowerShell-compatible deployment
- Same functionality as Linux script
- Windows-specific error handling

## Manual Deployment Steps

### 1. Build the Application
```bash
npm run build:production
```

### 2. Start with PM2
```bash
# Production environment
pm2 start ecosystem.config.js --env production

# Staging environment
pm2 start ecosystem.config.js --env staging

# Development environment
pm2 start ecosystem.config.js --env development
```

### 3. Save PM2 Configuration
```bash
pm2 save
```

### 4. Setup Auto-start
```bash
pm2 startup
```

## Environment Configuration

### Production Environment
- `NODE_ENV=production`
- `PORT=3000`
- `SERVE_STATIC_FILES=true`
- Memory limit: 2GB
- Health checks enabled

### Staging Environment
- `NODE_ENV=staging`
- `PORT=3000`
- Same configuration as production

### Development Environment
- `NODE_ENV=development`
- `PORT=3000`
- Lighter memory limits

## Monitoring and Management

### View Application Status
```bash
pm2 list
pm2 monit
```

### View Logs
```bash
# All logs
pm2 logs usa-notary

# Recent logs
pm2 logs usa-notary --lines 50

# Follow logs
pm2 logs usa-notary --follow
```

### Restart Application
```bash
pm2 restart usa-notary
```

### Stop Application
```bash
pm2 stop usa-notary
pm2 delete usa-notary
```

## Troubleshooting

### Common Issues

#### 1. Build Failures
```bash
# Clean and rebuild
npm run build:clean
npm run build:production

# Check for missing dependencies
npm install
```

#### 2. Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000  # Linux/Mac
netstat -ano | findstr :3000  # Windows

# Kill process or change port in ecosystem.config.js
```

#### 3. Memory Issues
```bash
# Check memory usage
pm2 monit

# Increase memory limit in ecosystem.config.js
max_memory_restart: '4G'
```

#### 4. PM2 Process Not Starting
```bash
# Check PM2 logs
pm2 logs

# Check application logs
pm2 logs usa-notary

# Restart PM2 daemon
pm2 kill
pm2 start ecosystem.config.js --env production
```

### Health Check Endpoint

The application includes a health check endpoint at `/health` that PM2 monitors:

```bash
# Test health endpoint
curl http://localhost:3000/health

# Expected response: {"status":"ok","timestamp":"..."}
```

## Advanced Configuration

### Scaling
```bash
# Scale to multiple instances
pm2 scale usa-notary 4

# Use cluster mode
pm2 start ecosystem.config.js --env production -i max
```

### Custom Environment Variables
Add to `ecosystem.config.js`:
```javascript
env_production: {
  NODE_ENV: 'production',
  PORT: 3000,
  DATABASE_URL: 'your-db-url',
  API_KEY: 'your-api-key'
}
```

### Log Rotation
```bash
# Install PM2 log rotate
pm2 install pm2-logrotate

# Configure rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Build process successful
- [ ] PM2 installed globally
- [ ] Port 3000 available
- [ ] Log directory created
- [ ] Application starts successfully
- [ ] Health endpoint responding
- [ ] PM2 configuration saved
- [ ] Auto-start configured

## Support Commands

```bash
# Quick status check
pm2 list

# Monitor resources
pm2 monit

# View all logs
pm2 logs

# Restart everything
pm2 restart all

# Update PM2
npm update -g pm2
```

## Next Steps

After successful deployment:

1. **Monitor**: Use `pm2 monit` to watch performance
2. **Logs**: Check logs regularly for issues
3. **Updates**: Use deployment scripts for future updates
4. **Scaling**: Consider scaling for production load
5. **Backup**: Implement backup strategies for data and configuration

For additional support, check the PM2 documentation: https://pm2.keymetrics.io/docs/
