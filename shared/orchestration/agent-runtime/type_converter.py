"""
Type Converter for cross-language compatibility
Handles conversion between TypeScript/JavaScript and Python types
"""

import json
import base64
import datetime
import logging
from typing import Any, Dict, List, Union, Optional
from decimal import Decimal
from pathlib import Path
from enum import Enum

logger = logging.getLogger(__name__)


class ConversionError(Exception):
    """Raised when type conversion fails"""
    pass


class TypeConverter:
    """Converts between TypeScript/JavaScript and Python types"""
    
    @staticmethod
    def from_js_to_python(data: Any) -> Any:
        """Convert JavaScript/TypeScript data to Python types"""
        if data is None or data == "null":
            return None
        
        # Handle undefined
        if data == "undefined":
            return None
        
        # Handle primitives
        if isinstance(data, (str, int, float, bool)):
            return data
        
        # Handle arrays
        if isinstance(data, list):
            return [TypeConverter.from_js_to_python(item) for item in data]
        
        # Handle objects
        if isinstance(data, dict):
            # Check for special type hints
            if "__type" in data:
                return TypeConverter._handle_special_type(data)
            
            # Regular object conversion
            return {
                key: TypeConverter.from_js_to_python(value)
                for key, value in data.items()
            }
        
        # Handle Buffer/Uint8Array as base64
        if isinstance(data, str) and data.startswith("data:"):
            # Data URL format
            try:
                _, encoded = data.split(",", 1)
                return base64.b64decode(encoded)
            except Exception as e:
                logger.warning(f"Failed to decode data URL: {e}")
                return data
        
        return data
    
    @staticmethod
    def from_python_to_js(data: Any) -> Any:
        """Convert Python data to JavaScript/TypeScript compatible types"""
        if data is None:
            return None
        
        # Handle primitives
        if isinstance(data, (str, int, float, bool)):
            return data
        
        # Handle bytes
        if isinstance(data, bytes):
            return {
                "__type": "Buffer",
                "data": base64.b64encode(data).decode('utf-8')
            }
        
        # Handle datetime
        if isinstance(data, datetime.datetime):
            return {
                "__type": "Date",
                "value": data.isoformat()
            }
        
        # Handle Path
        if isinstance(data, Path):
            return str(data)
        
        # Handle Decimal
        if isinstance(data, Decimal):
            return float(data)
        
        # Handle Enum
        if isinstance(data, Enum):
            return data.value
        
        # Handle lists
        if isinstance(data, (list, tuple)):
            return [TypeConverter.from_python_to_js(item) for item in data]
        
        # Handle dicts
        if isinstance(data, dict):
            return {
                key: TypeConverter.from_python_to_js(value)
                for key, value in data.items()
            }
        
        # Handle sets
        if isinstance(data, set):
            return {
                "__type": "Set",
                "values": [TypeConverter.from_python_to_js(item) for item in data]
            }
        
        # Handle custom objects with __dict__
        if hasattr(data, '__dict__'):
            return {
                "__type": type(data).__name__,
                "data": TypeConverter.from_python_to_js(data.__dict__)
            }
        
        # Fallback to string representation
        try:
            return str(data)
        except Exception:
            return f"<{type(data).__name__} object>"
    
    @staticmethod
    def _handle_special_type(data: Dict[str, Any]) -> Any:
        """Handle special type conversions"""
        type_name = data.get("__type")
        
        if type_name == "Date":
            try:
                return datetime.datetime.fromisoformat(data["value"])
            except Exception as e:
                logger.warning(f"Failed to parse date: {e}")
                return data["value"]
        
        elif type_name == "Buffer":
            try:
                return base64.b64decode(data["data"])
            except Exception as e:
                logger.warning(f"Failed to decode buffer: {e}")
                return data["data"]
        
        elif type_name == "Set":
            return set(TypeConverter.from_js_to_python(data["values"]))
        
        elif type_name == "Map":
            entries = data.get("entries", [])
            return {
                TypeConverter.from_js_to_python(k): TypeConverter.from_js_to_python(v)
                for k, v in entries
            }
        
        else:
            # Unknown special type, return as-is
            return data
    
    @staticmethod
    def validate_schema(data: Any, schema: Dict[str, Any]) -> bool:
        """Validate data against a schema"""
        schema_type = schema.get("type")
        
        if schema_type == "string":
            return isinstance(data, str)
        
        elif schema_type == "number":
            return isinstance(data, (int, float))
        
        elif schema_type == "integer":
            return isinstance(data, int)
        
        elif schema_type == "boolean":
            return isinstance(data, bool)
        
        elif schema_type == "array":
            if not isinstance(data, list):
                return False
            items_schema = schema.get("items")
            if items_schema:
                return all(TypeConverter.validate_schema(item, items_schema) for item in data)
            return True
        
        elif schema_type == "object":
            if not isinstance(data, dict):
                return False
            properties = schema.get("properties", {})
            required = schema.get("required", [])
            
            # Check required fields
            for req_field in required:
                if req_field not in data:
                    return False
            
            # Validate properties
            for key, value in data.items():
                if key in properties:
                    if not TypeConverter.validate_schema(value, properties[key]):
                        return False
            
            return True
        
        elif schema_type == "null":
            return data is None
        
        elif isinstance(schema_type, list):
            # Union type
            return any(TypeConverter.validate_schema(data, {"type": t}) for t in schema_type)
        
        return True


