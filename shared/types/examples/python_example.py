"""
Example usage of OpenCode-DGM shared types in Python
"""

import asyncio
from datetime import datetime
from typing import List, Dict, Any

from shared.types import (
    Agent,
    AgentRole,
    AgentCapability,
    AgentTask,
    Tool,
    ToolExecutionRequest,
    ToolExecutionResult,
    ToolExecutionOptions,
    ToolPerformance,
    Command,
    CommandIntent,
    CommandOptions,
    CommandMetadata,
    CommandResult,
    OpenCodeDGMRequest,
    OpenCodeDGMResponse,
    CodeGenerationPayload,
    CodeGenerationResult,
    CodeMetrics,
    Priority,
    Status,
    ResponseBuilder,
    CaseConverter,
    CrossLanguageValidator,
    AgentCapabilityCategory,
    ToolCategory,
    CommandType
)

async def tool_example():
    """Example 1: Creating and executing a tool"""
    
    # Define a tool
    code_tool = Tool(
        id="code-generator-v1",
        name="Code Generator",
        description="Generates code from natural language descriptions",
        version="1.0.0",
        category=ToolCategory.CODE_GENERATION,
        language="python",
        input_schema={
            "type": "object",
            "properties": {
                "prompt": {"type": "string"},
                "language": {"type": "string", "enum": ["typescript", "python", "java"]},
                "style": {"type": "string"}
            },
            "required": ["prompt", "language"]
        },
        configuration={
            "timeout": 30000,
            "retryable": True,
            "cacheable": True,
            "rate_limit": {
                "requests": 10,
                "window": 60000,
                "strategy": "sliding-window"
            }
        }
    )
    
    # Create execution request
    request = ToolExecutionRequest(
        tool_id=code_tool.id,
        input={
            "prompt": "Create a function to calculate fibonacci numbers",
            "language": "python",
            "style": "functional"
        },
        options=ToolExecutionOptions(
            cache=True,
            timeout=15000
        )
    )
    
    # Simulate execution and result
    result = ToolExecutionResult(
        tool_id=code_tool.id,
        execution_id="exec-001",
        status="success",
        output={
            "code": """def fibonacci(n: int) -> int:
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)""",
            "language": "python"
        },
        performance=ToolPerformance(
            start_time=datetime.now().isoformat(),
            end_time=datetime.now().isoformat(),
            duration=1250
        )
    )
    
    print("Tool execution result:", result.dict())

async def agent_example():
    """Example 2: Agent coordination"""
    
    # Create a code review agent
    review_agent = Agent(
        id="code-reviewer-v1",
        name="Code Reviewer",
        description="Reviews code for quality and best practices",
        version="1.0.0",
        role=AgentRole(
            id="reviewer",
            name="Code Reviewer",
            description="Analyzes code quality",
            capabilities=["code-analysis", "suggestion-generation"],
            prompting_technique="cot"  # Chain of Thought
        ),
        capabilities=[
            AgentCapability(
                id="analyze-python",
                name="Python Analysis",
                description="Analyzes Python code",
                category=AgentCapabilityCategory.ANALYSIS,
                required_tools=["ast-parser", "pylint"]
            )
        ],
        tools=["pylint-tool", "mypy-tool"],
        configuration={
            "max_concurrent_tasks": 5,
            "timeout": 60000,
            "model_preferences": {
                "preferred_models": ["gpt-4", "claude-3"],
                "temperature": 0.3,
                "max_tokens": 2000
            }
        }
    )
    
    # Create a task for the agent
    task = AgentTask(
        id="task-001",
        agent_id=review_agent.id,
        type="code-review",
        priority=Priority.HIGH,
        input={
            "code": "def add(a, b): return a + b",
            "language": "python",
            "context": "utility function"
        },
        status=Status.PENDING,
        created_at=datetime.now().isoformat()
    )
    
    print("Agent task created:", task.dict())

async def command_example():
    """Example 3: Command processing"""
    
    command = Command(
        id="cmd-001",
        type=CommandType.GENERATION,
        intent=CommandIntent(
            primary="create_api",
            confidence=0.92,
            entities=[
                {
                    "type": "framework",
                    "value": "fastapi",
                    "confidence": 0.95,
                    "position": {"start": 10, "end": 17}
                }
            ]
        ),
        raw_input="Create a FastAPI REST API for user management",
        parameters={
            "framework": "fastapi",
            "features": ["authentication", "crud", "validation"],
            "database": "postgresql"
        },
        options=CommandOptions(
            priority=Priority.NORMAL,
            timeout=45000,
            retry_policy={
                "max_attempts": 3,
                "backoff_ms": 1000,
                "exponential_backoff": True
            }
        ),
        metadata=CommandMetadata(
            id="meta-001",
            version="1.0.0",
            timestamp=datetime.now().isoformat(),
            source="cli",
            user_id="user-123",
            session_id="session-456"
        ),
        timestamp=datetime.now().isoformat()
    )
    
    # Build a response
    response = (ResponseBuilder()
        .status(Status.COMPLETED)
        .data({
            "files": ["main.py", "routers/users.py", "models/user.py"],
            "instructions": "Run pip install -r requirements.txt and uvicorn main:app"
        })
        .metadata(duration=3500, cached=False)
        .build()
    )
    
    print("Command response:", response)

