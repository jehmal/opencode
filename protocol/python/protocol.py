import asyncio
from typing import Dict, Any, List, Optional
import json
import sys

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
from .bridge import get_bridge

class ToolProtocol:
    """Main protocol handler for cross-language tool execution"""
    
    @classmethod
    async def handle_request(cls, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle a tool execution request"""
        try:
            # Validate request
            if request.get('jsonrpc') != '2.0':
                return cls._error_response(
                    request.get('id', ''),
                    ErrorCode.InvalidRequest,
                    'Invalid JSON-RPC version'
                )
            
            method = request.get('method', '')
            if method == 'ping':
                return {
                    'jsonrpc': '2.0',
                    'id': request.get('id'),
                    'result': 'pong',
                    'protocol': PROTOCOL_VERSION
                }
            
            if method == 'shutdown':
                # Signal shutdown
                asyncio.create_task(cls._shutdown())
                return {
                    'jsonrpc': '2.0',
                    'id': request.get('id'),
                    'result': 'ok',
                    'protocol': PROTOCOL_VERSION
                }
            
            if method == 'register.module':
                # Register a module
                module_path = request.get('params', {}).get('module')
                if not module_path:
                    return cls._error_response(
                        request.get('id'),
                        ErrorCode.InvalidParams,
                        'Missing module parameter'
                    )
                
                try:
                    ToolRegistry.load_python_module(module_path)
                    return {
                        'jsonrpc': '2.0',
                        'id': request.get('id'),
                        'result': 'ok',
                        'protocol': PROTOCOL_VERSION
                    }
                except Exception as e:
                    return cls._error_response(
                        request.get('id'),
                        ErrorCode.InternalError,
                        f'Failed to register module: {e}'
                    )
            
            if method != 'tool.execute':
                return cls._error_response(
                    request.get('id'),
                    ErrorCode.InvalidRequest,
                    f'Unknown method: {method}'
                )
            
            params = request.get('params', {})
            if not params.get('tool') or not params.get('language'):
                return cls._error_response(
                    request.get('id'),
                    ErrorCode.InvalidParams,
                    'Missing required parameters'
                )
            
            # Create context
            context = ToolContext(
                session_id=params['context']['sessionId'],
                message_id=params['context']['messageId'],
                abort=asyncio.Event(),
                timeout=params['context'].get('timeout', 120000) / 1000,  # Convert from ms
                metadata={}
            )
            
            # Execute tool
            bridge = await get_bridge()
            result = await bridge.execute(
                params['tool'],
                params['language'],
                params['parameters'],
                context
            )
            
            return {
                'jsonrpc': '2.0',
                'id': request.get('id'),
                'result': {
                    'output': result.output,
                    'metadata': result.metadata,
                    'diagnostics': result.diagnostics
                },
                'protocol': PROTOCOL_VERSION
            }
            
        except Exception as e:
            return cls._error_response(
                request.get('id', ''),
                ErrorCode.ExecutionError,
                str(e),
                {'tool': params.get('tool'), 'language': params.get('language')}
            )
    
    @classmethod
    def _error_response(
        cls,
        id: Any,
        code: ErrorCode,
        message: str,
        data: Optional[Any] = None
    ) -> Dict[str, Any]:
        """Create an error response"""
        return {
            'jsonrpc': '2.0',
            'id': id,
            'error': {
                'code': code,
                'message': message,
                'data': data
            },
            'protocol': PROTOCOL_VERSION
        }
    
    @classmethod
    async def _shutdown(cls) -> None:
        """Shutdown the protocol"""
        await asyncio.sleep(0.1)  # Allow response to be sent
        bridge = await get_bridge()
        await bridge.shutdown()
        sys.exit(0)
    
    @classmethod
    async def initialize(
        cls,
        typescript_path: Optional[str] = None,
        load_typescript_tools: bool = False,
        tool_modules: Optional[List[str]] = None
    ) -> None:
        """Initialize the protocol"""
        bridge = await get_bridge()
        
        # Initialize TypeScript bridge if needed
        if load_typescript_tools:
            await bridge.initialize(typescript_path or 'node')
            
            # Load specified TypeScript tool modules
            if tool_modules:
                for module in tool_modules:
                    await bridge.register_typescript_module(module)
    
    @classmethod
    async def execute_tool(
        cls,
        tool_id: str,
        parameters: Any,
        language: Optional[str] = None,
        session_id: str = 'default',
        message_id: str = '',
        timeout: float = 120.0
    ) -> ToolResult:
        """Execute a tool by ID"""
        # Auto-detect language if not specified
        if not language:
            py_tool = ToolRegistry.get(tool_id, 'python')
            ts_tool = ToolRegistry.get(tool_id, 'typescript')
            
            if py_tool and not ts_tool:
                language = 'python'
            elif ts_tool and not py_tool:
                language = 'typescript'
            elif py_tool and ts_tool:
                # Prefer Python if both exist
                language = 'python'
            else:
                raise ValueError(f"Tool '{tool_id}' not found")
        
        context = ToolContext(
            session_id=session_id,
            message_id=message_id or str(id(parameters)),
            abort=asyncio.Event(),
            timeout=timeout,
            metadata={}
        )
        
        bridge = await get_bridge()
        return await bridge.execute(tool_id, language, parameters, context)
    
    @classmethod
    def list_tools(cls) -> List[Dict[str, Any]]:
        """List all available tools"""
        return ToolRegistry.list_tools()
    
    @classmethod
    async def shutdown(cls) -> None:
        """Shutdown the protocol"""
        bridge = await get_bridge()
        await bridge.shutdown()
    
    @classmethod
    async def run_server(cls) -> None:
        """Run as a JSON-RPC server (for TypeScript bridge)"""
        # Read from stdin, write to stdout
        reader = asyncio.StreamReader()
        protocol = asyncio.StreamReaderProtocol(reader)
        await asyncio.get_event_loop().connect_read_pipe(lambda: protocol, sys.stdin)
        
        while True:
            try:
                line = await reader.readline()
                if not line:
                    break
                
                line = line.decode().strip()
                if not line:
                    continue
                
                try:
                    request = json.loads(line)
                    response = await cls.handle_request(request)
                    print(json.dumps(response), flush=True)
                except json.JSONDecodeError as e:
                    error_response = cls._error_response(
                        '',
                        ErrorCode.ParseError,
                        f'Parse error: {e}'
                    )
                    print(json.dumps(error_response), flush=True)
            except Exception as e:
                print(f"Server error: {e}", file=sys.stderr)
                break