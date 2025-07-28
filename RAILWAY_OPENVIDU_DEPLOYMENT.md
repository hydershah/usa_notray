# 🚀 Deploy OpenVidu on Railway.co - Step by Step

## Part 1: Create OpenVidu Service

### Step 1: In Railway.co Dashboard
1. **Open your existing project** (where your notary app is)
2. **Click "New Service"** (+ button)
3. **Select "Deploy from Docker Hub"**

### Step 2: Configure Docker Image
```
Docker Image: openvidu/openvidu-dev:2.31.0
Service Name: openvidu-server
```

### Step 3: Set Environment Variables for OpenVidu Service
**In the OpenVidu service settings → Variables tab:**

```bash
OPENVIDU_SECRET=NotaryVideoSecret2024
DOMAIN_OR_PUBLIC_IP=${{RAILWAY_STATIC_URL}}
OPENVIDU_RECORDING=true
OPENVIDU_RECORDING_PATH=/opt/openvidu/recordings
PORT=4443
OPENVIDU_RECORDING_AUTOSTOP_TIMEOUT=120
```

### Step 4: Deploy OpenVidu
1. **Click "Deploy"**
2. **Wait 2-3 minutes** for deployment
3. **Copy the generated URL** (something like: `https://openvidu-server-production-xxxx.up.railway.app`)

---

## Part 2: Update Your Main App

### Step 5: Update Your Main App Environment Variables
**In your main app service → Variables tab, ADD these:**

```bash
OPENVIDU_SERVER_URL=https://openvidu-server-production-xxxx.up.railway.app
OPENVIDU_SECRET=NotaryVideoSecret2024
```

### Step 6: Redeploy Your Main App
1. **Trigger a redeploy** of your main service
2. **Wait for deployment** to complete

---

## Part 3: Local Development Setup

### Step 7: Update Your Local .env File
**Add these lines to your local .env:**

```bash
# OpenVidu Configuration (use the Railway URL)
OPENVIDU_SERVER_URL=https://openvidu-server-production-xxxx.up.railway.app
OPENVIDU_SECRET=NotaryVideoSecret2024
```

### Step 8: Test Local Connection
```bash
# Restart your local server
npm run dev:server

# Should now connect successfully to Railway OpenVidu!
```

---

## ✅ Verification Steps

### Test 1: Health Check
**Open in browser:**
```
https://openvidu-server-production-xxxx.up.railway.app/openvidu/api/config
```
**Should return JSON configuration**

### Test 2: Main App Health
**Open in browser:**
```
http://localhost:3000/api/video/health
```
**Should return "healthy" status**

### Test 3: Video Session
1. **Go to your notary app**
2. **Click "Start Video Conference"**
3. **Should see 8-slot video grid**
4. **No connection errors!**

---

## 🎯 Quick Copy-Paste Values

**For OpenVidu Service:**
- **Docker Image**: `openvidu/openvidu-dev:2.31.0`
- **Secret**: `NotaryVideoSecret2024`
- **Domain**: `${{RAILWAY_STATIC_URL}}`

**For Main App:**
- **URL**: Use the generated Railway URL from OpenVidu service
- **Secret**: `NotaryVideoSecret2024` (same as above)

---

## 📱 What You'll Get

✅ **Professional video conferencing**
✅ **8-slot video grid as designed**  
✅ **Recording to Vultr Object Storage**
✅ **All on Railway.co platform**
✅ **Internal networking between services**
✅ **Cost: ~$30-50/month vs $999 Whereby** 