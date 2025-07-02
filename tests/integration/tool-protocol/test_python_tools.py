#!/usr/bin/env python3
"""
Python Integration Tests for Tool Protocol
Tests Python tool implementations and cross-language compatibility
"""

import asyncio
import json
import os
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List

import pytest
import aiohttp

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from shared.tools.client import ToolClient
from shared.protocols import TaskRequest, TaskResponse


class TestContext:
    """Test context for Python integration tests"""
    
    def __init__(self):
        self.temp_dir = tempfile.mkdtemp(prefix="dgm_test_")
        self.session_id = f"test_{int(time.time())}"
        self.python_port = 8001
        self.ts_port = 8002
        self.client = None
        
    async def setup(self):
        """Initialize test context"""
        self.client = ToolClient(f"http://localhost:{self.python_port}")
        await self.wait_for_servers()
        
    async def teardown(self):
        """Clean up test context"""
        if self.client:
            await self.client.close()
        # Clean up temp directory
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
        
    async def wait_for_servers(self, timeout=30):
        """Wait for both servers to be ready"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                async with aiohttp.ClientSession() as session:
                    # Check Python server
                    async with session.get(f"http://localhost:{self.python_port}/health") as resp:
                        if resp.status != 200:
                            raise Exception("Python server not ready")
                    
                    # Check TypeScript server
                    async with session.get(f"http://localhost:{self.ts_port}/health") as resp:
                        if resp.status != 200:
                            raise Exception("TypeScript server not ready")
                    
                    return  # Both servers ready
            except:
                await asyncio.sleep(1)
        
        raise TimeoutError("Servers failed to start within timeout")
        
    async def execute_tool(self, port: int, tool: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool via JSON-RPC"""
        request = {
            "jsonrpc": "2.0",
            "id": f"test_{time.time()}",
            "method": "tool.execute",
            "params": {
                "tool": tool,
                "parameters": parameters,
                "context": {
                    "sessionId": self.session_id,
                    "messageId": f"msg_{time.time()}",
                    "timeout": 120000
                }
            }
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"http://localhost:{port}/rpc",
                json=request,
                headers={"Content-Type": "application/json"}
            ) as response:
                result = await response.json()
                
                if "error" in result:
                    raise Exception(f"Tool execution failed: {result['error']['message']}")
                
                return result["result"]


@pytest.fixture
async def context():
    """Pytest fixture for test context"""
    ctx = TestContext()
    await ctx.setup()
    yield ctx
    await ctx.teardown()


class TestPythonTools:
    """Test Python tool implementations"""
    
    @pytest.mark.asyncio
    async def test_bash_tool(self, context: TestContext):
        """Test bash command execution"""
        result = await context.execute_tool(
            context.python_port,
            "bash",
            {"command": "echo 'Hello from Python test'"}
        )
        
        assert "Hello from Python test" in result["output"]
        assert result["metadata"] is not None
        
    @pytest.mark.asyncio
    async def test_edit_tool(self, context: TestContext):
        """Test file editing"""
        # Create test file
        test_file = os.path.join(context.temp_dir, "test_edit.txt")
        with open(test_file, "w") as f:
            f.write("Original content\nLine 2\n")
        
        # Edit file
        result = await context.execute_tool(
            context.python_port,
            "edit",
            {
                "file_path": test_file,
                "old_string": "Original content",
                "new_string": "Modified content"
            }
        )
        
        # Verify changes
        with open(test_file, "r") as f:
            content = f.read()
        
        assert "Modified content" in content
        assert "Line 2" in content
        
    @pytest.mark.asyncio
    async def test_glob_tool(self, context: TestContext):
        """Test file globbing"""
        # Create test files
        test_dir = os.path.join(context.temp_dir, "glob_test")
        os.makedirs(test_dir, exist_ok=True)
        
        for i in range(3):
            with open(os.path.join(test_dir, f"file{i}.txt"), "w") as f:
                f.write(f"Content {i}")
        
        with open(os.path.join(test_dir, "other.md"), "w") as f:
            f.write("Markdown file")
        
        # Glob for txt files
        result = await context.execute_tool(
            context.python_port,
            "glob",
            {
                "pattern": "*.txt",
                "path": test_dir
            }
        )
        
        output = result["output"]
        assert "file0.txt" in output
        assert "file1.txt" in output
        assert "file2.txt" in output
        assert "other.md" not in output
        
    @pytest.mark.asyncio
    async def test_grep_tool(self, context: TestContext):
        """Test content searching"""
        # Create test files
        test_dir = os.path.join(context.temp_dir, "grep_test")
        os.makedirs(test_dir, exist_ok=True)
        
        with open(os.path.join(test_dir, "match1.txt"), "w") as f:
            f.write("This contains the search term\nAnd other content")
        
        with open(os.path.join(test_dir, "match2.txt"), "w") as f:
            f.write("Another file with search term")
        
        with open(os.path.join(test_dir, "nomatch.txt"), "w") as f:
            f.write("This file has different content")
        
        # Search for pattern
        result = await context.execute_tool(
            context.python_port,
            "grep",
            {
                "pattern": "search term",
                "path": test_dir
            }
        )
        
        output = result["output"]
        assert "match1.txt" in output
        assert "match2.txt" in output
        assert "nomatch.txt" not in output


