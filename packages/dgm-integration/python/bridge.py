#!/usr/bin/env python3
"""
JSON-RPC Bridge for TypeScript-Python communication
"""

import json
import sys
import traceback
from typing import Any, Dict, Optional, Callable
import asyncio
from concurrent.futures import ThreadPoolExecutor

from adapter import DGMAgentAdapter


class JSONRPCBridge:
    """Handles JSON-RPC communication between TypeScript and Python"""
    
    def __init__(self):
        self.adapter = DGMAgentAdapter()
        self.methods: Dict[str, Callable] = {
            # DGM Agent methods
            'execute_task': self.adapter.execute_task,
            'get_agent_state': self.adapter.get_agent_state,
            'evolve_based_on_patterns': self.adapter.evolve_based_on_patterns,
            # Additional helper methods
            'cleanup_agent': self.adapter.cleanup_agent,
            'reset_agent': self.adapter.reset_agent,
            'get_agent_diff': self.adapter.get_agent_diff,
            # Stats and management
            'get_stats': self.adapter.get_stats,
            'health': self.health_check,
            'echo': self.echo,
            'shutdown': self.shutdown
        }
        self.executor = ThreadPoolExecutor(max_workers=4)
        self.running = True
    
    def send_response(self, id: Any, result: Any = None, error: Dict[str, Any] = None):
        """Send JSON-RPC response"""
        response = {
            'jsonrpc': '2.0',
            'id': id
        }
        
        if error:
            response['error'] = error
        else:
            response['result'] = result
        
        sys.stdout.write(json.dumps(response) + '\n')
        sys.stdout.flush()
    
    def handle_request(self, request: Dict[str, Any]):
        """Process a JSON-RPC request"""
        try:
            # Validate request
            if request.get('jsonrpc') != '2.0':
                self.send_response(
                    request.get('id'),
                    error={
                        'code': -32600,
                        'message': 'Invalid Request',
                        'data': 'Missing or invalid jsonrpc field'
                    }
                )
                return
            
            method = request.get('method')
            params = request.get('params', {})
            id = request.get('id')
            
            if not method:
                self.send_response(
                    id,
                    error={
                        'code': -32600,
                        'message': 'Invalid Request',
                        'data': 'Missing method field'
                    }
                )
                return
            
            # Find and execute method
            handler = self.methods.get(method)
            if not handler:
                self.send_response(
                    id,
                    error={
                        'code': -32601,
                        'message': 'Method not found',
                        'data': f'Unknown method: {method}'
                    }
                )
                return
            
            # Execute method
            if asyncio.iscoroutinefunction(handler):
                # Handle async methods
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                result = loop.run_until_complete(handler(**params))
                loop.close()
            else:
                result = handler(**params)
            
            self.send_response(id, result=result)
            
        except Exception as e:
            self.send_response(
                request.get('id'),
                error={
                    'code': -32603,
                    'message': 'Internal error',
                    'data': str(e)
                }
            )
            # Log full traceback to stderr
            traceback.print_exc(file=sys.stderr)
    
    def health_check(self):
        """Health check endpoint"""
        return {'status': 'healthy', 'adapter': 'DGMAgent', 'version': '2.0'}
    
    def echo(self, message: str = ''):
        """Echo back the message for testing"""
        import time
        return {'echo': message, 'timestamp': time.time()}
    
    def shutdown(self):
        """Shutdown the bridge"""
        self.running = False
        self.executor.shutdown(wait=False)
        return {'status': 'shutting down'}
    
    def run(self):
        """Main event loop"""
        # Send ready signal
        sys.stdout.write(json.dumps({'type': 'ready'}) + '\n')
        sys.stdout.flush()
        
        # Process incoming messages
        while self.running:
            try:
                line = sys.stdin.readline()
                if not line:
                    break
                
                line = line.strip()
                if not line:
                    continue
                
                # Parse JSON-RPC request
                try:
                    request = json.loads(line)
                except json.JSONDecodeError as e:
                    sys.stderr.write(f"JSON decode error: {e}\n")
                    continue
                
                # Handle request in thread pool
                self.executor.submit(self.handle_request, request)
                
            except KeyboardInterrupt:
                break
            except Exception as e:
                sys.stderr.write(f"Unexpected error: {e}\n")
                traceback.print_exc(file=sys.stderr)
        
        # Cleanup
        self.executor.shutdown(wait=True)


if __name__ == '__main__':
    bridge = JSONRPCBridge()
    bridge.run()