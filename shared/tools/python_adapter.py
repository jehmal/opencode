"""
Python Adapter for calling TypeScript tools
Provides seamless integration for Python code to execute TypeScript tools
"""

import asyncio
import json
import os
from typing import Dict, Any, Optional, List, Callable
from pathlib import Path
from datetime import datetime
import uuid

from ..types.python.tool import (
    ToolContext,
    ToolExecutionResult,
    ToolExecutionStatus,
    ToolError,
    ToolPerformance,
    ToolLogger
)
from ..types.converters.python.case_converter import snake_to_camel, camel_to_snake
from ..types.converters.python.json_converter import json_schema_to_python_type
from protocol.python.bridge import ExecutionBridge, get_bridge


class TypeScriptToolInfo:
    """TypeScript tool information"""
    def __init__(self, id: str, description: str, parameters: Dict[str, Any], 
                 metadata: Optional[Dict[str, Any]] = None):
        self.id = id
        self.description = description
        self.parameters = parameters
        self.metadata = metadata or {}


class TypeScriptToolRegistration:
    """TypeScript tool registration"""
    def __init__(self, module: str, tool_id: str, info: TypeScriptToolInfo):
        self.module = module
        self.tool_id = tool_id
        self.info = info


class PythonTypeScriptAdapter:
    """Adapter for calling TypeScript tools from Python"""
    
    _bridge: Optional[ExecutionBridge] = None
    _initialized: bool = False
    _typescript_tools: Dict[str, TypeScriptToolRegistration] = {}
    
    @classmethod
    async def initialize(cls) -> None:
        """Initialize the adapter"""
        if cls._initialized:
            return
        
        cls._bridge = await get_bridge()
        await cls._bridge.initialize()
        cls._initialized = True
    
    @classmethod
    async def register_typescript_tool(cls, registration: TypeScriptToolRegistration) -> None:
        """Register a TypeScript tool to be callable from Python"""
        await cls.initialize()
        
        tool_id = registration.info.id
        cls._typescript_tools[tool_id] = registration
    
    @classmethod
    def create_python_wrapper(cls, registration: TypeScriptToolRegistration) -> Dict[str, Any]:
        """Create a Python wrapper for a TypeScript tool"""
        info = registration.info
        
        # Create tool_info function
        def tool_info():
            return {
                "name": info.id,
                "description": info.description,
                "input_schema": info.parameters
            }
        
        # Create async tool function
        async def tool_function_async(**kwargs):
            # Convert parameters from snake_case to camelCase
            ts_params = snake_to_camel(kwargs)
            
            # Create context
            context = ToolContext(
                session_id=kwargs.get('_session_id', 'default'),
                message_id=kwargs.get('_message_id', str(datetime.now().timestamp())),
                user_id=kwargs.get('_user_id'),
                agent_id=kwargs.get('_agent_id'),
                environment=dict(os.environ),
                abort_signal=asyncio.Event(),
                timeout=kwargs.get('_timeout', 120),
                metadata=kwargs.get('_metadata', {}),
                logger=ConsoleLogger()
            )
            
            try:
                # Execute the TypeScript tool through the bridge
                result = await cls._bridge.execute(
                    info.id,
                    'typescript',
                    ts_params,
                    context
                )
                
                # Convert result from camelCase to snake_case
                python_result = camel_to_snake(result.output if hasattr(result, 'output') else result)
                
                return python_result
            except Exception as e:
                raise RuntimeError(f"TypeScript tool execution failed: {str(e)}")
        
        # Create sync wrapper
        def tool_function(**kwargs):
            return asyncio.run(tool_function_async(**kwargs))
        
        return {
            "tool_info": tool_info,
            "tool_function": tool_function,
            "tool_function_async": tool_function_async
        }
    
    @classmethod
    async def call_typescript_tool(
        cls,
        tool_id: str,
        parameters: Dict[str, Any],
        context: Optional[ToolContext] = None
    ) -> ToolExecutionResult:
        """Call a TypeScript tool directly"""
        await cls.initialize()
        
        registration = cls._typescript_tools.get(tool_id)
        if not registration:
            raise ValueError(f"TypeScript tool '{tool_id}' not found")
        
        start_time = datetime.now().isoformat()
        execution_id = f"exec_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:9]}"
        
        try:
            # Convert parameters to camelCase
            ts_params = snake_to_camel(parameters)
            
            # Create or use provided context
            if not context:
                context = ToolContext(
                    session_id='default',
                    message_id=str(datetime.now().timestamp()),
                    environment=dict(os.environ),
                    abort_signal=asyncio.Event(),
                    timeout=120,
                    metadata={},
                    logger=ConsoleLogger()
                )
            
            # Execute through bridge
            result = await cls._bridge.execute(
                tool_id,
                'typescript',
                ts_params,
                context
            )
            
            # Convert result to snake_case
            output = camel_to_snake(result)
            
            end_time = datetime.now().isoformat()
            duration = int((datetime.fromisoformat(end_time) - datetime.fromisoformat(start_time)).total_seconds() * 1000)
            
            return ToolExecutionResult(
                tool_id=tool_id,
                execution_id=execution_id,
                status=ToolExecutionStatus.SUCCESS,
                output=output,
                performance=ToolPerformance(
                    start_time=start_time,
                    end_time=end_time,
                    duration=duration
                )
            )
        except Exception as e:
            end_time = datetime.now().isoformat()
            duration = int((datetime.fromisoformat(end_time) - datetime.fromisoformat(start_time)).total_seconds() * 1000)
            
            tool_error = ToolError(
                code='TYPESCRIPT_EXECUTION_ERROR',
                message=str(e),
                details={'tool_id': tool_id, 'parameters': parameters},
                retryable=False
            )
            
            return ToolExecutionResult(
                tool_id=tool_id,
                execution_id=execution_id,
                status=ToolExecutionStatus.ERROR,
                error=tool_error,
                performance=ToolPerformance(
                    start_time=start_time,
                    end_time=end_time,
                    duration=duration
                )
            )
    
    @classmethod
    async def load_typescript_module(cls, module_path: str) -> None:
        """Load TypeScript tools from a module"""
        await cls.initialize()
        
        # Register the module with the bridge
        await cls._bridge.register_typescript_module(module_path)
        
        # Get tool info from the module
        tool_info = await cls._get_typescript_module_tools(module_path)
        
        # Register each tool
        for info in tool_info:
            await cls.register_typescript_tool(
                TypeScriptToolRegistration(
                    module=module_path,
                    tool_id=info['id'],
                    info=TypeScriptToolInfo(
                        id=info['id'],
                        description=info['description'],
                        parameters=info['parameters'],
                        metadata=info.get('metadata', {})
                    )
                )
            )
    
    @classmethod
    async def _get_typescript_module_tools(cls, module_path: str) -> List[Dict[str, Any]]:
        """Get tool information from a TypeScript module"""
        # This would be implemented by calling the TypeScript side
        # to enumerate tools in the module
        request = {
            'jsonrpc': '2.0',
            'id': str(uuid.uuid4()),
            'method': 'tools.list',
            'params': {'module': module_path}
        }
        
        response = await cls._bridge._execute_typescript_request(request)
        if 'error' in response:
            raise RuntimeError(f"Failed to get TypeScript tools: {response['error']['message']}")
        
        return response['result']
    
    @classmethod
    async def shutdown(cls) -> None:
        """Shutdown the adapter"""
        if cls._bridge:
            await cls._bridge.shutdown()
        cls._initialized = False
        cls._typescript_tools.clear()


