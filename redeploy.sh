#!/bin/bash
# Quick redeploy script - run after pushing new code to GitHub
set -e

cd /home/ubuntu/hot-outreach-pro
echo "Pulling latest code..."
git pull origin main

echo "Installing dependencies..."
npm ci --production=false

echo "Building..."
export NODE_OPTIONS="--max-old-space-size=1024"
npm run build

echo "Restarting app..."
pm2 restart hot-outreach-pro

echo "Done! App redeployed."
