#!/bin/bash
# Health check script for services

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check service health
check_service() {
    local service_name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "Checking $service_name... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✓ Healthy${NC} (Status: $response)"
        return 0
    else
        echo -e "${RED}✗ Unhealthy${NC} (Status: $response)"
        return 1
    fi
}

# Main health checks
echo "Running health checks..."
echo "========================"

# Check all services
check_service "OpenCode" "http://localhost:3000/health" || true
check_service "DGM API" "http://localhost:8000/health" || true
check_service "PostgreSQL" "http://localhost:5432" "000" || true  # Connection refused is expected
check_service "Redis" "http://localhost:6379" "000" || true        # Connection refused is expected
check_service "Adminer" "http://localhost:8080" || true
check_service "Redis Commander" "http://localhost:8081" || true
check_service "Mailhog" "http://localhost:8025" || true
check_service "Portainer" "http://localhost:9000" || true

echo "========================"

# Check Docker containers
echo -e "\nDocker container status:"
docker-compose -f docker-compose.dev.yml ps

# Check resource usage
echo -e "\nResource usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"