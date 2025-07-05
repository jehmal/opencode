"""JSON Serialization/Deserialization Utilities"""

import json
import base64
from datetime import datetime, date
from typing import Any, Dict, List, Set, Optional, Type, TypeVar
from decimal import Decimal
import re

T = TypeVar('T')

class CustomJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder for special Python types"""
    
    def default(self, obj: Any) -> Any:
        # Handle datetime/date
        if isinstance(obj, (datetime, date)):
            return {"__type": "datetime", "value": obj.isoformat()}
        
        # Handle bytes
        if isinstance(obj, bytes):
            return {"__type": "bytes", "value": base64.b64encode(obj).decode('utf-8')}
        
        # Handle set
        if isinstance(obj, set):
            return {"__type": "set", "value": list(obj)}
        
        # Handle Decimal
        if isinstance(obj, Decimal):
            return {"__type": "decimal", "value": str(obj)}
        
        # Handle complex numbers
        if isinstance(obj, complex):
            return {"__type": "complex", "real": obj.real, "imag": obj.imag}
        
        # Handle regex patterns
        if isinstance(obj, re.Pattern):
            return {"__type": "regex", "pattern": obj.pattern, "flags": obj.flags}
        
        # Let the base class handle it
        return super().default(obj)

class CustomJSONDecoder(json.JSONDecoder):
    """Custom JSON decoder for special types"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(object_hook=self.object_hook, *args, **kwargs)
    
    def object_hook(self, obj: Dict[str, Any]) -> Any:
        if "__type" not in obj:
            return obj
        
        type_name = obj["__type"]
        
        if type_name == "datetime":
            return datetime.fromisoformat(obj["value"])
        
        elif type_name == "bytes":
            return base64.b64decode(obj["value"])
        
        elif type_name == "set":
            return set(obj["value"])
        
        elif type_name == "decimal":
            return Decimal(obj["value"])
        
        elif type_name == "complex":
            return complex(obj["real"], obj["imag"])
        
        elif type_name == "regex":
            return re.compile(obj["pattern"], obj["flags"])
        
        return obj

def safe_dumps(obj: Any, indent: Optional[int] = None) -> str:
    """Safely serialize object to JSON string"""
    try:
        return json.dumps(obj, cls=CustomJSONEncoder, indent=indent)
    except Exception as e:
        # Handle circular references
        seen = set()
        
        def remove_circular(o):
            if id(o) in seen:
                return "[Circular]"
            
            if isinstance(o, (dict, list, set, tuple)):
                seen.add(id(o))
            
            if isinstance(o, dict):
                return {k: remove_circular(v) for k, v in o.items()}
            elif isinstance(o, (list, tuple)):
                return [remove_circular(item) for item in o]
            elif isinstance(o, set):
                return list(remove_circular(item) for item in o)
            else:
                return o
        
        cleaned = remove_circular(obj)
        return json.dumps(cleaned, cls=CustomJSONEncoder, indent=indent)

def safe_loads(json_str: str) -> Any:
    """Safely deserialize JSON string to object"""
    try:
        return json.loads(json_str, cls=CustomJSONDecoder)
    except Exception as e:
        print(f"JSON parse error: {e}")
        return None

class JsonSerializer:
    """Type-safe JSON serialization"""
    
    def __init__(self, type_class: Optional[Type[T]] = None):
        self.type_class = type_class
    
    def serialize(self, data: T) -> str:
        """Serialize data to JSON string"""
        if hasattr(data, 'dict'):  # Pydantic model
            return safe_dumps(data.dict())
        elif hasattr(data, '__dict__'):
            return safe_dumps(data.__dict__)
        else:
            return safe_dumps(data)
    
    def deserialize(self, json_str: str) -> Optional[T]:
        """Deserialize JSON string to typed object"""
        data = safe_loads(json_str)
        if data is None:
            return None
        
        if self.type_class is None:
            return data
        
        # Try to instantiate the type
        try:
            if hasattr(self.type_class, 'parse_obj'):  # Pydantic model
                return self.type_class.parse_obj(data)
            elif hasattr(self.type_class, '__init__'):
                return self.type_class(**data) if isinstance(data, dict) else self.type_class(data)
            else:
                return data
        except Exception as e:
            print(f"Failed to deserialize to {self.type_class}: {e}")
            return None

class BinarySerializer:
    """Binary serialization utilities"""
    
    @staticmethod
    def encode(data: Any) -> bytes:
        """Encode data to binary"""
        json_str = safe_dumps(data)
        return json_str.encode('utf-8')
    
    @staticmethod
    def decode(data: bytes) -> Any:
        """Decode binary to data"""
        json_str = data.decode('utf-8')
        return safe_loads(json_str)
    
    @staticmethod
    def encode_base64(data: Any) -> str:
        """Encode data to base64 string"""
        binary = BinarySerializer.encode(data)
        return base64.b64encode(binary).decode('utf-8')
    
    @staticmethod
    def decode_base64(base64_str: str) -> Any:
        """Decode base64 string to data"""
        binary = base64.b64decode(base64_str)
        return BinarySerializer.decode(binary)

# Utility functions
def to_json_compatible(obj: Any) -> Any:
    """Convert Python object to JSON-compatible format"""
    if obj is None or isinstance(obj, (str, int, float, bool)):
        return obj
    
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    
    if isinstance(obj, bytes):
        return base64.b64encode(obj).decode('utf-8')
    
    if isinstance(obj, set):
        return list(obj)
    
    if isinstance(obj, Decimal):
        return float(obj)
    
    if isinstance(obj, dict):
        return {k: to_json_compatible(v) for k, v in obj.items()}
    
    if isinstance(obj, (list, tuple)):
        return [to_json_compatible(item) for item in obj]
    
    if hasattr(obj, 'dict'):  # Pydantic model
        return to_json_compatible(obj.dict())
    
    if hasattr(obj, '__dict__'):
        return to_json_compatible(obj.__dict__)
    
    return str(obj)

def from_json_compatible(data: Any, target_type: Optional[Type] = None) -> Any:
    """Convert JSON-compatible data to Python object"""
    if target_type is None:
        return data
    
    # Handle basic types
    if target_type in (str, int, float, bool, type(None)):
        return target_type(data) if data is not None else None
    
    # Handle datetime
    if target_type == datetime and isinstance(data, str):
        return datetime.fromisoformat(data)
    
    # Handle bytes
    if target_type == bytes and isinstance(data, str):
        return base64.b64decode(data)
    
    # Handle set
    if target_type == set and isinstance(data, list):
        return set(data)
    
    # Handle Decimal
    if target_type == Decimal and isinstance(data, (str, float, int)):
        return Decimal(str(data))
    
    # Handle Pydantic models
    if hasattr(target_type, 'parse_obj'):
        return target_type.parse_obj(data)
    
    return data