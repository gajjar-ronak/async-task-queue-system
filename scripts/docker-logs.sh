#!/bin/bash

# Docker logs script for distributed async task worker system
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

# Default values
SERVICE=""
FOLLOW=false
TAIL_LINES=100

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        -n|--tail)
            TAIL_LINES="$2"
            shift 2
            ;;
        --app)
            SERVICE="app-service"
            shift
            ;;
        --worker)
            SERVICE="worker-service"
            shift
            ;;
        --redis)
            SERVICE="redis"
            shift
            ;;
        --postgres)
            SERVICE="postgres"
            shift
            ;;
        --all)
            SERVICE=""
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS] [SERVICE]"
            echo ""
            echo "Options:"
            echo "  -f, --follow     Follow log output (like tail -f)"
            echo "  -n, --tail NUM   Number of lines to show from the end (default: 100)"
            echo "  --app            Show only app-service logs"
            echo "  --worker         Show only worker-service logs"
            echo "  --redis          Show only Redis logs"
            echo "  --postgres       Show only PostgreSQL logs"
            echo "  --all            Show all service logs (default)"
            echo "  -h, --help       Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 --follow --worker    # Follow worker service logs"
            echo "  $0 -n 50 --app         # Show last 50 lines of app service logs"
            echo "  $0 -f                  # Follow all service logs"
            exit 0
            ;;
        *)
            if [ -z "$SERVICE" ]; then
                SERVICE="$1"
            else
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
            fi
            shift
            ;;
    esac
done

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

# Build docker-compose logs command
LOGS_CMD="docker-compose logs"

if [ "$FOLLOW" = true ]; then
    LOGS_CMD="$LOGS_CMD -f"
fi

LOGS_CMD="$LOGS_CMD --tail=$TAIL_LINES"

if [ ! -z "$SERVICE" ]; then
    LOGS_CMD="$LOGS_CMD $SERVICE"
    print_status "Showing logs for service: $SERVICE"
else
    print_status "Showing logs for all services"
fi

if [ "$FOLLOW" = true ]; then
    print_status "Following logs (Press Ctrl+C to stop)..."
else
    print_status "Showing last $TAIL_LINES lines..."
fi

echo ""

# Execute the logs command
eval $LOGS_CMD