class MessageConverter:
    """Converts messages between orchestrator and agent formats"""
    
    @staticmethod
    def to_agent_format(message: Dict[str, Any]) -> Dict[str, Any]:
        """Convert orchestrator message to agent format"""
        return {
            "id": message.get("id"),
            "type": message.get("type"),
            "task": message.get("task"),
            "parameters": TypeConverter.from_js_to_python(message.get("parameters", {})),
            "context": message.get("context", {}),
            "metadata": {
                "priority": message.get("priority", 5),
                "timeout": message.get("timeout", 300),
                "retry_count": message.get("retryCount", 0),
                "timestamp": datetime.datetime.now().isoformat()
            }
        }
    
    @staticmethod
    def from_agent_format(message: Dict[str, Any]) -> Dict[str, Any]:
        """Convert agent message to orchestrator format"""
        return {
            "id": message.get("id"),
            "type": message.get("type"),
            "status": message.get("status"),
            "result": TypeConverter.from_python_to_js(message.get("result")),
            "error": message.get("error"),
            "executionTime": message.get("execution_time"),
            "metadata": {
                "agentId": message.get("agent_id"),
                "timestamp": message.get("timestamp", datetime.datetime.now().isoformat()),
                "resources": message.get("resources", {})
            }
        }


class ParameterConverter:
    """Converts tool parameters between formats"""
    
    @staticmethod
    def convert_bash_params(params: Dict[str, Any]) -> Dict[str, Any]:
        """Convert bash tool parameters"""
        return {
            "command": str(params.get("command", "")),
            "timeout": int(params.get("timeout", 30)),
            "working_directory": params.get("workingDirectory", params.get("working_directory")),
            "environment": params.get("environment", {})
        }
    
    @staticmethod
    def convert_edit_params(params: Dict[str, Any]) -> Dict[str, Any]:
        """Convert edit tool parameters"""
        return {
            "file_path": str(params.get("filePath", params.get("file_path", ""))),
            "old_string": str(params.get("oldString", params.get("old_string", ""))),
            "new_string": str(params.get("newString", params.get("new_string", "")))
        }
    
    @staticmethod
    def convert_generic_params(tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Convert parameters based on tool name"""
        converters = {
            "bash": ParameterConverter.convert_bash_params,
            "edit": ParameterConverter.convert_edit_params,
        }
        
        converter = converters.get(tool_name)
        if converter:
            return converter(params)
        
        # Default conversion - handle camelCase to snake_case
        converted = {}
        for key, value in params.items():
            # Convert camelCase to snake_case
            snake_key = TypeConverter._camel_to_snake(key)
            converted[snake_key] = TypeConverter.from_js_to_python(value)
        
        return converted
    
    @staticmethod
    def _camel_to_snake(name: str) -> str:
        """Convert camelCase to snake_case"""
        result = []
        for i, char in enumerate(name):
            if char.isupper() and i > 0:
                result.append('_')
            result.append(char.lower())
        return ''.join(result)


# Convenience functions
def js_to_python(data: Any) -> Any:
    """Convert JavaScript data to Python"""
    return TypeConverter.from_js_to_python(data)


def python_to_js(data: Any) -> Any:
    """Convert Python data to JavaScript"""
    return TypeConverter.from_python_to_js(data)


def validate_params(data: Any, schema: Dict[str, Any]) -> bool:
    """Validate parameters against schema"""
    return TypeConverter.validate_schema(data, schema)


def convert_message_to_agent(message: Dict[str, Any]) -> Dict[str, Any]:
    """Convert orchestrator message to agent format"""
    return MessageConverter.to_agent_format(message)


def convert_message_from_agent(message: Dict[str, Any]) -> Dict[str, Any]:
    """Convert agent message to orchestrator format"""
    return MessageConverter.from_agent_format(message)


def convert_tool_params(tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """Convert tool parameters to correct format"""
    return ParameterConverter.convert_generic_params(tool_name, params)


if __name__ == "__main__":
    # Test conversions
    test_data = {
        "string": "hello",
        "number": 42,
        "boolean": True,
        "array": [1, 2, 3],
        "object": {"nested": "value"},
        "date": {"__type": "Date", "value": "2024-01-01T00:00:00"},
        "buffer": {"__type": "Buffer", "data": "aGVsbG8="}
    }
    
    print("JS to Python conversion:")
    python_data = js_to_python(test_data)
    print(json.dumps(python_data, indent=2, default=str))
    
    print("\nPython to JS conversion:")
    js_data = python_to_js(python_data)
    print(json.dumps(js_data, indent=2))
    
    print("\nParameter conversion (bash):")
    bash_params = convert_tool_params("bash", {
        "command": "ls -la",
        "timeout": 60,
        "workingDirectory": "/tmp"
    })
    print(json.dumps(bash_params, indent=2))