class ConsoleLogger(ToolLogger):
    """Simple console logger implementation"""
    
    def debug(self, message: str, data: Optional[Any] = None) -> None:
        print(f"DEBUG: {message}", data if data else "")
    
    def info(self, message: str, data: Optional[Any] = None) -> None:
        print(f"INFO: {message}", data if data else "")
    
    def warn(self, message: str, data: Optional[Any] = None) -> None:
        print(f"WARN: {message}", data if data else "")
    
    def error(self, message: str, error: Optional[Any] = None) -> None:
        print(f"ERROR: {message}", error if error else "")
    
    def metric(self, name: str, value: float, tags: Optional[Dict[str, str]] = None) -> None:
        print(f"METRIC: {name}={value}", tags if tags else "")


# Convenience functions
async def register_typescript_tool(registration: TypeScriptToolRegistration) -> None:
    """Register a TypeScript tool"""
    return await PythonTypeScriptAdapter.register_typescript_tool(registration)


async def call_typescript_tool(
    tool_id: str,
    parameters: Dict[str, Any],
    context: Optional[ToolContext] = None
) -> ToolExecutionResult:
    """Call a TypeScript tool"""
    return await PythonTypeScriptAdapter.call_typescript_tool(tool_id, parameters, context)


async def load_typescript_module(module_path: str) -> None:
    """Load TypeScript tools from a module"""
    return await PythonTypeScriptAdapter.load_typescript_module(module_path)


def create_python_tool_wrapper(tool_id: str) -> Callable:
    """Create a Python function wrapper for a TypeScript tool"""
    async def wrapper(**kwargs):
        return await call_typescript_tool(tool_id, kwargs)
    
    def sync_wrapper(**kwargs):
        return asyncio.run(wrapper(**kwargs))
    
    return sync_wrapper