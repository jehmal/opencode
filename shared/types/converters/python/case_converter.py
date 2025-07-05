"""Case Conversion Utilities for Python/TypeScript Interoperability"""

import re
from typing import Any, Dict, List, Union

def camel_to_snake(name: str) -> str:
    """Convert camelCase to snake_case"""
    # Insert underscore before capital letters
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    # Insert underscore before capital letter followed by lowercase
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()

def snake_to_camel(name: str) -> str:
    """Convert snake_case to camelCase"""
    components = name.split('_')
    # Keep the first component as is, capitalize the rest
    return components[0] + ''.join(x.capitalize() for x in components[1:])

def pascal_to_snake(name: str) -> str:
    """Convert PascalCase to snake_case"""
    return camel_to_snake(name)

def snake_to_pascal(name: str) -> str:
    """Convert snake_case to PascalCase"""
    return ''.join(x.capitalize() for x in name.split('_'))

def keys_to_snake_case(obj: Any) -> Any:
    """Convert object keys from camelCase to snake_case"""
    if obj is None:
        return obj
    
    if isinstance(obj, (str, int, float, bool)):
        return obj
    
    if isinstance(obj, list):
        return [keys_to_snake_case(item) for item in obj]
    
    if isinstance(obj, dict):
        converted = {}
        for key, value in obj.items():
            if isinstance(key, str):
                snake_key = camel_to_snake(key)
                converted[snake_key] = keys_to_snake_case(value)
            else:
                converted[key] = keys_to_snake_case(value)
        return converted
    
    # Handle objects with __dict__
    if hasattr(obj, '__dict__'):
        return keys_to_snake_case(obj.__dict__)
    
    return obj

def keys_to_camel_case(obj: Any) -> Any:
    """Convert object keys from snake_case to camelCase"""
    if obj is None:
        return obj
    
    if isinstance(obj, (str, int, float, bool)):
        return obj
    
    if isinstance(obj, list):
        return [keys_to_camel_case(item) for item in obj]
    
    if isinstance(obj, dict):
        converted = {}
        for key, value in obj.items():
            if isinstance(key, str):
                camel_key = snake_to_camel(key)
                converted[camel_key] = keys_to_camel_case(value)
            else:
                converted[key] = keys_to_camel_case(value)
        return converted
    
    # Handle objects with __dict__
    if hasattr(obj, '__dict__'):
        return keys_to_camel_case(obj.__dict__)
    
    return obj

class CaseConverter:
    """Batch conversion utilities"""
    
    @staticmethod
    def to_snake_case(data: Any) -> Any:
        """Convert all keys to snake_case"""
        return keys_to_snake_case(data)
    
    @staticmethod
    def to_camel_case(data: Any) -> Any:
        """Convert all keys to camelCase"""
        return keys_to_camel_case(data)
    
    @staticmethod
    def from_typescript_to_python(data: Any) -> Any:
        """Convert TypeScript data format to Python format"""
        return keys_to_snake_case(data)
    
    @staticmethod
    def from_python_to_typescript(data: Any) -> Any:
        """Convert Python data format to TypeScript format"""
        return keys_to_camel_case(data)

class CaseProxy:
    """Proxy object that automatically converts property access"""
    
    def __init__(self, obj: Any, from_case: str = 'snake', to_case: str = 'camel'):
        self._obj = obj
        self._from_case = from_case
        self._to_case = to_case
        
        if from_case == 'camel' and to_case == 'snake':
            self._converter = camel_to_snake
        elif from_case == 'snake' and to_case == 'camel':
            self._converter = snake_to_camel
        else:
            self._converter = lambda x: x
    
    def __getattr__(self, name: str) -> Any:
        converted_name = self._converter(name)
        
        # Try converted name first
        if hasattr(self._obj, converted_name):
            return getattr(self._obj, converted_name)
        
        # Try original name
        if hasattr(self._obj, name):
            return getattr(self._obj, name)
        
        # Try dictionary access
        if isinstance(self._obj, dict):
            if converted_name in self._obj:
                return self._obj[converted_name]
            if name in self._obj:
                return self._obj[name]
        
        raise AttributeError(f"'{type(self._obj).__name__}' object has no attribute '{name}'")
    
    def __setattr__(self, name: str, value: Any) -> None:
        if name.startswith('_'):
            super().__setattr__(name, value)
            return
        
        converted_name = self._converter(name)
        
        if hasattr(self._obj, '__dict__'):
            setattr(self._obj, converted_name, value)
        elif isinstance(self._obj, dict):
            self._obj[converted_name] = value
        else:
            raise AttributeError(f"Cannot set attribute '{name}'")
    
    def __getitem__(self, key: str) -> Any:
        if isinstance(self._obj, dict):
            converted_key = self._converter(key) if isinstance(key, str) else key
            if converted_key in self._obj:
                return self._obj[converted_key]
            if key in self._obj:
                return self._obj[key]
        raise KeyError(key)
    
    def __setitem__(self, key: str, value: Any) -> None:
        if isinstance(self._obj, dict):
            converted_key = self._converter(key) if isinstance(key, str) else key
            self._obj[converted_key] = value
        else:
            raise TypeError(f"'{type(self._obj).__name__}' object does not support item assignment")

# Utility functions for field mapping
def create_field_mapping(from_fields: List[str], to_case: str = 'camel') -> Dict[str, str]:
    """Create a field name mapping dictionary"""
    mapping = {}
    for field in from_fields:
        if to_case == 'camel':
            mapping[field] = snake_to_camel(field)
        elif to_case == 'snake':
            mapping[field] = camel_to_snake(field)
        elif to_case == 'pascal':
            mapping[field] = snake_to_pascal(field)
        else:
            mapping[field] = field
    return mapping

def convert_with_mapping(data: Dict[str, Any], mapping: Dict[str, str]) -> Dict[str, Any]:
    """Convert dictionary keys using a mapping"""
    converted = {}
    for old_key, new_key in mapping.items():
        if old_key in data:
            converted[new_key] = data[old_key]
    
    # Include unmapped keys as-is
    for key, value in data.items():
        if key not in mapping and key not in converted:
            converted[key] = value
    
    return converted