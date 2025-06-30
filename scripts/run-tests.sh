#!/bin/bash

# Test runner script for distributed async task worker system
# Usage: ./scripts/run-tests.sh [unit|e2e|all|coverage]

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

# Function to check if services are running
check_dependencies() {
    print_status "Checking dependencies..."
    
    # Check if Redis is running (for E2E tests)
    if ! redis-cli ping > /dev/null 2>&1; then
        print_warning "Redis is not running. Starting Redis..."
        npm run redis:start &
        sleep 2
    fi
    
    # Check if database is accessible
    if [ ! -z "$DATABASE_URL" ]; then
        print_status "Database URL configured: $DATABASE_URL"
    else
        print_warning "DATABASE_URL not set. Using default test database."
        export DATABASE_URL="postgresql://test:test@localhost:5432/test_async_task_db"
    fi
}

# Function to run unit tests
run_unit_tests() {
    print_status "Running unit tests..."
    
    print_status "Running app service unit tests..."
    npm run test:app
    
    print_status "Running worker service unit tests..."
    npm run test:worker
    
    print_success "Unit tests completed successfully!"
}

# Function to run E2E tests
run_e2e_tests() {
    print_status "Running E2E tests..."
    check_dependencies
    
    print_status "Running app service E2E tests..."
    npm run test:e2e:app
    
    print_status "Running worker service E2E tests..."
    npm run test:e2e:worker
    
    print_success "E2E tests completed successfully!"
}

# Function to run tests with coverage
run_coverage_tests() {
    print_status "Running tests with coverage..."
    
    npm run test:coverage
    
    print_success "Coverage tests completed successfully!"
    print_status "Coverage reports generated in coverage/ directories"
}

# Function to run all tests
run_all_tests() {
    print_status "Running all tests (unit + E2E)..."
    
    run_unit_tests
    run_e2e_tests
    
    print_success "All tests completed successfully!"
}

# Main script logic
case "${1:-all}" in
    "unit")
        run_unit_tests
        ;;
    "e2e")
        run_e2e_tests
        ;;
    "coverage")
        run_coverage_tests
        ;;
    "all")
        run_all_tests
        ;;
    *)
        print_error "Invalid option: $1"
        echo "Usage: $0 [unit|e2e|all|coverage]"
        echo ""
        echo "Options:"
        echo "  unit     - Run unit tests only"
        echo "  e2e      - Run E2E tests only"
        echo "  coverage - Run tests with coverage"
        echo "  all      - Run all tests (default)"
        exit 1
        ;;
esac

print_success "Test execution completed!"
