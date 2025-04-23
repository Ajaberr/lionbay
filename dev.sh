#!/bin/bash

# Development server script for MarketCU
# This script starts both the frontend and backend servers with proper configuration

echo "=== MarketCU Development Server ==="
echo "Starting development environment..."

# Kill any existing servers
pkill -f -9 "node" || true

# Set development environment variables
export NODE_ENV=development
export VITE_API_HOST=http://localhost:3001
export SKIP_EMAIL_VERIFICATION=TRUE

# Root directory
ROOT_DIR=$(pwd)
echo "Root directory: $ROOT_DIR"

# Start the backend server
echo "Starting backend server..."
cd "$ROOT_DIR/marketCU/server"

# Add API_BASE_URL to .env file if not already present
grep -q "API_BASE_URL" .env || echo "API_BASE_URL=http://localhost:3001" >> .env
grep -q "SKIP_EMAIL_VERIFICATION" .env || echo "SKIP_EMAIL_VERIFICATION=TRUE" >> .env

# Start the server in background
node server.js &
SERVER_PID=$!
echo "Backend server started with PID: $SERVER_PID"

# Wait a moment for the backend to start
sleep 2

# Start the frontend server
echo "Starting frontend server..."
cd "$ROOT_DIR/marketCU"

# Make sure Vite knows the API host
cat > .env.local << EOL
VITE_API_HOST=http://localhost:3001
EOL

# Start the frontend server in background
npm run dev &
FRONTEND_PID=$!
echo "Frontend server started with PID: $FRONTEND_PID"

echo ""
echo "Development environment is running:"
echo "- Frontend: http://localhost:5173"
echo "- Backend: http://localhost:3001"
echo ""
echo "To stop the servers, press Ctrl+C or run: kill $SERVER_PID $FRONTEND_PID"

# Wait for Ctrl+C
trap "kill $SERVER_PID $FRONTEND_PID; echo 'Servers stopped.'; exit 0" INT
wait 