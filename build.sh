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

# Ensure the build directory exists
if [ -d "dist" ]; then
  echo "Frontend build created successfully at: $(pwd)/dist"
  ls -la dist
else
  echo "WARNING: Frontend build directory not found!"
fi

echo "Build completed successfully" 