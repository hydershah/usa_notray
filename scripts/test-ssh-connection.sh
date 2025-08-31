#!/bin/bash

# Test SSH connection to VPS
echo "🔍 Testing SSH connection to VPS..."

# Test basic SSH connection
if ssh -o ConnectTimeout=10 -o BatchMode=yes root@144.202.30.172 "echo 'SSH connection successful'"; then
    echo "✅ SSH connection successful!"
else
    echo "❌ SSH connection failed!"
    echo "Please check:"
    echo "1. SSH key is properly set up"
    echo "2. VPS is accessible"
    echo "3. SSH key is added to authorized_keys on VPS"
    exit 1
fi

# Test directory access
echo "🔍 Testing directory access..."
if ssh root@144.202.30.172 "ls -la /opt/usa_notray/"; then
    echo "✅ Directory access successful!"
else
    echo "❌ Directory access failed!"
    exit 1
fi

# Test PM2 access
echo "🔍 Testing PM2 access..."
if ssh root@144.202.30.172 "pm2 --version"; then
    echo "✅ PM2 access successful!"
else
    echo "❌ PM2 access failed!"
    exit 1
fi

echo "🎉 All tests passed! Your VPS is ready for CI/CD deployment."
