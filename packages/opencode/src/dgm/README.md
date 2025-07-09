# DGM Integration for DGMO CLI

This module provides integration between DGMO CLI and DGM (Dynamic Graph Memory) to enhance AI capabilities with persistent memory and advanced reasoning.

## Architecture

The integration consists of three main components:

### 1. DGM Bridge (`bridge.ts`)

- Manages TypeScript-Python communication via stdin/stdout
- Handles message serialization/deserialization
- Provides health checking and error recovery
- Implements graceful degradation when DGM is unavailable

### 2. Session Manager (`session-manager.ts`)

- Integrates DGM bridge with DGMO's session management
- Manages DGM tool registration and execution
- Handles configuration and initialization
- Provides fallback to CLI-only mode

### 3. Python Bridge Server (`dgm/bridge/stdio_server.py`)

- Python-side implementation of the bridge protocol
- Manages DGM tool discovery and execution
- Handles JSON-RPC style communication
- Provides health status and capability reporting

## Configuration

Add DGM configuration to your `dgmo.json`:

```json
{
  "dgm": {
    "enabled": true,
    "pythonPath": "python3",
    "dgmPath": "/path/to/dgm",
    "timeout": 30000,
    "maxRetries": 3,
    "healthCheckInterval": 60000
  }
}
```

### Configuration Options

- `enabled`: Enable/disable DGM integration (default: false)
- `pythonPath`: Path to Python executable (default: "python3")
- `dgmPath`: Path to DGM module (optional, auto-discovery by default)
- `timeout`: Timeout for DGM operations in milliseconds (default: 30000)
- `maxRetries`: Maximum retry attempts for failed operations (default: 3)
- `healthCheckInterval`: Health check interval in milliseconds (default: 60000)

## Usage

When DGM is enabled and available, additional tools will be automatically registered:

- `dgm.memory_store`: Store information in DGM memory
- `dgm.memory_search`: Search DGM memory
- Additional tools as they are implemented in DGM

These tools integrate seamlessly with DGMO's existing tool system and are available to the AI assistant.

## Error Handling

The integration implements multiple levels of error handling:

1. **Bridge Level**: Connection errors, timeout handling, process management
2. **Tool Level**: Individual tool execution errors with detailed error messages
3. **System Level**: Graceful degradation to CLI-only mode if DGM is unavailable

## Development

### Adding New DGM Tools

1. Implement the tool in Python within the DGM module
2. Register it in the `stdio_server.py` tool registry
3. The tool will automatically be available in DGMO

### Testing

```bash
# Test the bridge connection
python -m dgm.bridge.stdio_server

# Run with DGM enabled
dgmo --dgm-enabled

# Check DGM status
dgmo status --include-dgm
```

## Troubleshooting

### DGM Not Connecting

1. Check Python is installed and accessible
2. Verify DGM module is installed: `pip install dgm`
3. Check logs for specific error messages
4. Ensure firewall/antivirus isn't blocking the connection

### Tools Not Available

1. Verify DGM is enabled in configuration
2. Check bridge health status
3. Ensure Python server is running correctly
4. Check for tool registration errors in logs

### Performance Issues

1. Adjust timeout settings if operations are slow
2. Monitor health check intervals
3. Check Python process resource usage
4. Consider disabling unused DGM features
