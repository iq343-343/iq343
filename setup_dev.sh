#!/bin/bash
SERVER="root@147.45.254.144"
REPO="https://github.com/iq343-343/iq343.git"
DIR="/var/www/extract-studio-dev"
DOMAIN="dev.extract-studio.ru"
EMAIL="burdin.md@gmail.com"
BRANCH="dev"

# Ensure we are in the script's directory
cd "$(dirname "$0")" || exit

# 0. Push local changes (current branch)
echo "📤 Pushing changes to GitHub..."
git push origin $BRANCH
if [ $? -ne 0 ]; then
    echo "❌ Git push failed."
    exit 1
fi

echo "🚀 Starting DEV Setup on $SERVER for $DOMAIN..."

# Read public key
PUB_KEY=$(cat deploy_key.pub)

ssh -tt $SERVER "bash -s" << ENDSSH
  export DEBIAN_FRONTEND=noninteractive
  
  # 1. Setup Directory and Clone (DEV Branch)
  echo "📂 Setting up directory $DIR..."
  apt-get update > /dev/null
  apt-get install -y git nginx python3-certbot-nginx curl > /dev/null

  # Install Node.js (v20)
  if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null
    apt-get install -y nodejs > /dev/null
  fi

  # Install PM2 globally
  if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2 > /dev/null
  fi

  mkdir -p $DIR
  
  if [ -d "$DIR/.git" ]; then
    cd $DIR && git fetch && git checkout $BRANCH && git pull origin $BRANCH
  else
    rm -rf $DIR 
    git clone -b $BRANCH $REPO $DIR
  fi

  # 2. Setup Backend & Frontend Build
  echo "🔧 Setting up Backend & Building Extragram..."
  cd $DIR
  npm install --production > /dev/null

  # Build Extragram
  echo "📦 Building Extragram..."
  cd $DIR/extragram
  npm install > /dev/null
  npm run build
  cd $DIR

  # Create .env file on server (Basic dev config)
  echo "TELEGRAM_BOT_TOKEN=8437314985:AAGI1qaOW2KjC2AYWLIZ8eUyetIxe1iuHzg" > .env
  echo "TELEGRAM_CHAT_ID=71247264" >> .env
  echo "PORT=3001" >> .env

  # Start/Restart Server with PM2 (Dev Port 3001)
  pm2 start server.js --name "extract-backend-dev" --update-env || pm2 restart "extract-backend-dev" --update-env
  pm2 save

  # 3. Configure Nginx for DEV
  echo "⚙️ Configuring Nginx for DEV..."
  cat > /etc/nginx/sites-available/$DOMAIN << 'EOF'
server {
    listen 80;
    server_name $DOMAIN;
    root $DIR;
    index index.html;

    location / { 
        try_files \$uri \$uri/ /index.html; 
    }

    location /extragram/ {
        alias /var/www/extract-studio-dev/extragram/dist/;
        try_files \$uri \$uri/ /extragram/index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
  ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
  nginx -t && systemctl reload nginx
  
  # 3. SSL Setup
  if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    certbot --nginx --non-interactive --agree-tos --email $EMAIL --redirect -d $DOMAIN
  fi

  # 4. Install Deployment Key (if missing)
  mkdir -p ~/.ssh && chmod 700 ~/.ssh
  touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
  if ! grep -q "$PUB_KEY" ~/.ssh/authorized_keys; then
      echo "$PUB_KEY" >> ~/.ssh/authorized_keys
      echo "✅ Key installed."
  fi

  echo "🎉 DEV Setup Complete! Visit https://$DOMAIN"
ENDSSH
