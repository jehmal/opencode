"""
Agent Wrapper for DGM Agents in Docker Container
Provides HTTP interface, health checks, and tool execution
"""

import os
import sys
import json
import asyncio
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn

# Add parent directories to path
sys.path.append('/workspace')
sys.path.append('/tools')

# Import DGM components
from coding_agent import CodingAgent
from protocols import ToolCall, ToolResult

# Import tool adapters
from python_adapter import PythonToolAdapter
from type_converter import TypeConverter

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('agent_wrapper')

class TaskRequest(BaseModel):
    """Request model for agent tasks"""
    task_id: str
    task_type: str
    prompt: str
    context: Optional[Dict[str, Any]] = {}
    tools: Optional[List[str]] = None
    timeout: Optional[int] = 300  # 5 minutes default

class TaskResponse(BaseModel):
    """Response model for agent tasks"""
    task_id: str
    status: str
    result: Optional[Any] = None
    error: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None
    timestamp: str

class AgentWrapper:
    """Wrapper for DGM agent with HTTP interface"""
    
    def __init__(self):
        self.agent = CodingAgent()
        self.tool_adapter = PythonToolAdapter()
        self.type_converter = TypeConverter()
        self.executor = ThreadPoolExecutor(max_workers=4)
        self.active_tasks: Dict[str, asyncio.Task] = {}
        self.metrics = {
            'tasks_completed': 0,
            'tasks_failed': 0,
            'total_execution_time': 0,
            'start_time': datetime.now()
        }
    
    async def execute_task(self, request: TaskRequest) -> TaskResponse:
        """Execute an agent task"""
        start_time = datetime.now()
        
        try:
            # Create task context
            context = {
                'task_id': request.task_id,
                'task_type': request.task_type,
                'tools': request.tools or ['bash', 'edit', 'read'],
                **request.context
            }
            
            # Execute agent task
            if request.task_type == 'coding':
                result = await self._execute_coding_task(request.prompt, context)
            elif request.task_type == 'tool_execution':
                result = await self._execute_tool(request.prompt, context)
            else:
                raise ValueError(f"Unknown task type: {request.task_type}")
            
            # Update metrics
            execution_time = (datetime.now() - start_time).total_seconds()
            self.metrics['tasks_completed'] += 1
            self.metrics['total_execution_time'] += execution_time
            
            return TaskResponse(
                task_id=request.task_id,
                status='completed',
                result=result,
                metrics={
                    'execution_time': execution_time,
                    'tools_used': context.get('tools_used', [])
                },
                timestamp=datetime.now().isoformat()
            )
            
        except Exception as e:
            logger.error(f"Task {request.task_id} failed: {str(e)}")
            self.metrics['tasks_failed'] += 1
            
            return TaskResponse(
                task_id=request.task_id,
                status='failed',
                error=str(e),
                timestamp=datetime.now().isoformat()
            )
    
    async def _execute_coding_task(self, prompt: str, context: Dict[str, Any]) -> Any:
        """Execute a coding task using the DGM agent"""
        loop = asyncio.get_event_loop()
        
        # Run in thread pool to avoid blocking
        result = await loop.run_in_executor(
            self.executor,
            self.agent.solve_problem,
            prompt,
            context
        )
        
        return result
    
    async def _execute_tool(self, tool_call: str, context: Dict[str, Any]) -> Any:
        """Execute a specific tool"""
        # Parse tool call
        tool_data = json.loads(tool_call)
        tool_name = tool_data['name']
        tool_params = tool_data.get('parameters', {})
        
        # Convert parameters if needed
        converted_params = self.type_converter.convert_params(
            tool_params,
            from_case='camelCase',
            to_case='snake_case'
        )
        
        # Execute tool
        result = await self.tool_adapter.execute(
            tool_name,
            converted_params
        )
        
        # Track tool usage
        if 'tools_used' not in context:
            context['tools_used'] = []
        context['tools_used'].append(tool_name)
        
        return result
    
    def get_health_status(self) -> Dict[str, Any]:
        """Get agent health status"""
        uptime = (datetime.now() - self.metrics['start_time']).total_seconds()
        
        return {
            'status': 'healthy',
            'uptime_seconds': uptime,
            'metrics': {
                'tasks_completed': self.metrics['tasks_completed'],
                'tasks_failed': self.metrics['tasks_failed'],
                'average_execution_time': (
                    self.metrics['total_execution_time'] / 
                    max(1, self.metrics['tasks_completed'])
                ),
                'active_tasks': len(self.active_tasks)
            },
            'timestamp': datetime.now().isoformat()
        }

# Create FastAPI app
app = FastAPI(title="DGM Agent Wrapper")
wrapper = AgentWrapper()

@app.post("/execute", response_model=TaskResponse)
async def execute_task(request: TaskRequest):
    """Execute an agent task"""
    return await wrapper.execute_task(request)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return wrapper.get_health_status()

@app.get("/metrics")
async def get_metrics():
    """Get agent metrics"""
    return wrapper.metrics

@app.post("/shutdown")
async def shutdown():
    """Graceful shutdown"""
    logger.info("Shutting down agent wrapper...")
    # Cancel active tasks
    for task in wrapper.active_tasks.values():
        task.cancel()
    
    # Shutdown executor
    wrapper.executor.shutdown(wait=True)
    
    return {"status": "shutting down"}

if __name__ == "__main__":
    # Get configuration from environment
    host = os.getenv("AGENT_HOST", "0.0.0.0")
    port = int(os.getenv("AGENT_PORT", "8080"))
    
    logger.info(f"Starting agent wrapper on {host}:{port}")
    
    # Run server
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info"
    )