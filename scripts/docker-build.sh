#!/bin/bash

# Docker build script for distributed async task worker system
set -e

echo "🐳 Building Docker images for distributed async task worker system..."

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

# Generate Prisma client first
print_status "Generating Prisma client..."
npm run prisma:generate

# Build shared package
print_status "Building shared package..."
cd packages/shared
npm run build
cd ../..

# Build app service image
print_status "Building app-service Docker image..."
docker build -f services/app-service/Dockerfile -t async-task-app:latest . || {
    print_error "Failed to build app-service image"
    exit 1
}
print_success "App service image built successfully"

# Build worker service image
print_status "Building worker-service Docker image..."
docker build -f services/worker-service/Dockerfile -t async-task-worker:latest . || {
    print_error "Failed to build worker-service image"
    exit 1
}
print_success "Worker service image built successfully"

# Tag images with version if provided
if [ ! -z "$1" ]; then
    VERSION=$1
    print_status "Tagging images with version: $VERSION"
    docker tag async-task-app:latest async-task-app:$VERSION
    docker tag async-task-worker:latest async-task-worker:$VERSION
    print_success "Images tagged with version $VERSION"
fi

print_success "All Docker images built successfully!"

# Show built images
print_status "Built images:"
docker images | grep -E "(async-task-app|async-task-worker)"

echo ""
print_status "Next steps:"
echo "  1. Start the services: ./scripts/docker-start.sh"
echo "  2. Scale workers: ./scripts/docker-scale.sh <number_of_workers>"
echo "  3. View logs: docker-compose logs -f"
echo "  4. Stop services: ./scripts/docker-stop.sh"
