"""
Test suite for the cross-language tool protocol
"""
import asyncio
import pytest
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from protocol.python import (
    ToolProtocol, 
    ToolRegistry, 
    SchemaTranslator,
    ToolContext,
    ToolResult
)

# Test tool implementations
async def test_tool_async(message: str, context: ToolContext) -> ToolResult:
    """Async test tool"""
    return ToolResult(
        output=f"Async: {message}",
        metadata={'title': 'Async Test', 'processed': True}
    )

def test_tool_sync(message: str) -> str:
    """Sync test tool"""
    return f"Sync: {message}"

class TestProtocol:
    """Test the protocol layer"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up test environment"""
        ToolRegistry.clear()
        yield
        ToolRegistry.clear()
    
    def test_schema_translation(self):
        """Test JSON Schema validation"""
        schema = {
            'type': 'object',
            'properties': {
                'message': {'type': 'string'},
                'count': {'type': 'integer', 'minimum': 0}
            },
            'required': ['message']
        }
        
        # Valid data
        valid, errors = SchemaTranslator.validate_json_schema(
            schema, 
            {'message': 'hello', 'count': 5}
        )
        assert valid
        assert errors == []
        
        # Invalid data - missing required field
        valid, errors = SchemaTranslator.validate_json_schema(
            schema,
            {'count': 5}
        )
        assert not valid
        assert len(errors) > 0
        
        # Invalid data - wrong type
        valid, errors = SchemaTranslator.validate_json_schema(
            schema,
            {'message': 'hello', 'count': 'not a number'}
        )
        assert not valid
        assert len(errors) > 0
    
    def test_registry(self):
        """Test tool registry"""
        # Create a mock module
        class MockModule:
            @staticmethod
            def tool_info():
                return {
                    'name': 'test',
                    'description': 'Test tool',
                    'input_schema': {
                        'type': 'object',
                        'properties': {
                            'message': {'type': 'string'}
                        },
                        'required': ['message']
                    }
                }
            
            @staticmethod
            def tool_function(message):
                return f"Test: {message}"
        
        # Register the tool
        ToolRegistry.register_python_tool(MockModule)
        
        # Check registration
        tool = ToolRegistry.get('test', 'python')
        assert tool is not None
        assert tool.id == 'test'
        assert tool.language == 'python'
        
        # List tools
        tools = ToolRegistry.list_tools()
        assert len(tools) == 1
        assert tools[0]['id'] == 'test'
    
    @pytest.mark.asyncio
    async def test_python_tool_execution(self):
        """Test executing Python tools"""
        # Register async tool
        class AsyncTool:
            @staticmethod
            def tool_info():
                return {
                    'name': 'async_test',
                    'description': 'Async test tool',
                    'input_schema': {
                        'type': 'object',
                        'properties': {
                            'message': {'type': 'string'}
                        },
                        'required': ['message']
                    }
                }
            
            @staticmethod
            async def tool_function(message):
                await asyncio.sleep(0.1)
                return f"Async result: {message}"
        
        ToolRegistry.register_python_tool(AsyncTool)
        
        # Execute tool
        result = await ToolProtocol.execute_tool(
            'async_test',
            {'message': 'Hello async'},
            language='python'
        )
        
        assert result.output == "Async result: Hello async"
        assert result.metadata['title'] == 'Tool Output'
    
    @pytest.mark.asyncio
    async def test_sync_tool_execution(self):
        """Test executing sync Python tools"""
        # Register sync tool
        class SyncTool:
            @staticmethod
            def tool_info():
                return {
                    'name': 'sync_test',
                    'description': 'Sync test tool',
                    'input_schema': {
                        'type': 'object',
                        'properties': {
                            'message': {'type': 'string'}
                        },
                        'required': ['message']
                    }
                }
            
            @staticmethod
            def tool_function(message):
                return f"Sync result: {message}"
        
        ToolRegistry.register_python_tool(SyncTool)
        
        # Execute tool
        result = await ToolProtocol.execute_tool(
            'sync_test',
            {'message': 'Hello sync'},
            language='python'
        )
        
        assert result.output == "Sync result: Hello sync"
    
    @pytest.mark.asyncio
    async def test_parameter_validation(self):
        """Test parameter validation"""
        # Register tool with strict schema
        class StrictTool:
            @staticmethod
            def tool_info():
                return {
                    'name': 'strict',
                    'description': 'Tool with strict schema',
                    'input_schema': {
                        'type': 'object',
                        'properties': {
                            'name': {'type': 'string', 'minLength': 1},
                            'age': {'type': 'integer', 'minimum': 0, 'maximum': 150}
                        },
                        'required': ['name', 'age'],
                        'additionalProperties': False
                    }
                }
            
            @staticmethod
            def tool_function(name, age):
                return f"{name} is {age} years old"
        
        ToolRegistry.register_python_tool(StrictTool)
        
        # Valid parameters
        result = await ToolProtocol.execute_tool(
            'strict',
            {'name': 'Alice', 'age': 30}
        )
        assert 'Alice is 30 years old' in result.output
        
        # Invalid parameters - missing field
        with pytest.raises(ValueError, match='Invalid parameters'):
            await ToolProtocol.execute_tool(
                'strict',
                {'name': 'Bob'}
            )
        
        # Invalid parameters - wrong type
        with pytest.raises(ValueError, match='Invalid parameters'):
            await ToolProtocol.execute_tool(
                'strict',
                {'name': 'Charlie', 'age': 'thirty'}
            )
    
    @pytest.mark.asyncio
    async def test_timeout_handling(self):
        """Test timeout handling"""
        # Register slow tool
        class SlowTool:
            @staticmethod
            def tool_info():
                return {
                    'name': 'slow',
                    'description': 'Slow tool for timeout testing',
                    'input_schema': {'type': 'object', 'properties': {}}
                }
            
            @staticmethod
            async def tool_function():
                await asyncio.sleep(2.0)
                return "Should timeout"
        
        ToolRegistry.register_python_tool(SlowTool)
        
        # Execute with short timeout
        with pytest.raises(TimeoutError):
            await ToolProtocol.execute_tool(
                'slow',
                {},
                timeout=0.5
            )
    
    @pytest.mark.asyncio
    async def test_error_propagation(self):
        """Test error propagation"""
        # Register failing tool
        class FailingTool:
            @staticmethod
            def tool_info():
                return {
                    'name': 'fail',
                    'description': 'Tool that fails',
                    'input_schema': {'type': 'object', 'properties': {}}
                }
            
            @staticmethod
            def tool_function():
                raise RuntimeError("Intentional failure")
        
        ToolRegistry.register_python_tool(FailingTool)
        
        # Execute and expect error
        with pytest.raises(RuntimeError, match="Intentional failure"):
            await ToolProtocol.execute_tool('fail', {})
    
    def test_schema_normalization(self):
        """Test schema normalization"""
        # Basic schema
        schema = {'properties': {'name': {'type': 'string'}}}
        normalized = SchemaTranslator.normalize_schema(schema)
        assert normalized['type'] == 'object'
        assert '$schema' in normalized
        
        # Array without items
        schema = {'type': 'array'}
        normalized = SchemaTranslator.normalize_schema(schema)
        assert 'items' in normalized
    
    def test_schema_simplification(self):
        """Test schema simplification"""
        complex_schema = {
            'type': 'object',
            'properties': {
                'name': {
                    'type': 'string',
                    'minLength': 1,
                    'maxLength': 100,
                    'pattern': '^[A-Za-z]+$'
                },
                'tags': {
                    'type': 'array',
                    'items': {'type': 'string'}
                }
            },
            'required': ['name'],
            'additionalProperties': False
        }
        
        simplified = SchemaTranslator.simplify_schema(complex_schema)
        assert simplified['properties']['name']['type'] == 'string'
        assert 'minLength' not in simplified['properties']['name']
        assert simplified['properties']['tags']['type'] == 'array'

if __name__ == '__main__':
    pytest.main([__file__, '-v'])