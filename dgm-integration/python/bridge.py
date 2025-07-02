#!/usr/bin/env python3
"""
DGM Bridge - Python side
Handles communication between OpenCode TypeScript and DGM Python agent
"""

import sys
import json
import asyncio
import argparse
import logging
from typing import Dict, Any, Optional, List
import signal
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from adapter import DGMAdapter

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('dgm_bridge')


class JsonRpcServer:
    """Simple JSON-RPC 2.0 server for stdin/stdout communication"""
    
    def __init__(self, adapter: DGMAdapter):
        self.adapter = adapter
        self.running = True
        self.methods = {
            'ping': self._handle_ping,
            'evolve': self._handle_evolve,
            'test_improvement': self._handle_test_improvement,
            'apply_improvement': self._handle_apply_improvement,
            'get_status': self._handle_get_status,
            'shutdown': self._handle_shutdown,
        }
    
    async def start(self):
        """Start the JSON-RPC server"""
        logger.info("Starting DGM Bridge server...")
        
        # Set up signal handlers
        loop = asyncio.get_event_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, lambda: asyncio.create_task(self.shutdown()))
        
        # Initialize adapter
        await self.adapter.initialize()
        
        # Start reading from stdin
        await self._read_loop()
    
    async def _read_loop(self):
        """Read JSON-RPC requests from stdin"""
        reader = asyncio.StreamReader()
        protocol = asyncio.StreamReaderProtocol(reader)
        await asyncio.get_event_loop().connect_read_pipe(lambda: protocol, sys.stdin)
        
        while self.running:
            try:
                line = await reader.readline()
                if not line:
                    break
                
                line = line.decode().strip()
                if not line:
                    continue
                
                # Parse JSON-RPC request
                try:
                    request = json.loads(line)
                    response = await self._handle_request(request)
                    if response:
                        self._send_response(response)
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON: {e}")
                    self._send_error(None, -32700, "Parse error")
                except Exception as e:
                    logger.error(f"Request handling error: {e}", exc_info=True)
                    self._send_error(None, -32603, "Internal error")
            
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Read loop error: {e}", exc_info=True)
    
    async def _handle_request(self, request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Handle a JSON-RPC request"""
        # Validate request
        if not isinstance(request, dict):
            return self._error_response(None, -32600, "Invalid Request")
        
        request_id = request.get('id')
        method = request.get('method')
        params = request.get('params', {})
        
        if not method or not isinstance(method, str):
            return self._error_response(request_id, -32600, "Invalid Request")
        
        # Find and execute method
        handler = self.methods.get(method)
        if not handler:
            return self._error_response(request_id, -32601, f"Method not found: {method}")
        
        try:
            result = await handler(params)
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': result
            }
        except Exception as e:
            logger.error(f"Method {method} error: {e}", exc_info=True)
            return self._error_response(request_id, -32603, str(e))
    
    def _error_response(self, request_id: Any, code: int, message: str, data: Any = None) -> Dict[str, Any]:
        """Create an error response"""
        error = {'code': code, 'message': message}
        if data is not None:
            error['data'] = data
        
        return {
            'jsonrpc': '2.0',
            'id': request_id,
            'error': error
        }
    
    def _send_response(self, response: Dict[str, Any]):
        """Send a JSON-RPC response to stdout"""
        print(json.dumps(response), flush=True)
    
    def _send_error(self, request_id: Any, code: int, message: str):
        """Send an error response"""
        self._send_response(self._error_response(request_id, code, message))
    
    # Method handlers
    async def _handle_ping(self, params: Dict[str, Any]) -> str:
        """Handle ping request"""
        return 'pong'
    
    async def _handle_evolve(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle evolution request"""
        patterns = params.get('patterns', [])
        return await self.adapter.evolve(patterns)
    
    async def _handle_test_improvement(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle test improvement request"""
        improvement = params.get('improvement')
        if not improvement:
            raise ValueError("Missing improvement parameter")
        
        success = await self.adapter.test_improvement(improvement)
        return {'success': success}
    
    async def _handle_apply_improvement(self, params: Dict[str, Any]) -> None:
        """Handle apply improvement request"""
        improvement = params.get('improvement')
        if not improvement:
            raise ValueError("Missing improvement parameter")
        
        await self.adapter.apply_improvement(improvement)
        return None
    
    async def _handle_get_status(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle get status request"""
        return await self.adapter.get_status()
    
    async def _handle_shutdown(self, params: Dict[str, Any]) -> None:
        """Handle shutdown request"""
        logger.info("Shutdown requested")
        await self.shutdown()
        return None
    
    async def shutdown(self):
        """Shutdown the server"""
        self.running = False
        await self.adapter.cleanup()
        logger.info("Bridge server shutdown complete")


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='DGM Bridge Server')
    parser.add_argument('--agent-path', required=True, help='Path to DGM agent')
    parser.add_argument('--log-level', default='INFO', help='Logging level')
    args = parser.parse_args()
    
    # Set log level
    logger.setLevel(getattr(logging, args.log_level.upper()))
    
    # Create adapter and server
    adapter = DGMAdapter(args.agent_path)
    server = JsonRpcServer(adapter)
    
    try:
        await server.start()
    except KeyboardInterrupt:
        logger.info("Received interrupt signal")
    except Exception as e:
        logger.error(f"Server error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())