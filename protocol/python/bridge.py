import asyncio
import json
import sys
import subprocess
from typing import Dict, Any, Optional, Callable
from pathlib import Path
import signal

from .types import (
    ToolContext,
    ToolResult,
    JsonRpcRequest,
    JsonRpcResponse,
    JsonRpcError,
    ErrorCode,
    PROTOCOL_VERSION
)
from .registry import ToolRegistry

class ExecutionBridge:
    """Bridge for executing tools across languages"""
    
    def __init__(self):
        self.typescript_process: Optional[subprocess.Popen] = None
        self.request_id = 0
        self.pending_requests: Dict[str, asyncio.Future] = {}
        self.running = False
    
    async def initialize(self, typescript_path: str = 'node') -> None:
        """Initialize the TypeScript bridge"""
        if self.typescript_process:
            return
        
        # Start TypeScript bridge process
        bridge_script = Path(__file__).parent.parent / 'typescript' / 'dist' / 'bridge.js'
        self.typescript_process = subprocess.Popen(
            [typescript_path, str(bridge_script), '--mode', 'client'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        
        self.running = True
        
        # Start reader task
        asyncio.create_task(self._read_typescript_output())
        
        # Wait for ready
        await self._wait_for_ready()
    
    async def execute(
        self,
        tool_id: str,
        language: str,
        parameters: Any,
        context: ToolContext
    ) -> ToolResult:
        """Execute a tool"""
        if language == 'python':
            return await self._execute_python(tool_id, parameters, context)
        else:
            return await self._execute_typescript(tool_id, parameters, context)
    
    async def _execute_python(
        self,
        tool_id: str,
        parameters: Any,
        context: ToolContext
    ) -> ToolResult:
        """Execute a Python tool"""
        tool = ToolRegistry.get(tool_id, 'python')
        if not tool:
            raise ValueError(f"Python tool '{tool_id}' not found")
        
        # Validate parameters
        valid, errors = ToolRegistry.validate_parameters(tool_id, 'python', parameters)
        if not valid:
            raise ValueError(f"Invalid parameters: {', '.join(errors)}")
        
        # Execute with timeout
        try:
            result = await asyncio.wait_for(
                tool.handler(parameters, context),
                timeout=context.timeout
            )
            return result
        except asyncio.TimeoutError:
            raise TimeoutError(f"Tool execution timed out after {context.timeout}s")
    
    async def _execute_typescript(
        self,
        tool_id: str,
        parameters: Any,
        context: ToolContext
    ) -> ToolResult:
        """Execute a TypeScript tool via bridge"""
        if not self.typescript_process:
            await self.initialize()
        
        request_id = str(self.request_id)
        self.request_id += 1
        
        request = {
            'jsonrpc': '2.0',
            'id': request_id,
            'method': 'tool.execute',
            'protocol': PROTOCOL_VERSION,
            'params': {
                'tool': tool_id,
                'language': 'typescript',
                'parameters': parameters,
                'context': {
                    'sessionId': context.session_id,
                    'messageId': context.message_id,
                    'timeout': int(context.timeout * 1000)  # Convert to milliseconds
                }
            }
        }
        
        # Create future for response
        future = asyncio.Future()
        self.pending_requests[request_id] = future
        
        # Send request
        self.typescript_process.stdin.write(json.dumps(request) + '\n')
        self.typescript_process.stdin.flush()
        
        # Wait for response with timeout
        try:
            response = await asyncio.wait_for(future, timeout=context.timeout)
            if 'error' in response:
                raise ValueError(response['error']['message'])
            return ToolResult(**response['result'])
        except asyncio.TimeoutError:
            self.pending_requests.pop(request_id, None)
            raise TimeoutError(f"TypeScript tool execution timed out after {context.timeout}s")
    
    async def _read_typescript_output(self) -> None:
        """Read output from TypeScript process"""
        while self.running and self.typescript_process:
            try:
                line = await asyncio.get_event_loop().run_in_executor(
                    None, self.typescript_process.stdout.readline
                )
                if not line:
                    break
                
                line = line.strip()
                if not line:
                    continue
                
                try:
                    response = json.loads(line)
                    self._handle_response(response)
                except json.JSONDecodeError:
                    print(f"Failed to parse TypeScript response: {line}", file=sys.stderr)
            except Exception as e:
                print(f"Error reading TypeScript output: {e}", file=sys.stderr)
                break
    
    def _handle_response(self, response: Dict[str, Any]) -> None:
        """Handle response from TypeScript"""
        request_id = str(response.get('id', ''))
        future = self.pending_requests.pop(request_id, None)
        
        if future and not future.done():
            future.set_result(response)
    
    async def _wait_for_ready(self) -> None:
        """Wait for TypeScript bridge to be ready"""
        for _ in range(100):  # 10 second timeout
            request = {
                'jsonrpc': '2.0',
                'id': 'ready-check',
                'method': 'ping',
                'protocol': PROTOCOL_VERSION
            }
            
            future = asyncio.Future()
            self.pending_requests['ready-check'] = future
            
            self.typescript_process.stdin.write(json.dumps(request) + '\n')
            self.typescript_process.stdin.flush()
            
            try:
                response = await asyncio.wait_for(future, timeout=0.1)
                if response.get('result') == 'pong':
                    return
            except asyncio.TimeoutError:
                pass
            
            await asyncio.sleep(0.1)
        
        raise RuntimeError("TypeScript bridge failed to start")
    
    async def shutdown(self) -> None:
        """Shutdown the bridge"""
        self.running = False
        
        if self.typescript_process:
            # Send shutdown request
            request = {
                'jsonrpc': '2.0',
                'id': 'shutdown',
                'method': 'shutdown',
                'protocol': PROTOCOL_VERSION
            }
            
            self.typescript_process.stdin.write(json.dumps(request) + '\n')
            self.typescript_process.stdin.flush()
            
            # Wait for process to exit
            try:
                await asyncio.wait_for(
                    asyncio.get_event_loop().run_in_executor(
                        None, self.typescript_process.wait
                    ),
                    timeout=5.0
                )
            except asyncio.TimeoutError:
                self.typescript_process.terminate()
                await asyncio.sleep(0.5)
                if self.typescript_process.poll() is None:
                    self.typescript_process.kill()
            
            self.typescript_process = None
    
    async def register_typescript_module(self, module_path: str) -> None:
        """Register TypeScript tools from a module"""
        if not self.typescript_process:
            await self.initialize()
        
        request = {
            'jsonrpc': '2.0',
            'id': str(self.request_id),
            'method': 'register.module',
            'protocol': PROTOCOL_VERSION,
            'params': {'module': module_path}
        }
        self.request_id += 1
        
        future = asyncio.Future()
        self.pending_requests[request['id']] = future
        
        self.typescript_process.stdin.write(json.dumps(request) + '\n')
        self.typescript_process.stdin.flush()
        
        try:
            await asyncio.wait_for(future, timeout=5.0)
        except asyncio.TimeoutError:
            self.pending_requests.pop(request['id'], None)
            raise TimeoutError("Registration timeout")

# Global bridge instance
_bridge = ExecutionBridge()

async def get_bridge() -> ExecutionBridge:
    """Get the global bridge instance"""
    return _bridge