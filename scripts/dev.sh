#!/bin/bash
# Development environment management script

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(cat "$PROJECT_ROOT/.env" | grep -v '^#' | xargs)
fi

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Command functions
start_dev() {
    log_info "Starting development environment..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" up -d
    log_success "Development environment started!"
    log_info "Services available at:"
    echo "  - OpenCode: http://localhost:3000"
    echo "  - DGM API: http://localhost:8000"
    echo "  - Adminer: http://localhost:8080"
    echo "  - Redis Commander: http://localhost:8081"
    echo "  - Mailhog: http://localhost:8025"
    echo "  - Portainer: http://localhost:9000"
}

stop_dev() {
    log_info "Stopping development environment..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" down
    log_success "Development environment stopped!"
}

restart_dev() {
    stop_dev
    start_dev
}

rebuild_service() {
    local service=$1
    if [ -z "$service" ]; then
        log_error "Please specify a service to rebuild (opencode or dgm)"
        exit 1
    fi
    
    log_info "Rebuilding $service..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" build --no-cache "$service"
    docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" up -d "$service"
    log_success "$service rebuilt and restarted!"
}

logs() {
    local service=$1
    if [ -z "$service" ]; then
        docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" logs -f
    else
        docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" logs -f "$service"
    fi
}

shell() {
    local service=$1
    if [ -z "$service" ]; then
        log_error "Please specify a service (opencode or dgm)"
        exit 1
    fi
    
    docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" exec "$service" /bin/bash
}

run_tests() {
    local service=$1
    if [ -z "$service" ]; then
        log_info "Running all tests..."
        docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" exec opencode bun test
        docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" exec dgm python -m pytest -v
    elif [ "$service" == "opencode" ]; then
        log_info "Running OpenCode tests..."
        docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" exec opencode bun test
    elif [ "$service" == "dgm" ]; then
        log_info "Running DGM tests..."
        docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" exec dgm python -m pytest -v
    else
        log_error "Unknown service: $service"
        exit 1
    fi
}

lint() {
    local service=$1
    if [ -z "$service" ]; then
        log_info "Running linters for all services..."
        docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" exec opencode bun run lint
        docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" exec dgm bash -c "flake8 . && mypy ."
    elif [ "$service" == "opencode" ]; then
        log_info "Running OpenCode linter..."
        docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" exec opencode bun run lint
    elif [ "$service" == "dgm" ]; then
        log_info "Running DGM linters..."
        docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" exec dgm bash -c "flake8 . && mypy ."
    else
        log_error "Unknown service: $service"
        exit 1
    fi
}

format_code() {
    local service=$1
    if [ -z "$service" ]; then
        log_info "Formatting all code..."
        docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" exec opencode bun run format
        docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" exec dgm black .
    elif [ "$service" == "opencode" ]; then
        log_info "Formatting OpenCode..."
        docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" exec opencode bun run format
    elif [ "$service" == "dgm" ]; then
        log_info "Formatting DGM..."
        docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" exec dgm black .
    else
        log_error "Unknown service: $service"
        exit 1
    fi
}

clean() {
    log_warning "This will remove all containers, volumes, and cached data. Continue? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        log_info "Cleaning development environment..."
        docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" down -v
        find "$PROJECT_ROOT" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
        find "$PROJECT_ROOT" -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
        find "$PROJECT_ROOT" -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
        find "$PROJECT_ROOT" -type d -name ".next" -exec rm -rf {} + 2>/dev/null || true
        log_success "Development environment cleaned!"
    else
        log_info "Clean cancelled."
    fi
}

status() {
    docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" ps
}

# Main command handling
case "$1" in
    start)
        start_dev
        ;;
    stop)
        stop_dev
        ;;
    restart)
        restart_dev
        ;;
    rebuild)
        rebuild_service "$2"
        ;;
    logs)
        logs "$2"
        ;;
    shell)
        shell "$2"
        ;;
    test)
        run_tests "$2"
        ;;
    lint)
        lint "$2"
        ;;
    format)
        format_code "$2"
        ;;
    clean)
        clean
        ;;
    status)
        status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|rebuild|logs|shell|test|lint|format|clean|status} [service]"
        echo ""
        echo "Commands:"
        echo "  start              Start the development environment"
        echo "  stop               Stop the development environment"
        echo "  restart            Restart the development environment"
        echo "  rebuild [service]  Rebuild a specific service (opencode or dgm)"
        echo "  logs [service]     View logs (all services or specific)"
        echo "  shell [service]    Open a shell in a service container"
        echo "  test [service]     Run tests (all or specific service)"
        echo "  lint [service]     Run linters (all or specific service)"
        echo "  format [service]   Format code (all or specific service)"
        echo "  clean              Clean up all containers and cached data"
        echo "  status             Show status of all services"
        exit 1
        ;;
esac