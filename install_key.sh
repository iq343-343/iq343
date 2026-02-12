#!/bin/bash
# Installs the local public key to the server's authorized_keys

echo "🔑 Installing deploy_key.pub to root@147.45.254.144..."
echo "You will be asked for the server password."

cat deploy_key.pub | ssh root@147.45.254.144 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"

if [ $? -eq 0 ]; then
    echo "✅ Success! Key installed."
else
    echo "❌ Failed to install key."
fi
