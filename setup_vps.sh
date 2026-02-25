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

  # 3. Setup Backend & Building
  echo "🔧 Setting up Backend..."
  cd $DIR
  npm install --production > /dev/null

  echo "📦 Building Extragram..."
  cd $DIR/extragram
  npm install > /dev/null
  npm run build
  cd $DIR

  # Create .env file on server 
  echo "TELEGRAM_BOT_TOKEN=8437314985:AAGI1qaOW2KjC2AYWLIZ8eUyetIxe1iuHzg" > .env
  echo "TELEGRAM_CHAT_ID=71247264" >> .env
  echo "PORT=3000" >> .env

  # Start/Restart Server with PM2
  pm2 start server.js --name "extract-backend" --update-env || pm2 restart "extract-backend" --update-env
  
  # Start/Restart Extrapars with PM2 (Prod Port 3002)
  echo "🔧 Starting Extrapars..."
  cd $DIR/extrapars
  npm install --production > /dev/null
  PORT=3002 pm2 start server.js --name "extract-extrapars" --update-env || PORT=3002 pm2 restart "extract-extrapars" --update-env

  pm2 save

  # 4. Configure Nginx
  echo "⚙️ Configuring Nginx..."
  cat > /etc/nginx/sites-available/$DOMAIN << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    root /var/www/extract-studio;
    index index.html;

    location / {
        try_files \\\$uri \\\$uri/ /index.html;
    }

    location /extragram/ {
        alias /var/www/extract-studio/extragram/dist/;
        try_files \\\$uri \\\$uri/ /extragram/index.html;
    }

    location ^~ /scope/api/ {
        proxy_pass http://localhost:3002/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\\$host;
        proxy_cache_bypass \\\$http_upgrade;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
    }

    location ^~ /scope/ {
        alias /var/www/extract-studio/extrapars/public/;
        index index.html;
        try_files \\\$uri \\\$uri/ /scope/index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\\$host;
        proxy_cache_bypass \\\$http_upgrade;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
    }
}
EOF
  ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl restart nginx
  
  # Diagnostics
  echo "🔍 Running diagnostics..."
  pm2 status
  echo "📜 Latest Nginx errors:"
  tail -n 10 /var/log/nginx/error.log
  
  # 5. SSL Setup
  if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    certbot --nginx --non-interactive --agree-tos --email $EMAIL --redirect -d $DOMAIN -d www.$DOMAIN
  else
    certbot --nginx -n --redirect -d $DOMAIN -d www.$DOMAIN
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
