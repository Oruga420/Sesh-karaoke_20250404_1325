#!/bin/bash

# Start the backend servers
echo "Starting backend servers..."
cd server && npm install && npm run start:all &
SERVERS_PID=$!

# Wait a moment for the servers to start
sleep 2

# Start the frontend
echo "Starting frontend..."
cd ../ && npm install && npm start &
CLIENT_PID=$!

# Function to handle script termination
function cleanup {
  echo "Shutting down services..."
  kill $SERVERS_PID
  kill $CLIENT_PID
  exit
}

# Trap SIGINT (Ctrl+C) and call cleanup
trap cleanup SIGINT

# Wait for user to terminate with Ctrl+C
echo "Press Ctrl+C to stop all servers"
wait