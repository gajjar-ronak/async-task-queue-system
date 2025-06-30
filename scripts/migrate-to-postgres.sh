#!/bin/bash

# Migration script to set up PostgreSQL database for Docker deployment
set -e

echo "🔄 Setting up PostgreSQL database for Docker deployment..."

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

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "packages/shared" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Check if PostgreSQL is running (Docker)
print_status "Checking PostgreSQL connection..."
if ! docker-compose exec -T postgres pg_isready -U async_task_user -d async_task_db 2>/dev/null; then
    print_error "PostgreSQL is not running or not accessible."
    echo "Please start the Docker services first:"
    echo "  docker-compose up -d postgres"
    exit 1
fi

print_success "PostgreSQL is accessible"

# Set environment for PostgreSQL
export DATABASE_URL="postgresql://async_task_user:async_task_password@localhost:5432/async_task_db"

# Navigate to shared package
cd packages/shared

print_status "Generating Prisma client for PostgreSQL..."
npx prisma generate

print_status "Creating database migration..."
npx prisma migrate dev --name "initial-postgres-setup" --create-only || {
    print_warning "Migration creation failed, trying to push schema directly..."
    npx prisma db push --force-reset
}

print_status "Applying database migration..."
npx prisma migrate deploy || {
    print_warning "Migration deploy failed, trying to push schema..."
    npx prisma db push
}

print_success "Database schema applied successfully"

# Verify the setup
print_status "Verifying database setup..."
npx prisma db seed 2>/dev/null || print_warning "No seed script found, skipping seeding"

# Go back to root
cd ../..

print_success "PostgreSQL migration completed!"

echo ""
print_status "Database is ready for Docker deployment"
print_status "You can now start the full system with: ./scripts/docker-start.sh"
