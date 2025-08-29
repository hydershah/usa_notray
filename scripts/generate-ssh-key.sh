#!/bin/bash

# Generate SSH key for GitHub Actions deployment
echo "🔑 Generating SSH key for GitHub Actions deployment..."

# Generate SSH key pair
ssh-keygen -t rsa -b 4096 -f ~/.ssh/usa_notray_deploy -N "" -C "github-actions-deployment"

echo ""
echo "🔑 SSH Key Generated!"
echo ""
echo "📋 Add this PUBLIC key to your VPS:"
echo "----------------------------------------"
cat ~/.ssh/usa_notray_deploy.pub
echo "----------------------------------------"
echo ""
echo "🚀 Add this PRIVATE key to GitHub Secrets as 'VPS_SSH_KEY':"
echo "----------------------------------------"
cat ~/.ssh/usa_notray_deploy
echo "----------------------------------------"
echo ""
echo "📝 GitHub Secrets to add:"
echo "VPS_HOST=144.202.30.172"
echo "VPS_USER=deploy"
echo "VPS_SSH_KEY=<paste the private key above>"
echo ""
