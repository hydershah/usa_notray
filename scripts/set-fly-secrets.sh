#!/bin/bash

# Script to set Vultr secrets in Fly.io
# Run this to configure your production environment

echo "Setting Vultr secrets in Fly.io..."

fly secrets set \
  VULTR_ACCESS_KEY=GE8MIGK9HAH7L26SPN51 \
  VULTR_SECRET_KEY=F4kBLWvvM6CSL3nDtdp7ROdynGmc5A1Fxy1IH20e \
  VULTR_REGION=ewr1 \
  VULTR_BUCKET_NAME=usanotary \
  VULTR_ENDPOINT=https://ewr1.vultrobjects.com \
  VULTR_HOST_BASE=ewr1.vultrobjects.com \
  VULTR_HOST_BUCKET='%(bucket)s.ewr1.vultrobjects.com' \
  --app usa-notray-muddy-sound-7799

echo "✅ Vultr secrets set successfully!"
echo "Your app will restart automatically to apply the new configuration." 