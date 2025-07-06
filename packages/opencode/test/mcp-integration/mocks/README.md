# MCP Mock Servers for Testing

This directory contains mock MCP servers for comprehensive testing of DGMO's MCP integration.

## Directory Structure

- `local/` - Mock local MCP servers (stdio-based)
- `remote/` - Mock remote MCP servers (HTTP-based)
- `scenarios/` - Failure scenario servers (timeouts, crashes, etc.)
- `tools/` - Servers with different tool configurations
- `resources/` - Servers with resource simulation
- `shared/` - Common utilities and types

## Mock Server Types

### Local Servers

- `basic-server.ts` - Simple server with basic tools
- `file-server.ts` - File operations server
- `database-server.ts` - Database simulation server

### Remote Servers

- `http-server.ts` - HTTP-based MCP server
- `sse-server.ts` - Server-Sent Events server

### Failure Scenarios

- `timeout-server.ts` - Connection timeout simulation
- `crash-server.ts` - Random crash simulation
- `invalid-response-server.ts` - Malformed response simulation
- `slow-server.ts` - Slow response simulation

### Tool Variations

- `minimal-tools.ts` - Server with minimal tool set
- `extensive-tools.ts` - Server with many tools
- `dynamic-tools.ts` - Server with dynamically changing tools

### Resource Servers

- `file-resources.ts` - File resource simulation
- `api-resources.ts` - API resource simulation
- `database-resources.ts` - Database resource simulation

## Usage

See individual server files for specific usage instructions and configuration options.