async def cross_language_example():
    """Example 4: Cross-language communication"""
    
    # Create a request in Python format
    request = OpenCodeDGMRequest(
        id="req-001",
        type="code_generation",
        payload=CodeGenerationPayload(
            prompt="Create a data processing pipeline",
            language="python",
            context={
                "files": ["data_loader.py", "processor.py"],
                "dependencies": ["pandas", "numpy"]
            },
            constraints={
                "max_tokens": 1500,
                "style": "functional"
            }
        ),
        context={
            "session_id": "session-789",
            "user_id": "user-123",
            "priority": 1
        }
    )
    
    # Convert to TypeScript format
    typescript_request = CaseConverter.from_python_to_typescript(request.dict())
    print("TypeScript-formatted request:", typescript_request)
    
    # Simulate TypeScript response
    typescript_response = {
        "id": "res-001",
        "requestId": "req-001",
        "type": "success",
        "payload": {
            "code": "const processData = (data) => data.map(transform)",
            "language": "typescript",
            "confidence": 0.94,
            "metrics": {
                "lines": 1,
                "complexity": 1,
                "tokens": 20
            }
        }
    }
    
    # Convert back to Python format
    python_response = CaseConverter.from_typescript_to_python(typescript_response)
    print("Python-formatted response:", python_response)

async def validation_example():
    """Example 5: Validation"""
    
    # Create an invalid command
    invalid_command = {
        "id": "cmd-001",
        "type": "invalid-type",  # This will fail validation
        "intent": {
            "primary": "test",
            "confidence": 1.5  # This exceeds max value
        },
        "raw_input": "test command",
        "parameters": {},
        "options": {},
        "metadata": {
            "id": "meta-001",
            "version": "1.0.0",
            "timestamp": datetime.now().isoformat(),
            "source": "test"
        },
        "timestamp": datetime.now().isoformat()
    }
    
    # Validate using Pydantic
    try:
        command = Command.parse_obj(invalid_command)
    except Exception as e:
        print("Validation error:", str(e))
    
    # Use cross-language validator
    validator = CrossLanguageValidator(Command)
    result = validator.validate(invalid_command)
    
    if not result.get("valid"):
        print("Validation errors:", result.get("errors"))

async def integration_example():
    """Example 6: Full integration scenario"""
    
    # 1. Receive command from TypeScript
    ts_command_data = {
        "id": "cmd-002",
        "type": "workflow",
        "intent": {
            "primary": "buildFullStackApp",
            "confidence": 0.88
        },
        "rawInput": "Build a full-stack todo app with React and FastAPI",
        "parameters": {
            "frontend": "react",
            "backend": "fastapi",
            "database": "sqlite",
            "features": ["auth", "realtime", "responsive"]
        },
        "options": {
            "timeout": 120000,
            "priority": "high"
        },
        "metadata": {
            "id": "meta-002",
            "version": "1.0.0",
            "timestamp": datetime.now().isoformat(),
            "source": "ui",
            "userId": "user-456"
        },
        "timestamp": datetime.now().isoformat()
    }
    
    # 2. Convert to Python format
    py_command_data = CaseConverter.from_typescript_to_python(ts_command_data)
    command = Command.parse_obj(py_command_data)
    
    # 3. Process command with multiple agents
    agents_tasks = []
    
    # Frontend agent task
    frontend_task = AgentTask(
        id="task-frontend",
        agent_id="react-developer-v1",
        type="frontend-generation",
        priority=Priority.HIGH,
        input={
            "framework": "react",
            "features": command.parameters["features"],
            "api_spec": "to_be_provided"
        },
        status=Status.PENDING,
        created_at=datetime.now().isoformat()
    )
    agents_tasks.append(frontend_task)
    
    # Backend agent task
    backend_task = AgentTask(
        id="task-backend",
        agent_id="fastapi-developer-v1",
        type="backend-generation",
        priority=Priority.HIGH,
        input={
            "framework": "fastapi",
            "database": command.parameters["database"],
            "features": command.parameters["features"]
        },
        status=Status.PENDING,
        created_at=datetime.now().isoformat()
    )
    agents_tasks.append(backend_task)
    
    # 4. Simulate processing and create result
    result = CommandResult(
        command_id=command.id,
        status=Status.COMPLETED,
        data={
            "frontend": {
                "files": ["App.tsx", "components/TodoList.tsx", "api/client.ts"],
                "preview_url": "http://localhost:3000"
            },
            "backend": {
                "files": ["main.py", "models.py", "auth.py"],
                "api_docs": "http://localhost:8000/docs"
            },
            "instructions": {
                "frontend": "cd frontend && npm install && npm start",
                "backend": "cd backend && pip install -r requirements.txt && uvicorn main:app"
            }
        },
        execution_time=85000,
        timestamp=datetime.now().isoformat()
    )
    
    # 5. Convert result back to TypeScript format
    ts_result = CaseConverter.from_python_to_typescript(result.dict())
    print("Full integration result:", ts_result)

async def main():
    """Run all examples"""
    print("=== Tool Example ===")
    await tool_example()
    
    print("\n=== Agent Example ===")
    await agent_example()
    
    print("\n=== Command Example ===")
    await command_example()
    
    print("\n=== Cross-Language Example ===")
    await cross_language_example()
    
    print("\n=== Validation Example ===")
    await validation_example()
    
    print("\n=== Integration Example ===")
    await integration_example()

if __name__ == "__main__":
    asyncio.run(main())