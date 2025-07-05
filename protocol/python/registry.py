from typing import Dict, List, Optional, Any, Callable
import importlib
import inspect
import asyncio
from pathlib import Path

from .types import (
    ToolRegistration, 
    Language, 
    ToolHandler, 
    JSONSchema,
    ToolContext,
    ToolResult,
    ToolInfo
)
from .translator import SchemaTranslator

class ToolRegistry:
    """Registry for managing cross-language tools"""
    
    _tools: Dict[str, ToolRegistration] = {}
    
    @classmethod
    def register(cls, registration: ToolRegistration) -> None:
        """Register a tool"""
        key = f"{registration.language}:{registration.id}"
        cls._tools[key] = registration
    
    @classmethod
    def get(cls, id: str, language: Language) -> Optional[ToolRegistration]:
        """Get a tool by ID and language"""
        return cls._tools.get(f"{language}:{id}")
    
    @classmethod
    def get_all(cls) -> List[ToolRegistration]:
        """Get all registered tools"""
        return list(cls._tools.values())
    
    @classmethod
    def get_by_language(cls, language: Language) -> List[ToolRegistration]:
        """Get tools by language"""
        return [tool for tool in cls._tools.values() if tool.language == language]
    
    @classmethod
    def clear(cls) -> None:
        """Clear all registrations"""
        cls._tools.clear()
    
    @classmethod
    def register_python_tool(cls, tool_module: Any) -> None:
        """Register a Python tool from a module"""
        if not hasattr(tool_module, 'tool_info') or not hasattr(tool_module, 'tool_function'):
            raise ValueError(f"Module {tool_module.__name__} does not have required functions")
        
        tool_info = tool_module.tool_info()
        
        # Create async wrapper if needed
        if inspect.iscoroutinefunction(tool_module.tool_function):
            handler = cls._create_async_handler(tool_module.tool_function)
        else:
            handler = cls._create_sync_handler(tool_module.tool_function)
        
        registration = ToolRegistration(
            id=tool_info['name'],
            description=tool_info['description'],
            language='python',
            schema=tool_info['input_schema'],
            handler=handler
        )
        
        cls.register(registration)
    
    @classmethod
    def register_typescript_tool(cls, tool_info: Dict[str, Any], handler: ToolHandler) -> None:
        """Register a TypeScript tool adapter"""
        registration = ToolRegistration(
            id=tool_info['id'],
            description=tool_info['description'],
            language='typescript',
            schema=tool_info['schema'],
            handler=handler
        )
        
        cls.register(registration)
    
    @classmethod
    def load_python_module(cls, module_path: str) -> None:
        """Load and register tools from a Python module"""
        try:
            if module_path.endswith('.py'):
                # Load from file path
                spec = importlib.util.spec_from_file_location("tool_module", module_path)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
            else:
                # Load from module name
                module = importlib.import_module(module_path)
            
            cls.register_python_tool(module)
        except Exception as e:
            raise ValueError(f"Failed to load module {module_path}: {e}")
    
    @classmethod
    def load_tools_directory(cls, directory: str) -> int:
        """Load all tools from a directory"""
        tools_dir = Path(directory)
        if not tools_dir.exists():
            raise ValueError(f"Directory {directory} does not exist")
        
        count = 0
        for tool_file in tools_dir.glob("*.py"):
            if tool_file.stem == "__init__":
                continue
            
            try:
                cls.load_python_module(str(tool_file))
                count += 1
            except Exception as e:
                print(f"Failed to load {tool_file}: {e}")
        
        return count
    
    @classmethod
    def validate_parameters(cls, id: str, language: Language, params: Any) -> tuple[bool, List[str]]:
        """Validate parameters against tool schema"""
        tool = cls.get(id, language)
        if not tool:
            return False, [f"Tool {id} not found for {language}"]
        
        return SchemaTranslator.validate_json_schema(tool.schema, params)
    
    @classmethod
    def list_tools(cls) -> List[Dict[str, Any]]:
        """List all available tools with metadata"""
        return [{
            'id': tool.id,
            'language': tool.language,
            'description': tool.description,
            'schema': SchemaTranslator.simplify_schema(tool.schema)
        } for tool in cls._tools.values()]
    
    @staticmethod
    def _create_async_handler(func: Callable) -> ToolHandler:
        """Create an async handler from an async function"""
        async def handler(params: Any, context: ToolContext) -> ToolResult:
            # Extract parameters based on function signature
            sig = inspect.signature(func)
            if len(sig.parameters) == 1:
                # Single parameter - pass the whole params dict or single value
                param_name = list(sig.parameters.keys())[0]
                if isinstance(params, dict) and param_name in params:
                    result = await func(params[param_name])
                else:
                    result = await func(params)
            else:
                # Multiple parameters - unpack from params dict
                result = await func(**params)
            
            # Convert string result to ToolResult
            if isinstance(result, str):
                return ToolResult(
                    output=result,
                    metadata={'title': 'Tool Output'}
                )
            elif isinstance(result, dict):
                return ToolResult(
                    output=result.get('output', ''),
                    metadata=result.get('metadata', {'title': 'Tool Output'}),
                    diagnostics=result.get('diagnostics')
                )
            else:
                return ToolResult(
                    output=str(result),
                    metadata={'title': 'Tool Output'}
                )
        
        return handler
    
    @staticmethod
    def _create_sync_handler(func: Callable) -> ToolHandler:
        """Create an async handler from a sync function"""
        async def handler(params: Any, context: ToolContext) -> ToolResult:
            # Run sync function in executor
            loop = asyncio.get_event_loop()
            
            # Extract parameters based on function signature
            sig = inspect.signature(func)
            if len(sig.parameters) == 1:
                # Single parameter - pass the whole params dict or single value
                param_name = list(sig.parameters.keys())[0]
                if isinstance(params, dict) and param_name in params:
                    result = await loop.run_in_executor(None, func, params[param_name])
                else:
                    result = await loop.run_in_executor(None, func, params)
            else:
                # Multiple parameters - unpack from params dict
                result = await loop.run_in_executor(None, lambda: func(**params))
            
            # Convert string result to ToolResult
            if isinstance(result, str):
                return ToolResult(
                    output=result,
                    metadata={'title': 'Tool Output'}
                )
            elif isinstance(result, dict):
                return ToolResult(
                    output=result.get('output', ''),
                    metadata=result.get('metadata', {'title': 'Tool Output'}),
                    diagnostics=result.get('diagnostics')
                )
            else:
                return ToolResult(
                    output=str(result),
                    metadata={'title': 'Tool Output'}
                )
        
        return handler