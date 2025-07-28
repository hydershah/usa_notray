# 🚀 Deploy OpenVidu on Railway.co

## Step 1: Create New Service in Railway.co

1. **Go to Railway.co Dashboard**
2. **Click "New Project"** → **"Deploy from Docker Hub"**
3. **Docker Image**: `openvidu/openvidu-dev:2.31.0`
4. **Service Name**: `openvidu-server`

## Step 2: Environment Variables for OpenVidu Service

```bash
# Required OpenVidu Configuration
OPENVIDU_SECRET=your_secure_random_secret_here
DOMAIN_OR_PUBLIC_IP=${{RAILWAY_STATIC_URL}}
OPENVIDU_RECORDING=true
OPENVIDU_RECORDING_PATH=/opt/openvidu/recordings
OPENVIDU_RECORDING_AUTOSTOP_TIMEOUT=120

# Port Configuration  
PORT=4443

# Optional: Recording webhook (your main app)
OPENVIDU_RECORDING_NOTIFICATION=https://${{your-main-app.RAILWAY_STATIC_URL}}/api/video/webhook
```

## Step 3: Update Your Main App Environment Variables

```bash
# In your main app service, add:
OPENVIDU_SERVER_URL=https://${{openvidu-server.RAILWAY_STATIC_URL}}
OPENVIDU_SECRET=same_secret_as_openvidu_service

# Keep your existing Vultr variables:
VULTR_STORAGE_ENDPOINT=https://ewr1.vultrobjects.com
VULTR_STORAGE_BUCKET=usanotary
VULTR_STORAGE_ACCESS_KEY=your_key
VULTR_STORAGE_SECRET_KEY=your_secret
```

## Step 4: Railway.co Internal Networking

```bash
# For internal communication (faster):
OPENVIDU_SERVER_URL=https://openvidu-server.railway.internal:4443

# For external access (testing):
OPENVIDU_SERVER_URL=https://openvidu-server-production-xxxx.up.railway.app
```

## Step 5: Deploy and Test

1. **Deploy OpenVidu service**
2. **Wait for deployment** (2-3 minutes)  
3. **Update main app** with new environment variables
4. **Restart main app**
5. **Test video functionality** 