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

ssh -t $SERVER "bash -s" << ENDSSH
  export DEBIAN_FRONTEND=noninteractive
  
  # 1. Setup Directory and Clone (DEV Branch)
  echo "📂 Setting up directory $DIR..."
  mkdir -p $DIR
  
  if [ -d "$DIR/.git" ]; then
    cd $DIR && git fetch && git checkout $BRANCH && git pull origin $BRANCH
  else
    rm -rf $DIR 
    git clone -b $BRANCH $REPO $DIR
  fi

  # 2. Configure Nginx for DEV
  echo "⚙️ Configuring Nginx for DEV..."
  cat > /etc/nginx/sites-available/$DOMAIN << 'EOF'
server {
    listen 80;
    server_name $DOMAIN;
    root $DIR;
    index index.html;
    location / { try_files \$uri \$uri/ =404; }
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
