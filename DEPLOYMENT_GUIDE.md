# 🚀 USA Notary Platform - Deployment Guide

## Quick Start (Fastest Method)

### Option 1: Railway (Recommended - Fastest & Easiest)

Railway is the fastest way to deploy your notary application with automatic database provisioning and zero-config deployments.

#### Step 1: Prerequisites
```bash
# Install Railway CLI
npm install -g @railway/cli

# Make deployment script executable
chmod +x deploy.sh

# Run deployment preparation
./deploy.sh
```

#### Step 2: Deploy to Railway
```bash
# 1. Login to Railway
railway login

# 2. Initialize project
railway init

# 3. Add PostgreSQL database
railway add postgresql

# 4. Add Redis cache (optional but recommended)
railway add redis

# 5. Deploy your application
railway up
```

#### Step 3: Configure Environment Variables
Go to your Railway dashboard and set these environment variables:

**Required Variables:**
- `NODE_ENV=production`
- `SESSION_SECRET=your-super-secure-secret-min-32-chars`
- `KBA_API_KEY=your-evs-api-key`
- `KBA_PASSWORD=your-evs-password`
- `VULTR_ACCESS_KEY=your-vultr-access-key`
- `VULTR_SECRET_KEY=your-vultr-secret-key`
- `VULTR_BUCKET_NAME=your-bucket-name`

**Auto-Generated (Railway provides these):**
- `DATABASE_URL` (automatically set)
- `REDIS_URL` (automatically set if you added Redis)

#### Step 4: Run Database Migrations
```bash
# Connect to your Railway environment
railway shell

# Run migrations
npm run db:migrate
```

#### Step 5: Configure Domain (Optional)
- Go to Railway dashboard → Settings → Domains
- Add your custom domain or use the provided railway.app subdomain

### Option 2: Docker + DigitalOcean/AWS/Google Cloud

If you prefer traditional cloud deployment:

#### Step 1: Build and Test Locally
```bash
# Build Docker image
docker build -t usa-notary-app .

# Test locally
docker run -p 3000:3000 --env-file .env.production usa-notary-app
```

#### Step 2: Deploy to Cloud Provider
```bash
# Tag for registry
docker tag usa-notary-app your-registry/usa-notary-app:latest

# Push to registry
docker push your-registry/usa-notary-app:latest

# Deploy using your cloud provider's container service
```

### Option 3: Traditional VPS (Ubuntu/CentOS)

#### Server Setup
```bash
# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Clone your repository
git clone your-repo-url
cd usa-notary-app

# Install dependencies
npm ci --only=production

# Build application
npm run build

# Start with PM2
pm2 start dist/index.js --name "usa-notary"
pm2 save
pm2 startup
```

## Environment Variables Reference

### Essential Variables
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/db
SESSION_SECRET=your-32-char-secret
```

### KBA Service
```env
KBA_PROVIDER=evs
KBA_API_KEY=your-evs-api-key
KBA_PASSWORD=your-evs-password
KBA_ENVIRONMENT=production
```

### File Storage (Vultr)
```env
VULTR_ACCESS_KEY=your-access-key
VULTR_SECRET_KEY=your-secret-key
VULTR_REGION=ewr1
VULTR_BUCKET_NAME=your-bucket
VULTR_ENDPOINT=https://ewr1.vultrobjects.com
```

### Optional Services
```env
REDIS_URL=redis://localhost:6379
SENDGRID_API_KEY=your-sendgrid-key
STRIPE_SECRET_KEY=your-stripe-key
```

## Post-Deployment Tasks

### 1. Database Setup
```bash
# Run all migrations
npm run db:migrate

# Verify database structure
npm run db:test
```

### 2. Test Critical Features
```bash
# Test EVS integration
npm run evs:test

# Test email system
npm run email:validate

# Test job integrity
npm run job:validate
```

### 3. Security Configuration
- Enable HTTPS (Railway does this automatically)
- Set up proper CORS origins
- Configure rate limiting
- Set up monitoring and logging

### 4. Performance Optimization
- Enable Redis caching
- Configure CDN for static assets
- Set up database connection pooling
- Monitor performance metrics

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clear cache and rebuild
rm -rf node_modules dist client/dist
npm ci
npm run build
```

#### Database Connection Issues
```bash
# Test database connection
npm run db:test

# Check environment variables
echo $DATABASE_URL
```

#### File Upload Issues
```bash
# Test Vultr storage
npm run vultr:test

# Check storage credentials
echo $VULTR_ACCESS_KEY
```

### Health Checks
Your app includes a health check endpoint at `/health` that monitors:
- Database connectivity
- Redis connectivity
- External service status

## Monitoring and Maintenance

### Performance Monitoring
The app includes built-in performance monitoring:
- Request/response times
- Database query performance
- Error rates and logging
- Resource usage metrics

### Backup Strategy
- Database: Use your cloud provider's automated backups
- Files: Vultr Object Storage has built-in redundancy
- Configuration: Keep environment variables backed up

### Updates and Maintenance
```bash
# Update dependencies
npm update

# Rebuild and redeploy
npm run build
railway up  # or your deployment method
```

## Cost Estimates

### Railway (Recommended)
- **Hobby Plan**: $5/month per service
- **Pro Plan**: $20/month per service
- **Typical setup**: ~$15-25/month (app + database + redis)

### Alternative Cloud Providers
- **DigitalOcean**: $10-20/month (droplet + managed database)
- **AWS**: $15-30/month (EC2 + RDS + ElastiCache)
- **Google Cloud**: $10-25/month (Cloud Run + Cloud SQL + Memorystore)

## Support

If you encounter issues during deployment:
1. Check the application logs
2. Verify all environment variables are set
3. Test database and external service connectivity
4. Review the troubleshooting section above

The application includes comprehensive error handling and logging to help identify issues quickly. 