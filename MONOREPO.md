# OpenCode-DGM Monorepo Architecture

## Overview

This monorepo combines OpenCode (TypeScript/Bun) and DGM-STT (Python/Poetry) into a unified development environment with shared resources and coordinated builds.

## Directory Structure

```
opencode-dgm/
├── .github/              # GitHub Actions workflows
│   └── workflows/
│       ├── ci.yml       # Continuous Integration
│       └── deploy.yml   # Deployment pipeline
├── .vscode/             # VSCode workspace settings
├── dgm/                 # Python/Poetry workspace (DGM-STT)
│   ├── pyproject.toml   # Poetry configuration
│   ├── dgm/            # Python source code
│   └── tests/          # Python tests
├── opencode/           # TypeScript/Bun workspace
│   ├── package.json    # Bun package configuration
│   ├── packages/       # Internal packages
│   └── src/           # TypeScript source code
├── packages/           # Shared TypeScript packages
│   └── core/          # Core utilities and types
├── scripts/           # Build and utility scripts
│   └── setup.sh      # Initial setup script
├── shared/            # Cross-language shared resources
│   ├── protocols.json # JSON Schema definitions
│   ├── protocols.ts   # TypeScript interfaces
│   ├── protocols.py   # Python models
│   └── config.json    # Shared configuration
├── .dockerignore      # Docker ignore patterns
├── .editorconfig      # Editor configuration
├── .gitignore         # Git ignore patterns
├── .prettierrc        # Prettier configuration
├── bunfig.toml        # Bun configuration
├── docker-compose.yml # Docker Compose setup
├── Makefile           # Make commands
├── package.json       # Root package configuration
├── README.md          # Project overview
├── tsconfig.json      # TypeScript configuration
└── turbo.json         # Turborepo configuration
```

## Workspaces

### OpenCode (TypeScript/Bun)
- **Location**: `/opencode`
- **Package Manager**: Bun
- **Build Tool**: SST, Turbo
- **Testing**: Bun test
- **Key Features**:
  - AI-powered coding assistant
  - Multi-file editing capabilities
  - Project-wide refactoring

### DGM-STT (Python/Poetry)
- **Location**: `/dgm`
- **Package Manager**: Poetry
- **Build Tool**: Poetry build
- **Testing**: Pytest
- **Key Features**:
  - Self-improving agent framework
  - Dynamic prompt optimization
  - Benchmark evaluation

## Development Workflow

### Initial Setup
```bash
# Run the setup script
./scripts/setup.sh

# Or use Make
make setup
```

### Daily Development
```bash
# Start all services
bun run dev

# Start specific service
bun run dev:opencode
bun run dev:dgm

# Run tests
bun run test

# Format code
bun run format
```

### Building
```bash
# Build everything
bun run build

# Build TypeScript only
bun run build:ts

# Build Python only
bun run build:py
```

## Shared Resources

### Protocol Definitions
The `/shared` directory contains protocol definitions in multiple formats:
- `protocols.json` - JSON Schema definitions
- `protocols.ts` - TypeScript interfaces
- `protocols.py` - Python Pydantic models

### Cross-Language Communication
Services communicate using the defined protocols over HTTP/REST or message queues.

Example TypeScript usage:
```typescript
import { TaskRequest, createTaskId } from '@opencode-dgm/core';

const request: TaskRequest = {
  id: createTaskId(),
  type: 'code_generation',
  payload: {
    prompt: 'Generate a React component',
    language: 'typescript'
  }
};
```

Example Python usage:
```python
from shared.protocols import TaskRequest, CodeGenerationPayload

request = TaskRequest(
    id="task_123",
    type="code_generation",
    payload=CodeGenerationPayload(
        prompt="Generate a React component",
        language="typescript"
    )
)
```

## CI/CD Pipeline

### Continuous Integration
- Runs on all PRs and pushes to main/develop
- Parallel linting and testing for both languages
- Matrix testing for multiple Python versions
- Code coverage reporting

### Deployment
- Automated deployment on version tags
- Separate deployment for OpenCode (AWS/SST) and DGM (Kubernetes)
- Smoke tests after deployment
- Slack notifications

## Docker Development

### Running with Docker Compose
```bash
# Start all services
docker-compose up

# Start with development tools
docker-compose --profile dev up

# Build images
docker-compose build
```

### Services
- **opencode**: TypeScript/Bun application
- **dgm**: Python/Poetry application
- **redis**: Caching and queuing
- **postgres**: Persistent storage
- **nginx**: Reverse proxy
- **adminer**: Database UI (dev profile)
- **redis-commander**: Redis UI (dev profile)

## Best Practices

### Code Organization
1. Keep language-specific code in respective workspaces
2. Share types and protocols through `/shared`
3. Use `/packages` for reusable TypeScript modules
4. Follow consistent naming conventions

### Version Management
1. Use semantic versioning
2. Tag releases with `v*.*.*` format
3. Update changelogs before releases
4. Coordinate versions between services

### Testing Strategy
1. Unit tests in respective workspaces
2. Integration tests in CI pipeline
3. End-to-end tests for critical flows
4. Smoke tests after deployment

### Development Tips
1. Use the Makefile for common tasks
2. Run formatters before committing
3. Keep dependencies up to date
4. Document breaking changes

## Troubleshooting

### Common Issues

**Bun installation fails**
```bash
curl -fsSL https://bun.sh/install | bash
```

**Poetry not found**
```bash
curl -sSL https://install.python-poetry.org | python3 -
```

**Port conflicts**
Check `docker-compose.yml` and adjust port mappings as needed.

**Build failures**
```bash
# Clean and rebuild
make clean
make install
make build
```

## Contributing

1. Create feature branch from `develop`
2. Make changes in appropriate workspace
3. Update tests and documentation
4. Run full CI locally: `make ci`
5. Submit PR with clear description

## Additional Resources

- [OpenCode Documentation](./opencode/README.md)
- [DGM-STT Documentation](./dgm/README.md)
- [API Documentation](./docs/api.md)
- [Architecture Decision Records](./docs/adr/)