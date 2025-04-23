#!/usr/bin/env bash
# This script builds the app for Render deployment

echo "Building the application..."
echo "Current directory: $(pwd)"

# Install dependencies at the root level
npm install

# Print environment and execution context
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# Install dependencies in the marketCU directory
cd marketCU
echo "Changed to marketCU directory: $(pwd)"
npm install

# Make sure to install the server dependencies if there's a separate package.json
if [ -d "server" ] && [ -f "server/package.json" ]; then
  echo "Installing server dependencies..."
  cd server
  npm install
  cd ..
fi

# Ensure Vite is installed
echo "Ensuring Vite is available..."
if ! npm list vite >/dev/null 2>&1; then
  echo "Vite not found in local dependencies, installing globally..."
  npm install -g vite
fi

echo "Building the client using npx vite build..."
# Force build with npx instead of npm script
npx vite build
echo "Build command completed with status: $?"

# Ensure the build directory exists
if [ -d "dist" ]; then
  echo "Frontend build created successfully at: $(pwd)/dist"
  # List files in dist directory
  ls -la dist
  # Make dist directory accessible for server
  chmod -R 755 dist
  
  # Copy dist to various possible locations the server might look for it
  echo "Copying dist folder to alternate locations..."
  cp -r dist ../dist 2>/dev/null || echo "Failed to copy to ../dist"
  mkdir -p ../server/dist 2>/dev/null
  cp -r dist/* ../server/dist 2>/dev/null || echo "Failed to copy to ../server/dist"
else
  echo "ERROR: dist directory not found after build!"
  echo "Trying again with different options..."
  
  # Try building with explicit outDir
  echo "Trying Vite build with explicit outDir option..."
  npx vite build --outDir=dist
  
  if [ -d "dist" ]; then
    echo "Second build attempt succeeded!"
    ls -la dist
    chmod -R 755 dist
    # Copy to alternate locations
    cp -r dist ../dist 2>/dev/null || echo "Failed to copy to ../dist"
    mkdir -p ../server/dist 2>/dev/null
    cp -r dist/* ../server/dist 2>/dev/null || echo "Failed to copy to ../server/dist"
  else
    echo "Trying direct npm build command..."
    npm run build
    
    if [ -d "dist" ]; then
      echo "npm run build succeeded!"
      ls -la dist
      chmod -R 755 dist
      # Copy to alternate locations
      cp -r dist ../dist 2>/dev/null || echo "Failed to copy to ../dist"
      mkdir -p ../server/dist 2>/dev/null
      cp -r dist/* ../server/dist 2>/dev/null || echo "Failed to copy to ../server/dist"
    else
      echo "All build attempts failed. Creating a static dist directory from public folder..."
      mkdir -p dist
      # Copy public files to dist as fallback
      if [ -d "public" ]; then
        cp -r public/* dist/ 2>/dev/null || echo "Failed to copy public files to dist"
        echo "Copied public files to dist directory as fallback"
        ls -la dist
        chmod -R 755 dist
        # Copy to alternate locations
        cp -r dist ../dist 2>/dev/null || echo "Failed to copy to ../dist"
        mkdir -p ../server/dist 2>/dev/null
        cp -r dist/* ../server/dist 2>/dev/null || echo "Failed to copy to ../server/dist"
      else
        echo "CRITICAL ERROR: No public directory found for fallback."
        echo "List of files in current directory:"
        ls -la
        echo "vite.config.js content:"
        cat vite.config.js || echo "vite.config.js not found"
        echo "package.json content:"
        cat package.json || echo "package.json not found"
      fi
    fi
  fi
fi

echo "Build completed" 