#!/bin/bash

# Docker stop script for distributed async task worker system
set -e

echo "🛑 Stopping distributed async task worker system..."

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

# Parse command line arguments
REMOVE_VOLUMES=false
REMOVE_IMAGES=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --volumes)
            REMOVE_VOLUMES=true
            shift
            ;;
        --images)
            REMOVE_IMAGES=true
            shift
            ;;
        --all)
            REMOVE_VOLUMES=true
            REMOVE_IMAGES=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --volumes    Remove persistent volumes (database data will be lost)"
            echo "  --images     Remove Docker images"
            echo "  --all        Remove volumes and images"
            echo "  -h, --help   Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Stop all services gracefully
print_status "Stopping all services..."
docker-compose down

if [ "$REMOVE_VOLUMES" = true ]; then
    print_warning "Removing persistent volumes (database data will be lost)..."
    docker-compose down -v
    print_warning "Persistent data has been removed!"
fi

# Remove images if requested
if [ "$REMOVE_IMAGES" = true ]; then
    print_status "Removing Docker images..."
    
    # Remove app service image
    if docker image inspect async-task-app:latest > /dev/null 2>&1; then
        docker rmi async-task-app:latest
        print_status "Removed async-task-app:latest image"
    fi
    
    # Remove worker service image
    if docker image inspect async-task-worker:latest > /dev/null 2>&1; then
        docker rmi async-task-worker:latest
        print_status "Removed async-task-worker:latest image"
    fi
    
    # Remove any tagged versions
    docker images | grep -E "(async-task-app|async-task-worker)" | awk '{print $1":"$2}' | xargs -r docker rmi
    
    print_success "Docker images removed"
fi

# Clean up any orphaned containers
print_status "Cleaning up orphaned containers..."
docker-compose down --remove-orphans

# Show remaining containers (if any)
REMAINING=$(docker ps -a --filter "name=async-task" --format "table {{.Names}}\t{{.Status}}" | tail -n +2)
if [ ! -z "$REMAINING" ]; then
    print_warning "Remaining containers:"
    echo "$REMAINING"
else
    print_success "All containers stopped and removed"
fi

# Show remaining images (if any)
REMAINING_IMAGES=$(docker images | grep -E "(async-task-app|async-task-worker)" || true)
if [ ! -z "$REMAINING_IMAGES" ]; then
    print_status "Remaining images:"
    echo "$REMAINING_IMAGES"
fi

print_success "System stopped successfully!"

echo ""
print_status "To restart the system:"
echo "  🚀 Start: ./scripts/docker-start.sh"
echo "  🔨 Rebuild: ./scripts/docker-build.sh"
echo ""
if [ "$REMOVE_VOLUMES" = false ]; then
    print_status "Database data is preserved. Use --volumes flag to remove it."
fi
if [ "$REMOVE_IMAGES" = false ]; then
    print_status "Docker images are preserved. Use --images flag to remove them."
fi
