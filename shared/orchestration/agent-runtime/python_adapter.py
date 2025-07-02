"""
Python Adapter for DGM Tools Integration
Bridges the orchestration layer with DGM tool implementations
"""

import asyncio
import json
import logging
import inspect
from typing import Dict, Any, Callable, Optional, List, Union
from pathlib import Path
import sys
import importlib.util

# Add DGM tools to path
dgm_path = Path(__file__).parent.parent.parent.parent / "dgm"
if str(dgm_path) not in sys.path:
    sys.path.insert(0, str(dgm_path))

logger = logging.getLogger(__name__)


class ToolRegistry:
    """Registry for DGM tools and their adapters"""
    
    def __init__(self):
        self.tools: Dict[str, Callable] = {}
        self.tool_metadata: Dict[str, Dict[str, Any]] = {}
        self._load_dgm_tools()
    
    def _load_dgm_tools(self):
        """Load DGM tools from the tools directory"""
        try:
            # Import DGM tools
            from tools.bash import BashTool
            from tools.edit_tool import EditTool
            
            # Register tools
            self.register_tool("bash", BashTool, {
                "description": "Execute bash commands",
                "parameters": {
                    "command": {"type": "string", "required": True},
                    "timeout": {"type": "integer", "default": 30}
                }
            })
            
            self.register_tool("edit", EditTool, {
                "description": "Edit files with precise replacements",
                "parameters": {
                    "file_path": {"type": "string", "required": True},
                    "old_string": {"type": "string", "required": True},
                    "new_string": {"type": "string", "required": True}
                }
            })
            
            logger.info(f"Loaded {len(self.tools)} DGM tools")
            
        except ImportError as e:
            logger.warning(f"Could not import DGM tools: {e}")
            # Fallback to mock tools for development
            self._register_mock_tools()
    
    def _register_mock_tools(self):
        """Register mock tools for development/testing"""
        
        async def mock_bash(command: str, timeout: int = 30) -> Dict[str, Any]:
            """Mock bash execution"""
            return {
                "success": True,
                "output": f"Mock execution of: {command}",
                "exit_code": 0
            }
        
        async def mock_edit(file_path: str, old_string: str, new_string: str) -> Dict[str, Any]:
            """Mock file editing"""
            return {
                "success": True,
                "message": f"Mock edit of {file_path}",
                "changes_made": 1
            }
        
        self.register_tool("bash", mock_bash, {
            "description": "Execute bash commands (MOCK)",
            "parameters": {
                "command": {"type": "string", "required": True},
                "timeout": {"type": "integer", "default": 30}
            }
        })
        
        self.register_tool("edit", mock_edit, {
            "description": "Edit files (MOCK)",
            "parameters": {
                "file_path": {"type": "string", "required": True},
                "old_string": {"type": "string", "required": True},
                "new_string": {"type": "string", "required": True}
            }
        })
    
    def register_tool(self, name: str, tool: Callable, metadata: Dict[str, Any]):
        """Register a tool with its metadata"""
        self.tools[name] = tool
        self.tool_metadata[name] = metadata
        logger.debug(f"Registered tool: {name}")
    
    def get_tool(self, name: str) -> Optional[Callable]:
        """Get a tool by name"""
        return self.tools.get(name)
    
    def list_tools(self) -> List[Dict[str, Any]]:
        """List all available tools with metadata"""
        return [
            {"name": name, **metadata}
            for name, metadata in self.tool_metadata.items()
        ]


