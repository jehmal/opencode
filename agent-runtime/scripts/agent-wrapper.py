#!/usr/bin/env python3
"""
Agent Wrapper for containerized DGM agent execution.
Provides security, resource management, and communication with host.
"""

import os
import sys
import json
import asyncio
import signal
import psutil
import resource
import traceback
from datetime import datetime
from typing import Dict, Any, Optional, Callable
from pathlib import Path
import structlog
import aiofiles
import websockets
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import uvicorn
from prometheus_client import Counter, Gauge, Histogram, generate_latest
import threading
import time

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Metrics
agent_tasks_total = Counter('agent_tasks_total', 'Total number of agent tasks')
agent_tasks_failed = Counter('agent_tasks_failed', 'Number of failed agent tasks')
agent_memory_usage = Gauge('agent_memory_usage_bytes', 'Current memory usage in bytes')
agent_cpu_usage = Gauge('agent_cpu_usage_percent', 'Current CPU usage percentage')
agent_task_duration = Histogram('agent_task_duration_seconds', 'Task execution duration')

class AgentConfig(BaseModel):
    """Configuration for agent runtime."""
    agent_type: str = Field(default="coding", description="Type of agent to run")
    max_memory: str = Field(default="2G", description="Maximum memory limit")
    max_cpu: float = Field(default=2.0, description="Maximum CPU cores")
    timeout: int = Field(default=600, description="Task timeout in seconds")
    workspace: str = Field(default="/app/workspace", description="Agent workspace directory")
    log_level: str = Field(default="INFO", description="Logging level")
    metrics_port: int = Field(default=9090, description="Prometheus metrics port")
    api_port: int = Field(default=8080, description="API server port")
    websocket_url: Optional[str] = Field(default=None, description="WebSocket URL for host communication")

class TaskRequest(BaseModel):
    """Request model for agent tasks."""
    task_id: str
    task_type: str
    parameters: Dict[str, Any]
    timeout: Optional[int] = None
    context: Optional[Dict[str, Any]] = None

class TaskResponse(BaseModel):
    """Response model for agent tasks."""
    task_id: str
    status: str  # pending, running, completed, failed
    result: Optional[Any] = None
    error: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class AgentWrapper:
    """Wrapper for DGM agents providing security and resource management."""
    
    def __init__(self, config: AgentConfig):
        self.config = config
        self.agent = None
        self.tasks: Dict[str, TaskResponse] = {}
        self.process = psutil.Process()
        self._shutdown = False
        self._websocket = None
        
        # Set up resource limits
        self._setup_resource_limits()
        
        # Initialize agent based on type
        self._initialize_agent()
        
        # Start monitoring
        self._start_monitoring()
    
    def _setup_resource_limits(self):
        """Set resource limits for the agent process."""
        # Memory limit
        memory_bytes = self._parse_memory_limit(self.config.max_memory)
        resource.setrlimit(resource.RLIMIT_AS, (memory_bytes, memory_bytes))
        
        # CPU limit (using nice value as a soft limit)
        os.nice(10)  # Lower priority
        
        # File descriptor limit
        resource.setrlimit(resource.RLIMIT_NOFILE, (1024, 1024))
        
        logger.info("Resource limits set", 
                   memory_limit=self.config.max_memory,
                   cpu_limit=self.config.max_cpu)
    
    def _parse_memory_limit(self, limit: str) -> int:
        """Parse memory limit string to bytes."""
        units = {'K': 1024, 'M': 1024**2, 'G': 1024**3}
        if limit[-1] in units:
            return int(limit[:-1]) * units[limit[-1]]
        return int(limit)
    
    def _initialize_agent(self):
        """Initialize the appropriate agent based on type."""
        try:
            if self.config.agent_type == "coding":
                from coding_agent import AgenticSystem
                # Initialize with minimal setup for wrapper
                self.agent = AgenticSystem(
                    problem_statement="",
                    git_tempdir=self.config.workspace,
                    base_commit="HEAD",
                    chat_history_file=f"{self.config.workspace}/chat_history.md"
                )
            elif self.config.agent_type == "polyglot":
                from coding_agent_polyglot import AgenticSystem
                self.agent = AgenticSystem(
                    problem_statement="",
                    test_dir=self.config.workspace,
                    base_path=self.config.workspace
                )
            else:
                raise ValueError(f"Unknown agent type: {self.config.agent_type}")
            
            logger.info("Agent initialized", agent_type=self.config.agent_type)
        except Exception as e:
            logger.error("Failed to initialize agent", error=str(e), traceback=traceback.format_exc())
            raise
    
    def _start_monitoring(self):
        """Start background monitoring thread."""
        def monitor():
            while not self._shutdown:
                try:
                    # Update metrics
                    agent_memory_usage.set(self.process.memory_info().rss)
                    agent_cpu_usage.set(self.process.cpu_percent(interval=1))
                    
                    # Check resource limits
                    if self.process.memory_info().rss > self._parse_memory_limit(self.config.max_memory):
                        logger.warning("Memory limit exceeded", 
                                     current=self.process.memory_info().rss,
                                     limit=self.config.max_memory)
                    
                    time.sleep(5)
                except Exception as e:
                    logger.error("Monitoring error", error=str(e))
        
        monitor_thread = threading.Thread(target=monitor, daemon=True)
        monitor_thread.start()
    
    async def execute_task(self, request: TaskRequest) -> TaskResponse:
        """Execute an agent task with timeout and resource monitoring."""
        logger.info("Executing task", task_id=request.task_id, task_type=request.task_type)
        
        response = TaskResponse(
            task_id=request.task_id,
            status="running"
        )
        self.tasks[request.task_id] = response
        
        # Update metrics
        agent_tasks_total.inc()
        
        # Create task execution coroutine with timeout
        timeout = request.timeout or self.config.timeout
        
        try:
            with agent_task_duration.time():
                result = await asyncio.wait_for(
                    self._run_agent_task(request),
                    timeout=timeout
                )
            
            response.status = "completed"
            response.result = result
            response.metrics = self._get_task_metrics()
            
            logger.info("Task completed", task_id=request.task_id)
            
        except asyncio.TimeoutError:
            response.status = "failed"
            response.error = f"Task timeout after {timeout} seconds"
            agent_tasks_failed.inc()
            logger.error("Task timeout", task_id=request.task_id)
            
        except Exception as e:
            response.status = "failed"
            response.error = str(e)
            agent_tasks_failed.inc()
            logger.error("Task failed", task_id=request.task_id, error=str(e), traceback=traceback.format_exc())
        
        # Send result via WebSocket if connected
        if self._websocket:
            await self._send_websocket_update(response)
        
        return response
    
    async def _run_agent_task(self, request: TaskRequest) -> Any:
        """Run the actual agent task."""
        # This is where we'd call the appropriate agent method
        # For now, returning a placeholder
        await asyncio.sleep(1)  # Simulate work
        return {"status": "success", "message": "Task completed"}
    
    def _get_task_metrics(self) -> Dict[str, Any]:
        """Get current task metrics."""
        return {
            "memory_usage_mb": self.process.memory_info().rss / 1024 / 1024,
            "cpu_percent": self.process.cpu_percent(),
            "num_threads": self.process.num_threads(),
            "open_files": len(self.process.open_files())
        }
    
    async def _send_websocket_update(self, response: TaskResponse):
        """Send task update via WebSocket."""
        try:
            if self._websocket:
                await self._websocket.send(response.json())
        except Exception as e:
            logger.error("WebSocket send error", error=str(e))
    
    async def connect_websocket(self):
        """Connect to host WebSocket for real-time communication."""
        if not self.config.websocket_url:
            return
        
        try:
            self._websocket = await websockets.connect(self.config.websocket_url)
            logger.info("WebSocket connected", url=self.config.websocket_url)
            
            # Listen for commands
            async for message in self._websocket:
                try:
                    data = json.loads(message)
                    if data.get("type") == "command":
                        await self._handle_websocket_command(data)
                except Exception as e:
                    logger.error("WebSocket message error", error=str(e))
                    
        except Exception as e:
            logger.error("WebSocket connection error", error=str(e))
    
    async def _handle_websocket_command(self, data: Dict[str, Any]):
        """Handle command received via WebSocket."""
        command = data.get("command")
        if command == "shutdown":
            self._shutdown = True
        elif command == "health":
            await self._websocket.send(json.dumps({
                "type": "health",
                "status": "healthy",
                "metrics": self._get_task_metrics()
            }))
    
    def shutdown(self):
        """Graceful shutdown."""
        logger.info("Shutting down agent wrapper")
        self._shutdown = True


