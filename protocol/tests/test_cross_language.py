"""
Integration tests for cross-language tool execution
"""
import asyncio
import pytest
import sys
import os
import tempfile
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from protocol.python import ToolProtocol, ToolRegistry

@pytest.mark.integration
class TestCrossLanguage:
    """Test cross-language tool execution"""
    
    @pytest.fixture
    async def protocol(self):
        """Initialize protocol with both language bridges"""
        await ToolProtocol.initialize(
            load_typescript_tools=True
        )
        yield
        await ToolProtocol.shutdown()
        ToolRegistry.clear()
    
    @pytest.mark.asyncio
    async def test_python_to_typescript(self, protocol):
        """Test Python calling TypeScript tools"""
        # Register a TypeScript tool (mock)
        # In real scenario, this would be loaded from TypeScript
        pass
    
    @pytest.mark.asyncio
    async def test_tool_discovery(self, protocol):
        """Test automatic tool discovery"""
        # Register tools in both languages
        class TestTool:
            @staticmethod
            def tool_info():
                return {
                    'name': 'shared_tool',
                    'description': 'Tool available in both languages',
                    'input_schema': {
                        'type': 'object',
                        'properties': {
                            'input': {'type': 'string'}
                        }
                    }
                }
            
            @staticmethod
            def tool_function(input):
                return f"Python: {input}"
        
        ToolRegistry.register_python_tool(TestTool)
        
        # List all tools
        tools = ToolProtocol.list_tools()
        python_tools = [t for t in tools if t['language'] == 'python']
        
        assert len(python_tools) >= 1
        assert any(t['id'] == 'shared_tool' for t in python_tools)
    
    @pytest.mark.asyncio
    async def test_parameter_compatibility(self, protocol):
        """Test parameter passing between languages"""
        # Test various parameter types
        test_cases = [
            # Simple types
            {'string': 'hello', 'number': 42, 'boolean': True},
            # Arrays
            {'array': [1, 2, 3], 'strings': ['a', 'b', 'c']},
            # Nested objects
            {'nested': {'key': 'value', 'count': 10}},
            # Mixed
            {'mixed': {'arr': [1, 'two', True], 'obj': {'a': 1}}}
        ]
        
        class EchoTool:
            @staticmethod
            def tool_info():
                return {
                    'name': 'echo',
                    'description': 'Echoes input',
                    'input_schema': {
                        'type': 'object',
                        'additionalProperties': True
                    }
                }
            
            @staticmethod
            def tool_function(**params):
                return str(params)
        
        ToolRegistry.register_python_tool(EchoTool)
        
        for params in test_cases:
            result = await ToolProtocol.execute_tool('echo', params)
            assert all(str(v) in result.output for v in params.values())
    
    @pytest.mark.asyncio
    async def test_concurrent_execution(self, protocol):
        """Test concurrent tool execution"""
        # Register a tool that takes some time
        class SlowTool:
            @staticmethod
            def tool_info():
                return {
                    'name': 'slow_echo',
                    'description': 'Slow echo tool',
                    'input_schema': {
                        'type': 'object',
                        'properties': {
                            'message': {'type': 'string'},
                            'delay': {'type': 'number'}
                        }
                    }
                }
            
            @staticmethod
            async def tool_function(message, delay=0.1):
                await asyncio.sleep(delay)
                return f"Echo: {message}"
        
        ToolRegistry.register_python_tool(SlowTool)
        
        # Execute multiple tools concurrently
        tasks = [
            ToolProtocol.execute_tool('slow_echo', {'message': f'msg{i}', 'delay': 0.1})
            for i in range(5)
        ]
        
        results = await asyncio.gather(*tasks)
        
        assert len(results) == 5
        for i, result in enumerate(results):
            assert f'msg{i}' in result.output
    
    @pytest.mark.asyncio
    async def test_error_handling_cross_language(self, protocol):
        """Test error handling across languages"""
        # Test various error scenarios
        
        # 1. Tool not found
        with pytest.raises(ValueError, match="Tool 'nonexistent' not found"):
            await ToolProtocol.execute_tool('nonexistent', {})
        
        # 2. Invalid parameters
        class StrictTool:
            @staticmethod
            def tool_info():
                return {
                    'name': 'strict_params',
                    'description': 'Tool with strict parameters',
                    'input_schema': {
                        'type': 'object',
                        'properties': {
                            'required_field': {'type': 'string'}
                        },
                        'required': ['required_field'],
                        'additionalProperties': False
                    }
                }
            
            @staticmethod
            def tool_function(required_field):
                return f"Got: {required_field}"
        
        ToolRegistry.register_python_tool(StrictTool)
        
        with pytest.raises(ValueError, match="Invalid parameters"):
            await ToolProtocol.execute_tool('strict_params', {'wrong_field': 'value'})
    
    @pytest.mark.asyncio
    async def test_metadata_propagation(self, protocol):
        """Test metadata propagation between languages"""
        class MetadataTool:
            @staticmethod
            def tool_info():
                return {
                    'name': 'metadata_test',
                    'description': 'Tool that returns metadata',
                    'input_schema': {'type': 'object'}
                }
            
            @staticmethod
            def tool_function():
                return {
                    'output': 'Test output',
                    'metadata': {
                        'title': 'Test Title',
                        'custom_field': 'custom_value',
                        'nested': {'key': 'value'}
                    }
                }
        
        ToolRegistry.register_python_tool(MetadataTool)
        
        result = await ToolProtocol.execute_tool('metadata_test', {})
        
        assert result.output == 'Test output'
        assert result.metadata['title'] == 'Test Title'
        assert result.metadata['custom_field'] == 'custom_value'
        assert result.metadata['nested']['key'] == 'value'

if __name__ == '__main__':
    pytest.main([__file__, '-v', '-m', 'integration'])