# DGMSTT Monorepo Agent Guidelines

## Build/Test Commands

```bash
make test              # Run all tests (TypeScript + Python)
make test-ts           # Run TypeScript tests only
make test-py           # Run Python tests only
cd dgm && poetry run pytest tests/test_specific.py::test_name  # Run single Python test
bun test path/to/test.spec.ts  # Run single TypeScript test
make lint              # Lint all code
make format            # Format all code
make build             # Build all workspaces
make dev               # Start development servers
```

## Code Style

- **TypeScript**: Prettier (semi: true, singleQuote: true, printWidth: 100)
- **Python**: Black (line-length: 120) + isort (profile: black)
- **Imports**: Group by external/internal, alphabetically sorted
- **Types**: Strict typing required (TypeScript: strict mode, Python: mypy)
- **Naming**: camelCase (TS), snake_case (Python), PascalCase for classes/types
- **Error Handling**: Use try/catch with specific error types, always log errors
- **Async**: Prefer async/await over callbacks, handle rejections properly
