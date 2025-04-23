#!/usr/bin/env bash
# This script builds the app for Render deployment

echo "Building the application..."

# Install dependencies at the root level
npm install

# Install dependencies in the marketCU directory
cd marketCU
npm install

echo "Building the client..."
npm run build

echo "Build completed successfully" 