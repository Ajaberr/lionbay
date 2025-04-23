#!/bin/bash

# A script to start both frontend and backend servers

echo "=== Starting MarketCU Application ==="

# Kill any existing servers
echo "Stopping any existing servers..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
echo "Stopped."

# Start the backend server
echo "Starting the backend server..."
cd /Users/abdullahalzahrani/Projects/marketCU/marketCU/server
node server.js &
SERVER_PID=$!
echo "Backend server started with PID: $SERVER_PID"

# Give the backend server a moment to start
sleep 2

# Start the frontend server
echo "Starting the frontend server..."
cd /Users/abdullahalzahrani/Projects/marketCU/marketCU
npm run dev &
FRONTEND_PID=$!
echo "Frontend server started with PID: $FRONTEND_PID"

echo ""
echo "Application is now running with:"
echo "- Frontend at: http://localhost:5173 (or next available port)"
echo "- Backend at: http://localhost:3001"
echo ""
echo "To stop the servers, run:"
echo "kill $SERVER_PID $FRONTEND_PID"
echo ""
echo "or press Ctrl+C to stop this script and the servers"

# Wait for Ctrl+C
trap "kill $SERVER_PID $FRONTEND_PID; echo 'Servers stopped.'; exit 0" INT
wait 