# 🚀 Production Deployment Guide - OpenVidu + Vultr Integration

**Status**: Ready for Production Deployment  
**Last Updated**: December 27, 2024  
**Completion**: Backend ✅ | Frontend ✅ | Integration ✅

---

## 📋 **Pre-Deployment Checklist**

### ✅ **Code Ready**
- [x] OpenVidu backend service implemented
- [x] Vultr Object Storage integration complete
- [x] All frontend components migrated from Whereby
- [x] Dependencies installed and build tested
- [x] Railway.co configuration updated

### 🔧 **Infrastructure Required**
- [ ] OpenVidu Server deployed
- [ ] Vultr Object Storage bucket created  
- [ ] Environment variables configured
- [ ] DNS/SSL certificates set up
- [ ] Production testing completed

---

## 🏗️ **PHASE 1: OpenVidu Server Setup**

### **Option A: Digital Ocean Droplet (Recommended)**

#### **1. Create Droplet**
```bash
# Minimum Requirements:
# - 2 CPU cores
# - 4GB RAM  
# - 20GB SSD
# - Ubuntu 22.04 LTS

# SSH into your droplet
ssh root@your-droplet-ip
```

#### **2. Install Docker**
```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Start Docker service
systemctl start docker
systemctl enable docker
```

#### **3. Deploy OpenVidu Server**
```bash
# Create OpenVidu directory
mkdir -p /opt/openvidu
cd /opt/openvidu

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  openvidu-server:
    image: openvidu/openvidu-dev:2.31.0
    restart: unless-stopped
    ports:
      - "4443:4443"
    environment:
      - OPENVIDU_SECRET=${OPENVIDU_SECRET}
      - DOMAIN_OR_PUBLIC_IP=${DOMAIN_OR_PUBLIC_IP}
      - OPENVIDU_RECORDING=true
      - OPENVIDU_RECORDING_PATH=/opt/openvidu/recordings
      - OPENVIDU_RECORDING_NOTIFICATION=${OPENVIDU_RECORDING_NOTIFICATION:-}
      - OPENVIDU_RECORDING_AUTOSTOP_TIMEOUT=120
    volumes:
      - recordings:/opt/openvidu/recordings
    networks:
      - openvidu

volumes:
  recordings:

networks:
  openvidu:
    driver: bridge
EOF

# Create environment file
cat > .env << 'EOF'
# OpenVidu Configuration
OPENVIDU_SECRET=your_secure_openvidu_secret_here
DOMAIN_OR_PUBLIC_IP=your-server-domain.com
OPENVIDU_RECORDING_NOTIFICATION=https://your-railway-app.com/api/video/webhook
EOF

# Start OpenVidu
docker-compose up -d

# Check status
docker-compose logs -f
```

#### **4. Configure Firewall**
```bash
# Allow required ports
ufw allow 22/tcp     # SSH
ufw allow 4443/tcp   # OpenVidu HTTPS
ufw allow 3478/tcp   # STUN/TURN
ufw allow 3478/udp   # STUN/TURN  
ufw allow 40000:57000/tcp  # WebRTC media
ufw allow 40000:57000/udp  # WebRTC media
ufw allow 57001:65535/tcp  # WebRTC media
ufw allow 57001:65535/udp  # WebRTC media

# Enable firewall
ufw --force enable
```

### **Option B: Railway.co OpenVidu Service**

#### **1. Create Separate Service**
```bash
# In Railway.co dashboard:
# 1. Create new service
# 2. Connect from Docker Hub
# 3. Use image: openvidu/openvidu-dev:2.31.0
```

#### **2. Environment Variables**
```bash
OPENVIDU_SECRET=your_secure_secret
DOMAIN_OR_PUBLIC_IP=openvidu-service.railway.app
OPENVIDU_RECORDING=true
PORT=4443
```

#### **3. Port Configuration**
```bash
# Railway.co will auto-assign public URL
# Internal communication: openvidu-service.railway.internal:4443
```

---

## 🪣 **PHASE 2: Vultr Object Storage Setup**

### **1. Create Vultr Account & Bucket**
```bash
# 1. Sign up at https://vultr.com
# 2. Navigate to Object Storage
# 3. Create new bucket:
#    - Name: notary-recordings-prod
#    - Region: ewr1 (New Jersey) or closest to users
#    - Access: Private
```

### **2. Generate API Keys**
```bash
# In Vultr Dashboard:
# 1. Go to Account > API
# 2. Create Object Storage Keys
# 3. Save Access Key and Secret Key
```

### **3. Configure Bucket Policy (Optional)**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::notary-recordings-prod/public/*"
    }
  ]
}
```

### **4. Set Up CDN (Optional - Recommended)**
```bash
# 1. Enable Vultr CDN for bucket
# 2. Configure custom domain if needed
# 3. Note CDN URL for environment variables
```

---

## ⚙️ **PHASE 3: Railway.co Environment Configuration**

### **Railway.co Environment Variables**

```bash
# ===== OPENVIDU CONFIGURATION =====
OPENVIDU_SERVER_URL=https://your-openvidu-server.com:4443
OPENVIDU_SECRET=your_secure_openvidu_secret
OPENVIDU_RECORDING_ENABLED=true
OPENVIDU_MAX_PARTICIPANTS=8
OPENVIDU_DEFAULT_LAYOUT=GRID
OPENVIDU_DEFAULT_RESOLUTION=1920x1080
OPENVIDU_DEFAULT_FRAMERATE=25

