#!/bin/bash

# A script to fix connection issues between the frontend and backend

echo "=== MarketCU Connection Fix Script ==="
echo "This script will:"
echo "1. Stop any running servers on port 3001"
echo "2. Build the frontend with the correct configuration"
echo "3. Update the server to properly serve the frontend"
echo "4. Restart both servers"
echo ""

# 1. Stop any running servers
echo "Stopping servers on port 3001..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
echo "Stopped."

# 2. Go to the frontend directory and ensure proxy points to port 3001
cd /Users/abdullahalzahrani/Projects/marketCU/marketCU

echo "Updating Vite config to proxy to correct port..."
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
    // This guarantees the output is in marketCU/dist
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
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
EOL

# Make sure terser is installed
echo "Installing terser for minification..."
npm install terser --save-dev

# Build the frontend
echo "Building frontend..."
npm run build
echo "Frontend build complete."

# 3. Update the server.js file to use the absolute path
cd /Users/abdullahalzahrani/Projects/marketCU/marketCU/server
echo "Updating server.js to serve static files from the absolute path..."

sed -i.bak "$(cat <<'EOL'
/app\.use(express\.urlencoded({ extended: true, limit: '50mb' }))/a\\
\\
// Debug current working directory and paths\\
console.log('Current working directory:', process.cwd());\\
console.log('__dirname:', __dirname);\\
\\
// Use the exact build path we confirmed exists\\
const distPath = '/Users/abdullahalzahrani/Projects/marketCU/marketCU/dist';\\
console.log(\`Checking dist path: \${distPath} - exists: \${fs.existsSync(distPath)}\`);\\
\\
if (fs.existsSync(distPath)) {\\
  console.log('Frontend build found. Serving static files from:', distPath);\\
  app.use(express.static(distPath));\\
  \\
  // Add a catch-all route to serve index.html for client-side routing\\
  app.get('*', (req, res, next) => {\\
    // Skip API routes\\
    if (req.path.startsWith('/api/')) {\\
      return next();\\
    }\\
    res.sendFile(path.join(distPath, 'index.html'));\\
  });\\
  \\
  console.log('Added catch-all route for SPA navigation');\\
} else {\\
  console.log('WARNING: Frontend build not found at:', distPath);\\
}
EOL
)" server.js

echo "Server updated."

# 4. Start the servers
echo "Starting the backend server..."
cd /Users/abdullahalzahrani/Projects/marketCU/marketCU/server
node server.js &
SERVER_PID=$!

echo "Backend server started with PID: $SERVER_PID"
echo "Starting the frontend server..."
cd /Users/abdullahalzahrani/Projects/marketCU/marketCU
npm run dev &
FRONTEND_PID=$!

echo "Frontend server started with PID: $FRONTEND_PID"
echo ""
echo "Setup complete! The application should now be running with:"
echo "- Frontend at: http://localhost:5173 (or next available port)"
echo "- Backend at: http://localhost:3001"
echo ""
echo "To stop the servers, run:"
echo "kill $SERVER_PID $FRONTEND_PID" 