class PythonAdapter:
    """Adapter for executing Python tools within the orchestration framework"""
    
    def __init__(self):
        self.registry = ToolRegistry()
        self.execution_context = {}
    
    async def execute_tool(self, tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool with given parameters"""
        try:
            tool = self.registry.get_tool(tool_name)
            if not tool:
                return {
                    "success": False,
                    "error": f"Tool '{tool_name}' not found",
                    "available_tools": [t["name"] for t in self.registry.list_tools()]
                }
            
            # Validate parameters
            metadata = self.registry.tool_metadata.get(tool_name, {})
            validation_result = self._validate_parameters(parameters, metadata.get("parameters", {}))
            if not validation_result["valid"]:
                return {
                    "success": False,
                    "error": f"Invalid parameters: {validation_result['errors']}"
                }
            
            # Execute tool
            logger.info(f"Executing tool: {tool_name} with parameters: {parameters}")
            
            # Check if tool is async
            if inspect.iscoroutinefunction(tool):
                result = await tool(**parameters)
            else:
                # Run sync tool in executor
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, lambda: tool(**parameters))
            
            # Ensure result is JSON serializable
            if isinstance(result, dict):
                return {"success": True, "result": result}
            else:
                return {"success": True, "result": str(result)}
            
        except Exception as e:
            logger.error(f"Error executing tool {tool_name}: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "error_type": type(e).__name__
            }
    
    def _validate_parameters(self, parameters: Dict[str, Any], schema: Dict[str, Any]) -> Dict[str, Any]:
        """Validate parameters against schema"""
        errors = []
        
        # Check required parameters
        for param_name, param_schema in schema.items():
            if param_schema.get("required", False) and param_name not in parameters:
                errors.append(f"Missing required parameter: {param_name}")
        
        # Check parameter types
        for param_name, param_value in parameters.items():
            if param_name in schema:
                expected_type = schema[param_name].get("type")
                if expected_type:
                    type_map = {
                        "string": str,
                        "integer": int,
                        "number": (int, float),
                        "boolean": bool,
                        "array": list,
                        "object": dict
                    }
                    expected_python_type = type_map.get(expected_type)
                    if expected_python_type and not isinstance(param_value, expected_python_type):
                        errors.append(
                            f"Parameter '{param_name}' should be of type {expected_type}, "
                            f"got {type(param_value).__name__}"
                        )
        
        return {"valid": len(errors) == 0, "errors": errors}
    
    async def batch_execute(self, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Execute multiple tools in parallel"""
        async def execute_task(task):
            tool_name = task.get("tool")
            parameters = task.get("parameters", {})
            task_id = task.get("id", "unknown")
            
            result = await self.execute_tool(tool_name, parameters)
            result["task_id"] = task_id
            return result
        
        # Execute all tasks concurrently
        results = await asyncio.gather(
            *[execute_task(task) for task in tasks],
            return_exceptions=True
        )
        
        # Handle exceptions
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({
                    "success": False,
                    "error": str(result),
                    "task_id": tasks[i].get("id", "unknown")
                })
            else:
                processed_results.append(result)
        
        return processed_results
    
    def get_available_tools(self) -> List[Dict[str, Any]]:
        """Get list of available tools with their metadata"""
        return self.registry.list_tools()
    
    def set_context(self, context: Dict[str, Any]):
        """Set execution context for tools"""
        self.execution_context = context
    
    def get_context(self) -> Dict[str, Any]:
        """Get current execution context"""
        return self.execution_context


# Singleton instance
adapter = PythonAdapter()


# Convenience functions
async def execute_tool(tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a single tool"""
    return await adapter.execute_tool(tool_name, parameters)


async def batch_execute(tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Execute multiple tools in parallel"""
    return await adapter.batch_execute(tasks)


def get_available_tools() -> List[Dict[str, Any]]:
    """Get list of available tools"""
    return adapter.get_available_tools()


if __name__ == "__main__":
    # Test the adapter
    async def test():
        print("Available tools:")
        for tool in get_available_tools():
            print(f"  - {tool['name']}: {tool['description']}")
        
        # Test bash execution
        result = await execute_tool("bash", {"command": "echo 'Hello from adapter'"})
        print(f"\nBash result: {result}")
        
        # Test batch execution
        tasks = [
            {"id": "1", "tool": "bash", "parameters": {"command": "pwd"}},
            {"id": "2", "tool": "bash", "parameters": {"command": "ls -la"}},
        ]
        results = await batch_execute(tasks)
        print(f"\nBatch results: {json.dumps(results, indent=2)}")
    
    asyncio.run(test())