# Development Environment Setup

This guide covers the development environment setup for the OpenCode-DGM integration project.

## Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- VS Code with recommended extensions
- Git
- Bun (for OpenCode) - Install from https://bun.sh
- Python 3.10+ (for local development)

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd DGMSTT
   ```

2. **Copy environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and settings
   ```

3. **Start the development environment**
   ```bash
   ./scripts/dev.sh start
   ```

4. **Access the services**
   - OpenCode: http://localhost:3000
   - DGM API: http://localhost:8000
   - Adminer (DB): http://localhost:8080
   - Redis Commander: http://localhost:8081
   - Mailhog: http://localhost:8025
   - Portainer: http://localhost:9000

## Development Workflow

### Using the Development Script

The `scripts/dev.sh` script provides convenient commands for development:

```bash
# Start all services
./scripts/dev.sh start

# Stop all services
./scripts/dev.sh stop

# View logs
./scripts/dev.sh logs          # All services
./scripts/dev.sh logs opencode  # Specific service

# Run tests
./scripts/dev.sh test          # All tests
./scripts/dev.sh test dgm      # Service-specific tests

# Lint code
./scripts/dev.sh lint

# Format code
./scripts/dev.sh format

# Open shell in container
./scripts/dev.sh shell opencode
./scripts/dev.sh shell dgm

# Rebuild a service
./scripts/dev.sh rebuild opencode
```

### VS Code Integration

1. **Install recommended extensions**
   - Open VS Code
   - Go to Extensions view (Ctrl+Shift+X)
   - Search for "@recommended"
   - Install all recommended extensions

2. **Debugging**
   - **TypeScript (OpenCode)**: Use "OpenCode: Debug TypeScript" launch configuration
   - **Python (DGM)**: Use "DGM: Debug Python" launch configuration
   - **Full Stack**: Use "Full Stack: Debug Both Services" compound configuration

3. **Tasks**
   - Press `Ctrl+Shift+P` and type "Tasks: Run Task"
   - Available tasks:
     - Docker: Start/Stop Development Environment
     - Run Tests
     - Lint Code
     - View Logs

## Hot Reloading

Both services support hot reloading:

### OpenCode (TypeScript/Bun)
- File changes are automatically detected
- The server restarts automatically
- Browser refresh may be needed for UI changes

### DGM (Python)
- Python files are watched by `watchdog`
- The server reloads on file changes
- API endpoints update without manual restart

## Environment Variables

Key environment variables:

```bash
# API Keys
ANTHROPIC_API_KEY=your_key
OPENAI_API_KEY=your_key

# Development flags
DEBUG=1
ENABLE_HOT_RELOAD=true
NODE_ENV=development
ENVIRONMENT=development
```

## Database Management

### Adminer
Access at http://localhost:8080
- Server: `postgres`
- Username: `opencode_dgm`
- Password: (from .env)
- Database: `opencode_dgm`

### Migrations
```bash
# Run migrations
docker-compose -f docker-compose.dev.yml exec dgm python manage.py migrate

# Create new migration
docker-compose -f docker-compose.dev.yml exec dgm python manage.py makemigrations
```

## Testing

### Running Tests

```bash
# All tests
./scripts/dev.sh test

# OpenCode tests only
./scripts/dev.sh test opencode

# DGM tests only
./scripts/dev.sh test dgm

# With coverage
docker-compose -f docker-compose.dev.yml exec opencode bun test --coverage
docker-compose -f docker-compose.dev.yml exec dgm pytest --cov
```

### Writing Tests

**OpenCode (Jest)**:
```typescript
// opencode/src/__tests__/example.test.ts
describe('Example', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});
```

**DGM (Pytest)**:
```python
# dgm/tests/test_example.py
def test_example():
    assert True
```

## Code Quality

### Linting
```bash
# Run all linters
./scripts/dev.sh lint

# Auto-fix issues
./scripts/dev.sh format
```

### Pre-commit Hooks
```bash
# Install pre-commit hooks
cd dgm && pre-commit install
```

## Debugging Tips

### TypeScript Debugging
1. Add `debugger;` statement in code
2. Start debugging session in VS Code
3. Set breakpoints by clicking line numbers

### Python Debugging
1. Add `import pdb; pdb.set_trace()` or use `breakpoint()`
2. Attach debugger in VS Code
3. Use debug console for inspection

### Container Debugging
```bash
# Check container status
docker-compose -f docker-compose.dev.yml ps

# View container logs
docker-compose -f docker-compose.dev.yml logs -f [service]

# Execute commands in container
docker-compose -f docker-compose.dev.yml exec [service] [command]

# Inspect container
docker inspect dgmstt_[service]_1
```

## Performance Monitoring

### Redis Monitoring
Access Redis Commander at http://localhost:8081
- Username: `admin`
- Password: `admin` (or from .env)

### Database Queries
Enable query logging in development:
```python
# dgm/settings.py
LOGGING = {
    'loggers': {
        'django.db.backends': {
            'level': 'DEBUG',
        }
    }
}
```

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Find process using port
   lsof -i :3000
   # Kill process
   kill -9 [PID]
   ```

2. **Container won't start**
   ```bash
   # Check logs
   docker-compose -f docker-compose.dev.yml logs [service]
   # Rebuild
   ./scripts/dev.sh rebuild [service]
   ```

3. **Hot reload not working**
   - Check WATCHPACK_POLLING is set in docker-compose.dev.yml
   - Ensure volumes are mounted correctly
   - Try restarting the container

4. **Database connection issues**
   ```bash
   # Reset database
   docker-compose -f docker-compose.dev.yml down -v
   docker-compose -f docker-compose.dev.yml up -d postgres
   ```

## Advanced Configuration

### Custom Docker Networks
```bash
# Create custom network
docker network create opencode-dgm-dev

# Inspect network
docker network inspect opencode-dgm-dev
```

### Environment-specific Configs
- Development: `docker-compose.dev.yml`
- Production: `docker-compose.yml`
- Testing: `docker-compose.test.yml` (create as needed)

### Performance Tuning
1. Adjust Docker resource limits in Docker Desktop
2. Configure Redis memory limits in `redis.conf`
3. Tune PostgreSQL in `postgres.conf`

## Best Practices

1. **Commit hooks**: Use pre-commit for code quality
2. **Branch protection**: Don't commit directly to main
3. **Environment isolation**: Never use production credentials locally
4. **Docker hygiene**: Regularly clean unused images/volumes
5. **Security**: Keep `.env` files out of version control

## Resources

- [Docker Documentation](https://docs.docker.com/)
- [VS Code Debugging](https://code.visualstudio.com/docs/editor/debugging)
- [Bun Documentation](https://bun.sh/docs)
- [Python Debugging](https://docs.python.org/3/library/pdb.html)