# ===== VULTR OBJECT STORAGE =====
VULTR_STORAGE_ENDPOINT=https://ewr1.vultrobjects.com
VULTR_STORAGE_REGION=ewr1
VULTR_STORAGE_BUCKET=notary-recordings-prod
VULTR_STORAGE_ACCESS_KEY=your_vultr_access_key
VULTR_STORAGE_SECRET_KEY=your_vultr_secret_key
VULTR_STORAGE_CDN_URL=https://your-cdn-domain.com

# ===== EXISTING VARIABLES (Keep these) =====
DATABASE_URL=your_database_url
JWT_SECRET=your_jwt_secret
NODE_ENV=production
# ... other existing environment variables
```

---

## 🧪 **PHASE 4: Testing & Verification**

### **1. Health Check Tests**

#### **OpenVidu Server**
```bash
# Test OpenVidu server
curl -k https://your-openvidu-server.com:4443/openvidu/api/config

# Expected response: Server configuration
```

#### **Railway.co Application**
```bash
# Test video health endpoint
curl https://your-railway-app.com/api/video/health

# Expected response:
{
  "status": "healthy",
  "services": {
    "openvidu": { "status": "healthy", "configured": true },
    "recording": { "status": "healthy", "configured": true }
  }
}
```

### **2. Video Session Test**

#### **Create Test Session**
```bash
curl -X POST https://your-railway-app.com/api/jobs/123/video-session \
  -H "Authorization: Bearer your_test_token" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-123",
    "participants": [
      {
        "userId": 1,
        "role": "notary",
        "displayName": "Test Notary",
        "email": "notary@test.com"
      }
    ]
  }'
```

#### **Expected Response**
```json
{
  "success": true,
  "sessionId": "test-session-123",
  "sessionToken": "wss://...",
  "participants": [...],
  "config": {
    "recordingEnabled": true,
    "maxParticipants": 8
  }
}
```

### **3. Recording Test**

#### **Start Recording**
```bash
curl -X POST https://your-railway-app.com/api/jobs/123/video-recording/start \
  -H "Authorization: Bearer your_test_token" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-123",
    "layout": "grid",
    "resolution": "1920x1080"
  }'
```

#### **Stop Recording**  
```bash
curl -X POST https://your-railway-app.com/api/jobs/123/video-recording/stop \
  -H "Authorization: Bearer your_test_token" \
  -H "Content-Type: application/json" \
  -d '{
    "recordingId": "recording-id-from-start"
  }'
```

#### **Verify Vultr Upload**
```bash
# Check Vultr bucket for uploaded recording
# Should see file: recordings/YYYY-MM-DD/job-123/recording-id.mp4
```

---

## 🎯 **PHASE 5: Go-Live Checklist**

### **Pre-Launch Verification**
- [ ] OpenVidu server accessible and healthy
- [ ] Vultr Object Storage bucket configured
- [ ] Railway.co app deployed with all environment variables
- [ ] Video session creation working
- [ ] Recording start/stop working  
- [ ] Vultr upload working
- [ ] Frontend video grid displaying correctly
- [ ] 8-slot video layout functioning
- [ ] Audio/video controls working
- [ ] Chat panel functional
- [ ] Waiting room working

### **Performance Tests**
- [ ] Test with 2 participants
- [ ] Test with 4 participants  
- [ ] Test with 8 participants (max)
- [ ] Test recording quality
- [ ] Test Vultr upload speed
- [ ] Test CDN playback (if enabled)
- [ ] Test mobile compatibility
- [ ] Test different browsers

### **Production Monitoring**
- [ ] Set up Vultr storage monitoring
- [ ] Configure OpenVidu server monitoring
- [ ] Set up recording failure alerts
- [ ] Monitor Railway.co metrics
- [ ] Test backup procedures

---

## 💰 **Cost Analysis**

### **Monthly Costs (Estimated)**

#### **OpenVidu Server (DigitalOcean)**
- **Droplet**: $20-40/month (2-4GB RAM)
- **Bandwidth**: $0-10/month (included)
- **Storage**: $1-5/month (recordings temp storage)

#### **Vultr Object Storage**  
- **Storage**: $5-20/month (50-200GB recordings)
- **Bandwidth**: $5-15/month (downloads)
- **CDN**: $2-8/month (optional)

#### **Total Monthly Cost**: **$33-98/month**
**vs Whereby Enterprise**: **$999/month**
**Savings**: **93%+ cost reduction**

---

## 🚨 **Troubleshooting**

### **Common Issues**

#### **OpenVidu Connection Failed**
```bash
# Check server status
docker-compose logs openvidu-server

# Verify firewall
ufw status

# Test connectivity  
telnet your-server-ip 4443
```

#### **Recording Upload Failed**
```bash
# Check Vultr credentials
curl -X GET https://ewr1.vultrobjects.com \
  -H "AWS Access Key: your_access_key"

# Check Railway.co logs
railway logs
```

#### **Video Grid Not Loading**
```bash
# Check browser console for errors
# Verify OpenVidu client connection
# Check WebRTC permissions
```

### **Support Contacts**
- **OpenVidu Documentation**: https://docs.openvidu.io/
- **Vultr Support**: https://vultr.com/support/
- **Railway.co Support**: https://railway.app/help

---

## 🎉 **Production Ready!**

Once all phases are complete, your notary platform will have:

✅ **Professional Video Conferencing** - Self-hosted OpenVidu  
✅ **Automatic Recording** - All sessions saved to Vultr  
✅ **8-Slot Video Grid** - Professional notary layout  
✅ **Cost Savings** - 93%+ reduction vs Whereby  
✅ **Full Control** - Self-hosted infrastructure  
✅ **Compliance Ready** - All recordings preserved  

**🚀 Ready to serve production traffic!** 