#!/bin/bash
# ============================================================
# EC2 Deployment Script for OutreachBot (hot-outreach)
# Run this script on your EC2 instance (Ubuntu/Amazon Linux)
# ============================================================

set -e

echo "=== OutreachBot EC2 Setup ==="

# --- 1. Update system ---
echo "[1/8] Updating system packages..."
sudo apt-get update -y && sudo apt-get upgrade -y

# --- 1.5. Setup swap (prevents OOM during build on low-memory instances) ---
echo "[2/8] Setting up swap space..."
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  echo "2GB swap created."
else
  sudo swapon /swapfile 2>/dev/null || true
  echo "Swap already exists."
fi

# --- 2. Install Node.js 20 LTS ---
echo "[3/8] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# --- 4. Install Git & Nginx ---
echo "[4/8] Installing Git and Nginx..."
sudo apt-get install -y git nginx

# --- 5. Clone the repository ---
echo "[5/8] Cloning repository..."
cd /home/ubuntu
if [ -d "hot-outreach-pro" ]; then
  echo "Directory exists, pulling latest..."
  cd hot-outreach-pro
  git pull origin main
else
  # REPLACE with your actual GitHub repo URL
  git clone https://github.com/ItsJupiter000/hot-outreach-pro.git
  cd hot-outreach-pro
fi

# --- 6. Install dependencies & build ---
echo "[6/8] Installing dependencies..."
npm ci --production=false

echo "[6/8] Creating .env file..."
if [ ! -f .env ]; then
  echo ">>> No .env file found. Creating from .env.example..."
  cp .env.example .env
  echo ">>> IMPORTANT: Edit /home/ubuntu/hot-outreach-pro/.env with your actual values!"
  echo ">>>   nano /home/ubuntu/hot-outreach-pro/.env"
fi

echo "[6/8] Building Next.js app (this may take a few minutes)..."
export NODE_OPTIONS="--max-old-space-size=1024"
npm run build

# --- 7. Setup PM2 for process management ---
echo "[7/8] Setting up PM2..."
sudo npm install -g pm2

# Start the app with PM2
cd /home/ubuntu/hot-outreach-pro
pm2 delete hot-outreach-pro 2>/dev/null || true
pm2 start npm --name "hot-outreach-pro" -- start
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash

# --- 8. Setup Nginx reverse proxy ---
echo "[8/8] Configuring Nginx..."
sudo tee /etc/nginx/sites-available/hot-outreach > /dev/null << 'NGINXEOF'
server {
    listen 80;
    server_name _;  # Replace _ with your domain if you have one

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
NGINXEOF

sudo ln -sf /etc/nginx/sites-available/hot-outreach /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

echo ""
echo "=== Deployment Complete! ==="
echo ""
echo "Your app is running at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo 'YOUR_EC2_PUBLIC_IP'):80"
echo ""
echo "NEXT STEPS:"
echo "  1. Edit .env:  nano /home/ubuntu/hot-outreach-pro/.env"
echo "  2. Rebuild:     cd /home/ubuntu/hot-outreach-pro && npm run build && pm2 restart hot-outreach-pro"
echo "  3. For HTTPS:   sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx -d your-domain.com"
echo ""
echo "USEFUL COMMANDS:"
echo "  pm2 status              - Check app status"
echo "  pm2 logs hot-outreach-pro   - View logs"
echo "  pm2 restart hot-outreach-pro - Restart app"
echo ""
