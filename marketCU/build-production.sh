#!/bin/bash

# Build the production version of the app
echo "Building production version..."

# Ensure we're in the correct directory
cd "$(dirname "$0")"

# Clean any previous builds
rm -rf build

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Set environment to production
export NODE_ENV=production

# Build the app
echo "Building with production configuration..."
npm run build

# Verify the build
if [ -d "build" ]; then
    echo "Build successful! Production files are in the 'build' directory."
    echo "You can now deploy these files to your hosting service."
else
    echo "Build failed! Please check for errors."
    exit 1
fi 