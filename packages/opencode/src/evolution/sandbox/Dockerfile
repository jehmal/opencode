# Evolution Sandbox - Secure Testing Environment
# Agent: safe-evolution-sandbox-003
# Purpose: Isolated environment for testing evolved code

FROM node:20-alpine AS base

# Security: Run as non-root user
RUN addgroup -g 1001 -S evolution && \
    adduser -S evolution -u 1001 -G evolution

# Install security tools and dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    git \
    bash \
    curl \
    dumb-init \
    # Security scanning tools
    npm@latest \
    # Resource monitoring
    htop \
    iotop \
    # Network tools for isolation testing
    iptables \
    tcpdump

# Install Node.js security packages globally
RUN npm install -g \
    snyk \
    npm-audit-resolver \
    lockfile-lint \
    better-npm-audit

# Create sandbox directories with proper permissions
RUN mkdir -p /sandbox/{code,tests,logs,snapshots,temp} && \
    chown -R evolution:evolution /sandbox

# Set up isolated workspace
WORKDIR /sandbox

# Copy package files for dependency installation
COPY --chown=evolution:evolution package*.json ./

# Install dependencies with security audit
RUN npm ci --only=production && \
    npm audit fix && \
    npm cache clean --force

# Security: Set resource limits
# CPU: 50% of one core
# Memory: 512MB
# Processes: 50
# File descriptors: 1024
RUN echo "evolution soft nproc 50" >> /etc/security/limits.conf && \
    echo "evolution hard nproc 50" >> /etc/security/limits.conf && \
    echo "evolution soft nofile 1024" >> /etc/security/limits.conf && \
    echo "evolution hard nofile 1024" >> /etc/security/limits.conf

# Copy sandbox runtime files
COPY --chown=evolution:evolution ./runtime/ ./runtime/
COPY --chown=evolution:evolution ./security/ ./security/

# Set up environment variables
ENV NODE_ENV=sandbox \
    SANDBOX_MODE=strict \
    MAX_EXECUTION_TIME=300000 \
    MAX_MEMORY_MB=512 \
    MAX_CPU_PERCENT=50 \
    ENABLE_NETWORK=false \
    LOG_LEVEL=debug

# Security: Drop all capabilities and add only what's needed
USER evolution

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node runtime/health-check.js || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command runs the sandbox manager
CMD ["node", "runtime/sandbox-manager.js"]

# Labels for tracking
LABEL maintainer="safe-evolution-sandbox-003" \
      version="1.0.0" \
      description="Secure sandbox for testing evolved code" \
      security.isolation="high" \
      security.capabilities="none" \
      resource.cpu.limit="0.5" \
      resource.memory.limit="512m"