class TestCrossLanguageCompatibility:
    """Test cross-language tool execution"""
    
    @pytest.mark.asyncio
    async def test_python_calls_typescript(self, context: TestContext):
        """Test Python client calling TypeScript tool"""
        # Use TypeScript tool from Python test
        result = await context.execute_tool(
            context.ts_port,
            "bash",
            {"command": "echo 'Python calling TypeScript'"}
        )
        
        assert "Python calling TypeScript" in result["output"]
        
    @pytest.mark.asyncio
    async def test_complex_workflow(self, context: TestContext):
        """Test complex workflow across languages"""
        test_file = os.path.join(context.temp_dir, "workflow.txt")
        
        # Step 1: Create file with TypeScript
        await context.execute_tool(
            context.ts_port,
            "write",
            {
                "file_path": test_file,
                "content": "Step 1: Created by TypeScript\n"
            }
        )
        
        # Step 2: Edit with Python
        await context.execute_tool(
            context.python_port,
            "edit",
            {
                "file_path": test_file,
                "old_string": "Step 1: Created by TypeScript",
                "new_string": "Step 1: Created by TypeScript\nStep 2: Edited by Python"
            }
        )
        
        # Step 3: Read with TypeScript
        result = await context.execute_tool(
            context.ts_port,
            "read",
            {"file_path": test_file}
        )
        
        output = result["output"]
        assert "Created by TypeScript" in output
        assert "Edited by Python" in output


class TestErrorHandling:
    """Test error handling in Python tools"""
    
    @pytest.mark.asyncio
    async def test_invalid_command(self, context: TestContext):
        """Test handling of invalid commands"""
        with pytest.raises(Exception) as exc_info:
            await context.execute_tool(
                context.python_port,
                "bash",
                {"command": "nonexistentcommand123"}
            )
        
        assert "Tool execution failed" in str(exc_info.value)
        
    @pytest.mark.asyncio
    async def test_timeout_handling(self, context: TestContext):
        """Test command timeout"""
        start_time = time.time()
        
        with pytest.raises(Exception):
            await context.execute_tool(
                context.python_port,
                "bash",
                {
                    "command": "sleep 10",
                    "timeout": 1000  # 1 second timeout
                }
            )
        
        elapsed = time.time() - start_time
        assert elapsed < 2  # Should timeout quickly
        
    @pytest.mark.asyncio
    async def test_permission_error(self, context: TestContext):
        """Test handling of permission errors"""
        with pytest.raises(Exception):
            await context.execute_tool(
                context.python_port,
                "write",
                {
                    "file_path": "/root/forbidden.txt",
                    "content": "This should fail"
                }
            )


class TestPerformance:
    """Performance tests for Python tools"""
    
    @pytest.mark.asyncio
    async def test_latency(self, context: TestContext):
        """Test tool execution latency"""
        latencies = []
        
        # Warm up
        for _ in range(5):
            await context.execute_tool(
                context.python_port,
                "bash",
                {"command": "true"}
            )
        
        # Measure
        for _ in range(50):
            start = time.time()
            await context.execute_tool(
                context.python_port,
                "bash",
                {"command": "echo 'test'"}
            )
            latencies.append((time.time() - start) * 1000)  # Convert to ms
        
        avg_latency = sum(latencies) / len(latencies)
        print(f"Average latency: {avg_latency:.2f}ms")
        
        assert avg_latency < 100  # Should be under 100ms
        
    @pytest.mark.asyncio
    async def test_concurrent_execution(self, context: TestContext):
        """Test concurrent tool execution"""
        tasks = []
        
        # Create 20 concurrent tasks
        for i in range(20):
            task = context.execute_tool(
                context.python_port,
                "bash",
                {"command": f"echo 'Task {i}'"}
            )
            tasks.append(task)
        
        start = time.time()
        results = await asyncio.gather(*tasks)
        duration = time.time() - start
        
        # Verify all completed
        assert len(results) == 20
        for i, result in enumerate(results):
            assert f"Task {i}" in result["output"]
        
        print(f"Concurrent execution time: {duration:.2f}s")
        assert duration < 5  # Should complete quickly


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])