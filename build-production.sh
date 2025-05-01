#!/bin/bash

# Production build script for MarketCU
# This script prepares the application for deployment on Render or similar platforms

echo "=== MarketCU Production Build Script ==="
echo "Building for production deployment..."

# Set production environment
export NODE_ENV=production

# Root directory
ROOT_DIR=$(pwd)
echo "Root directory: $ROOT_DIR"

# Build frontend
echo "Building frontend..."
cd $ROOT_DIR/marketCU

# Ensure the proxy points to the correct API endpoint in production
echo "Updating Vite config for production..."

cat > vite.config.js << 'EOL'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    // Ensure the build directory is resolved correctly
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        // In production, API requests will be served by the Render backend
        target: 'https://lionbay-api.onrender.com',
        changeOrigin: true,
      }
    }
  }
})
EOL

# Install terser for minification if needed
if ! npm list terser --depth=0 &> /dev/null; then
  echo "Installing terser for minification..."
  npm install terser --save-dev
fi

# Build the frontend
echo "Running frontend build..."
npm run build
if [ $? -ne 0 ]; then
  echo "Frontend build failed. Exiting."
  exit 1
fi
echo "Frontend build complete."

# Create or update .env.production file
echo "Creating production environment file..."
cat > .env.production << 'EOL'
# Production environment variables
NODE_ENV=production
SKIP_EMAIL_VERIFICATION=FALSE
EOL

echo "Creating symlink for server access to dist..."
# Create a dist directory at the root level that points to the marketCU/dist
cd $ROOT_DIR
if [ -L dist ]; then
  rm dist
fi
ln -s $ROOT_DIR/marketCU/dist dist
echo "Symlink created: $ROOT_DIR/dist -> $ROOT_DIR/marketCU/dist"

# Create a Render start script
echo "Creating Render start script..."
cat > render-start.sh << 'EOL'
#!/bin/bash

# Render start script for MarketCU
export NODE_ENV=production

# Log environment info
echo "Starting MarketCU in production mode..."
echo "NODE_ENV: $NODE_ENV"
echo "Working directory: $(pwd)"
echo "Contents of current directory: $(ls -la)"

# Start the server
cd marketCU/server
node server.js
EOL

chmod +x render-start.sh
echo "Render start script created: render-start.sh"

# Create Render YAML configuration
echo "Creating Render configuration..."
cat > render.yaml << 'EOL'
services:
  - type: web
    name: marketcu
    env: node
    plan: free
    buildCommand: ./build-production.sh
    startCommand: ./render-start.sh
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        sync: false
EOL

echo "Production build complete."
echo "To deploy to Render:"
echo "1. Commit and push these changes to your repository"
echo "2. Connect your repository to Render and use the render.yaml configuration"
echo "or"
echo "3. Deploy manually with the following settings:"
echo "   - Build Command: ./build-production.sh"
echo "   - Start Command: ./render-start.sh" 