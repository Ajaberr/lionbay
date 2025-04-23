#!/usr/bin/env bash
# This script builds the app for Render deployment

echo "Building the application..."

# Install dependencies at the root level
npm install

# Install dependencies in the marketCU directory
cd marketCU
npm install

# Make sure to install the server dependencies if there's a separate package.json
if [ -d "server" ] && [ -f "server/package.json" ]; then
  echo "Installing server dependencies..."
  cd server
  npm install
  cd ..
fi

echo "Building the client..."
npm run build

echo "Build completed successfully" 