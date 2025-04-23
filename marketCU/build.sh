#!/usr/bin/env bash
# exit on error
set -o errexit

# Install dependencies
npm install

# Build the frontend
npm run build

# Output build info
echo "Build completed successfully!" 