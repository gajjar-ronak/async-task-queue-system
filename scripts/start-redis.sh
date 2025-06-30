#!/bin/bash

# Start Redis server for development
echo "Starting Redis server..."

# Check if Redis is already running
if pgrep -x "redis-server" > /dev/null; then
    echo "Redis is already running"
    exit 0
fi

# Try to start Redis using different methods
if command -v redis-server &> /dev/null; then
    echo "Starting Redis with redis-server..."
    redis-server --daemonize yes --port 6379
elif command -v brew &> /dev/null && brew services list | grep redis &> /dev/null; then
    echo "Starting Redis with Homebrew..."
    brew services start redis
elif command -v docker &> /dev/null; then
    echo "Starting Redis with Docker..."
    docker run -d --name redis-async-worker -p 6379:6379 redis:alpine
else
    echo "Redis not found. Please install Redis or Docker."
    echo "For macOS: brew install redis"
    echo "For Ubuntu: sudo apt-get install redis-server"
    exit 1
fi

echo "Redis started successfully!"