# FastAPI app for HTTP API
app = FastAPI(title="DGM Agent Runtime")
wrapper: Optional[AgentWrapper] = None

@app.on_event("startup")
async def startup_event():
    """Initialize agent wrapper on startup."""
    global wrapper
    config = AgentConfig(
        agent_type=os.getenv("AGENT_TYPE", "coding"),
        max_memory=os.getenv("AGENT_MAX_MEMORY", "2G"),
        max_cpu=float(os.getenv("AGENT_MAX_CPU", "2.0")),
        timeout=int(os.getenv("AGENT_TIMEOUT", "600")),
        workspace=os.getenv("AGENT_WORKSPACE", "/app/workspace"),
        log_level=os.getenv("LOG_LEVEL", "INFO"),
        websocket_url=os.getenv("WEBSOCKET_URL")
    )
    wrapper = AgentWrapper(config)
    
    # Start WebSocket connection
    if config.websocket_url:
        asyncio.create_task(wrapper.connect_websocket())

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    if wrapper:
        wrapper.shutdown()

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    if not wrapper:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    return {
        "status": "healthy",
        "agent_type": wrapper.config.agent_type,
        "metrics": wrapper._get_task_metrics()
    }

@app.post("/tasks", response_model=TaskResponse)
async def execute_task(request: TaskRequest):
    """Execute an agent task."""
    if not wrapper:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    return await wrapper.execute_task(request)

@app.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task_status(task_id: str):
    """Get task status."""
    if not wrapper:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    if task_id not in wrapper.tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return wrapper.tasks[task_id]

@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint."""
    return Response(generate_latest(), media_type="text/plain")


def signal_handler(signum, frame):
    """Handle shutdown signals."""
    logger.info("Received signal", signal=signum)
    if wrapper:
        wrapper.shutdown()
    sys.exit(0)


if __name__ == "__main__":
    # Register signal handlers
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    # Get configuration from environment
    api_port = int(os.getenv("API_PORT", "8080"))
    
    # Run the API server
    uvicorn.run(app, host="0.0.0.0", port=api_port)