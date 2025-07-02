#!/bin/bash
# Build script for DGM Agent Docker image

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${GREEN}Building DGM Agent Docker Image${NC}"
echo "Project root: $PROJECT_ROOT"

# Check if we're in the right directory
if [ ! -f "$PROJECT_ROOT/shared/orchestration/agent-runtime/Dockerfile.agent" ]; then
    echo -e "${RED}Error: Dockerfile.agent not found!${NC}"
    echo "Expected location: $PROJECT_ROOT/shared/orchestration/agent-runtime/Dockerfile.agent"
    exit 1
fi

# Set build context to project root
cd "$PROJECT_ROOT"

# Build arguments
BUILD_ARGS=""
if [ -n "$HTTP_PROXY" ]; then
    BUILD_ARGS="$BUILD_ARGS --build-arg HTTP_PROXY=$HTTP_PROXY"
fi
if [ -n "$HTTPS_PROXY" ]; then
    BUILD_ARGS="$BUILD_ARGS --build-arg HTTPS_PROXY=$HTTPS_PROXY"
fi

# Image tag
IMAGE_TAG="${IMAGE_TAG:-dgmstt/agent:latest}"
echo -e "${YELLOW}Building image: $IMAGE_TAG${NC}"

# Build the image
echo -e "${GREEN}Starting Docker build...${NC}"
docker build \
    -f shared/orchestration/agent-runtime/Dockerfile.agent \
    -t "$IMAGE_TAG" \
    $BUILD_ARGS \
    --progress=plain \
    .

# Check if build was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Docker image built successfully: $IMAGE_TAG${NC}"
    
    # Show image info
    echo -e "\n${YELLOW}Image details:${NC}"
    docker images "$IMAGE_TAG"
    
    # Optional: Run a test container
    if [ "$1" == "--test" ]; then
        echo -e "\n${YELLOW}Running test container...${NC}"
        docker run --rm \
            --name dgm-agent-test \
            -e LOG_LEVEL=DEBUG \
            -e AGENT_ID=test-agent \
            "$IMAGE_TAG" \
            python -c "print('Agent container test successful!')"
    fi
else
    echo -e "${RED}✗ Docker build failed!${NC}"
    exit 1
fi

echo -e "\n${GREEN}Build complete!${NC}"
echo "To run an agent container:"
echo "  docker run -d --name my-agent $IMAGE_TAG"
echo ""
echo "To push to registry:"
echo "  docker push $IMAGE_TAG"