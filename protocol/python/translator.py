from typing import Dict, Any, List, Union
import jsonschema

class SchemaTranslator:
    """Translates between different schema formats"""
    
    @staticmethod
    def validate_json_schema(schema: Dict[str, Any], data: Any) -> tuple[bool, List[str]]:
        """Validate data against JSON Schema"""
        try:
            jsonschema.validate(instance=data, schema=schema)
            return True, []
        except jsonschema.ValidationError as e:
            errors = [str(e)]
            # Collect all validation errors
            validator = jsonschema.Draft7Validator(schema)
            errors.extend(str(error) for error in validator.iter_errors(data))
            return False, errors
    
    @staticmethod
    def normalize_schema(schema: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize a JSON Schema to ensure consistency"""
        normalized = schema.copy()
        
        # Ensure type field is present for basic types
        if 'properties' in normalized and 'type' not in normalized:
            normalized['type'] = 'object'
        
        # Normalize array schemas
        if normalized.get('type') == 'array' and 'items' not in normalized:
            normalized['items'] = {}
        
        # Add $schema if not present
        if '$schema' not in normalized:
            normalized['$schema'] = 'http://json-schema.org/draft-07/schema#'
        
        return normalized
    
    @staticmethod
    def extract_required_fields(schema: Dict[str, Any]) -> List[str]:
        """Extract required field names from schema"""
        if schema.get('type') == 'object':
            return schema.get('required', [])
        return []
    
    @staticmethod
    def merge_schemas(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
        """Merge two JSON schemas"""
        result = base.copy()
        
        for key, value in override.items():
            if key == 'properties' and key in result:
                # Merge properties
                result[key] = {**result[key], **value}
            elif key == 'required' and key in result:
                # Merge required lists
                result[key] = list(set(result[key] + value))
            else:
                result[key] = value
        
        return result
    
    @staticmethod
    def simplify_schema(schema: Dict[str, Any]) -> Dict[str, Any]:
        """Simplify schema for display purposes"""
        if 'properties' in schema:
            simplified_props = {}
            for prop, prop_schema in schema['properties'].items():
                simplified_props[prop] = SchemaTranslator._simplify_type(prop_schema)
            
            return {
                'type': 'object',
                'properties': simplified_props,
                'required': schema.get('required', [])
            }
        
        return SchemaTranslator._simplify_type(schema)
    
    @staticmethod
    def _simplify_type(schema: Dict[str, Any]) -> Dict[str, Any]:
        """Simplify a single type schema"""
        if 'type' in schema:
            result = {'type': schema['type']}
            if 'description' in schema:
                result['description'] = schema['description']
            if schema['type'] == 'array' and 'items' in schema:
                result['items'] = SchemaTranslator._simplify_type(schema['items'])
            return result
        
        if 'anyOf' in schema:
            return {'anyOf': [SchemaTranslator._simplify_type(s) for s in schema['anyOf']]}
        
        if 'oneOf' in schema:
            return {'oneOf': [SchemaTranslator._simplify_type(s) for s in schema['oneOf']]}
        
        if 'allOf' in schema:
            return {'allOf': [SchemaTranslator._simplify_type(s) for s in schema['allOf']]}
        
        if 'enum' in schema:
            return {'enum': schema['enum']}
        
        if 'const' in schema:
            return {'const': schema['const']}
        
        return {}
    
    @staticmethod
    def convert_to_openapi(schema: Dict[str, Any]) -> Dict[str, Any]:
        """Convert JSON Schema to OpenAPI 3.0 schema format"""
        openapi_schema = schema.copy()
        
        # Remove JSON Schema specific fields
        fields_to_remove = ['$schema', '$id', '$ref', 'definitions']
        for field in fields_to_remove:
            openapi_schema.pop(field, None)
        
        # Convert type arrays to oneOf
        if isinstance(openapi_schema.get('type'), list):
            types = openapi_schema.pop('type')
            openapi_schema['oneOf'] = [{'type': t} for t in types]
        
        # Recursively convert nested schemas
        if 'properties' in openapi_schema:
            for prop, prop_schema in openapi_schema['properties'].items():
                openapi_schema['properties'][prop] = SchemaTranslator.convert_to_openapi(prop_schema)
        
        if 'items' in openapi_schema:
            openapi_schema['items'] = SchemaTranslator.convert_to_openapi(openapi_schema['items'])
        
        return openapi_schema