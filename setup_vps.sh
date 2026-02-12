#!/bin/bash
SERVER="root@147.45.254.144"
REPO="https://github.com/iq343-343/iq343.git"
DIR="/var/www/extract-studio"
DOMAIN="extract-studio.ru"
EMAIL="burdin.md@gmail.com"

# 0. Push local changes first
echo "📤 Pushing changes to GitHub..."
git push origin main
if [ $? -ne 0 ]; then
    echo "❌ Git push failed. Please check your GitHub credentials."
    exit 1
fi

echo "🚀 Starting VPS Setup on $SERVER for $DOMAIN..."
echo "You may be asked for your VPS password."

# Read the local public key to inject it
PUB_KEY=$(cat deploy_key.pub)

ssh -t $SERVER "bash -s" << ENDSSH
  # 1. Install Dependencies (Quietly)
  export DEBIAN_FRONTEND=noninteractive
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

  # 2. Setup Directory and Clone
  echo "📂 Setting up directory $DIR..."
  if [ -d "$DIR/.git" ]; then
    cd $DIR && git pull
  else
    rm -rf $DIR 
    git clone $REPO $DIR
  fi

  # 3. Setup Backend
  echo "🔧 Setting up Backend..."
  cd $DIR
  npm install --production > /dev/null

  # Create .env file on server (You might want to handle secrets more securely in production)
  echo "TELEGRAM_BOT_TOKEN=8437314985:AAGI1qaOW2KjC2AYWLIZ8eUyetIxe1iuHzg" > .env
  echo "TELEGRAM_CHAT_ID=71247264" >> .env
  echo "PORT=3000" >> .env

  # Start/Restart Server with PM2
  pm2 start server.js --name "extract-backend" --update-env || pm2 restart "extract-backend" --update-env
  pm2 save

  # 4. Configure Nginx
  echo "⚙️ Configuring Nginx..."
  cat > /etc/nginx/sites-available/$DOMAIN << 'EOF'
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    root $DIR;
    index index.html;

    location / {
        try_files \$uri \$uri/ =404;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
  ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl restart nginx
  
  # 5. SSL Setup
  if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    certbot --nginx --non-interactive --agree-tos --email $EMAIL --redirect -d $DOMAIN -d www.$DOMAIN
  fi

  # 6. Install Deployment Key for GitHub Actions
  echo "🔑 Installing Deployment Key..."
  mkdir -p ~/.ssh
  chmod 700 ~/.ssh
  touch ~/.ssh/authorized_keys
  chmod 600 ~/.ssh/authorized_keys
  # Check if key already exists to avoid duplicates
  if ! grep -q "$PUB_KEY" ~/.ssh/authorized_keys; then
      echo "$PUB_KEY" >> ~/.ssh/authorized_keys
      echo "✅ Key installed."
  else
      echo "✅ Key already exists."
  fi

  echo "🎉 Setup Complete! Visit https://$DOMAIN"
ENDSSH
