#!/bin/bash

# Docker scaling script for worker services
set -e

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

# Check if number of workers is provided
if [ -z "$1" ]; then
    print_error "Usage: $0 <number_of_workers>"
    echo "Example: $0 3  # Scale to 3 worker instances"
    exit 1
fi

WORKER_COUNT=$1

# Validate input
if ! [[ "$WORKER_COUNT" =~ ^[0-9]+$ ]] || [ "$WORKER_COUNT" -lt 0 ]; then
    print_error "Number of workers must be a positive integer"
    exit 1
fi

if [ "$WORKER_COUNT" -gt 10 ]; then
    print_warning "Scaling to more than 10 workers. This may consume significant resources."
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Scaling cancelled."
        exit 0
    fi
fi

echo "⚖️  Scaling worker services to $WORKER_COUNT instances..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if services are running
if ! docker-compose ps | grep -q "Up"; then
    print_error "Services are not running. Please start them first with ./scripts/docker-start.sh"
    exit 1
fi

# Get current worker count
CURRENT_COUNT=$(docker-compose ps worker-service | grep -c "Up" || echo "0")
print_status "Current worker instances: $CURRENT_COUNT"
print_status "Target worker instances: $WORKER_COUNT"

if [ "$WORKER_COUNT" -eq "$CURRENT_COUNT" ]; then
    print_success "Already running $WORKER_COUNT worker instances. No scaling needed."
    exit 0
fi

# Scale the worker service
print_status "Scaling worker service..."
if [ "$WORKER_COUNT" -eq 0 ]; then
    print_warning "Stopping all worker instances..."
    docker-compose stop worker-service
else
    # Use the scaling compose file for better port management
    docker-compose -f docker-compose.yml -f docker-compose.scale.yml up -d --scale worker-service=$WORKER_COUNT
fi

# Wait for services to stabilize
print_status "Waiting for services to stabilize..."
sleep 10

# Check the actual running instances
ACTUAL_COUNT=$(docker-compose ps worker-service | grep -c "Up" || echo "0")

if [ "$ACTUAL_COUNT" -eq "$WORKER_COUNT" ]; then
    print_success "Successfully scaled to $WORKER_COUNT worker instances!"
else
    print_warning "Scaling completed, but running instances ($ACTUAL_COUNT) don't match target ($WORKER_COUNT)"
fi

# Show current status
print_status "Current service status:"
docker-compose ps

# Show worker health (internal Docker health checks)
print_status "Checking worker health via Docker health checks..."
WORKER_CONTAINERS=$(docker-compose ps -q worker-service)
if [ ! -z "$WORKER_CONTAINERS" ]; then
    i=1
    for container in $WORKER_CONTAINERS; do
        HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' $container 2>/dev/null || echo "unknown")
        CONTAINER_NAME=$(docker inspect --format='{{.Name}}' $container 2>/dev/null | sed 's/^.//' || echo "unknown")

        case $HEALTH_STATUS in
            "healthy")
                print_success "Worker $i ($CONTAINER_NAME): Healthy"
                ;;
            "unhealthy")
                print_error "Worker $i ($CONTAINER_NAME): Unhealthy"
                ;;
            "starting")
                print_warning "Worker $i ($CONTAINER_NAME): Starting..."
                ;;
            *)
                print_warning "Worker $i ($CONTAINER_NAME): Health status unknown"
                ;;
        esac
        i=$((i+1))
    done
else
    print_warning "No worker containers found"
fi

echo ""
print_status "Scaling operation completed!"
print_status "Monitor logs with: docker-compose logs -f worker-service"
print_status "View dashboard at: http://localhost:3002/dashboard.html"
