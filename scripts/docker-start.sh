#!/bin/bash

# Docker start script for distributed async task worker system
set -e

echo "🚀 Starting distributed async task worker system..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if images exist
if ! docker image inspect async-task-app:latest > /dev/null 2>&1; then
    print_warning "App service image not found. Building images first..."
    ./scripts/docker-build.sh
fi

if ! docker image inspect async-task-worker:latest > /dev/null 2>&1; then
    print_warning "Worker service image not found. Building images first..."
    ./scripts/docker-build.sh
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    print_status "Creating .env file from .env.docker template..."
    cp .env.docker .env
fi

# Start the services
print_status "Starting infrastructure services (Redis, PostgreSQL)..."
docker-compose up -d redis postgres

# Wait for infrastructure to be ready
print_status "Waiting for infrastructure services to be ready..."
sleep 10

# Check if PostgreSQL is ready
print_status "Checking PostgreSQL connection..."
until docker-compose exec -T postgres pg_isready -U async_task_user -d async_task_db; do
    print_status "Waiting for PostgreSQL to be ready..."
    sleep 2
done

# Check if Redis is ready
print_status "Checking Redis connection..."
until docker-compose exec -T redis redis-cli ping; do
    print_status "Waiting for Redis to be ready..."
    sleep 2
done

print_success "Infrastructure services are ready!"

# Run database migrations
print_status "Running database migrations..."
# We'll need to run this from the app service container
docker-compose run --rm app-service sh -c "npx prisma generate --schema=./packages/shared/prisma/schema.prisma && npx prisma migrate deploy --schema=./packages/shared/prisma/schema.prisma" || {
    print_warning "Migration failed, but continuing..."
}

# Start application services
print_status "Starting application services..."
docker-compose up -d app-service worker-service

# Wait a moment for services to start
sleep 5

# Check service health
print_status "Checking service health..."
APP_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/health || echo "000")
WORKER_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/health || echo "000")

if [ "$APP_HEALTH" = "200" ]; then
    print_success "App service is healthy (HTTP $APP_HEALTH)"
else
    print_warning "App service health check failed (HTTP $APP_HEALTH)"
fi

if [ "$WORKER_HEALTH" = "200" ]; then
    print_success "Worker service is healthy (HTTP $WORKER_HEALTH)"
else
    print_warning "Worker service health check failed (HTTP $WORKER_HEALTH)"
fi

print_success "System started successfully!"

echo ""
print_status "Service URLs:"
echo "  📊 Dashboard: http://localhost:3002/dashboard.html"
echo "  🔧 App Service API: http://localhost:3002"
echo "  ⚙️  Worker Service: Internal only (not exposed)"
echo ""
print_status "Useful commands:"
echo "  📋 View logs: docker-compose logs -f"
echo "  📈 Scale workers: ./scripts/docker-scale.sh <number>"
echo "  🛑 Stop system: ./scripts/docker-stop.sh"
echo "  🔍 Service status: docker-compose ps"
