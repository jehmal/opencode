"""
Orchestrator Client for DGM Agents
Connects agents to the orchestration service
"""

import os
import json
import asyncio
import logging
from typing import Dict, Any, Optional, Callable
from datetime import datetime

import aio_pika
import aioredis
import httpx
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class TaskMessage(BaseModel):
    """Task message from orchestrator"""
    task_id: str
    task_type: str
    prompt: str
    context: Dict[str, Any] = {}
    timeout: int = 300

class TaskResult(BaseModel):
    """Task result to send back"""
    task_id: str
    status: str
    result: Optional[Any] = None
    error: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None

class OrchestratorClient:
    """Client for connecting DGM agents to orchestrator"""
    
    def __init__(
        self,
        agent_id: str,
        amqp_url: str,
        redis_url: str,
        agent_url: str = "http://localhost:8080"
    ):
        self.agent_id = agent_id
        self.amqp_url = amqp_url
        self.redis_url = redis_url
        self.agent_url = agent_url
        
        self.amqp_connection = None
        self.task_channel = None
        self.result_channel = None
        self.redis = None
        self.http_client = httpx.AsyncClient()
        
        self.task_handlers: Dict[str, Callable] = {}
        self.running = False
    
    async def connect(self):
        """Connect to orchestrator services"""
        try:
            # Connect to RabbitMQ
            self.amqp_connection = await aio_pika.connect_robust(self.amqp_url)
            
            # Create channels
            self.task_channel = await self.amqp_connection.channel()
            self.result_channel = await self.amqp_connection.channel()
            
            # Set QoS
            await self.task_channel.set_qos(prefetch_count=1)
            
            # Connect to Redis
            self.redis = await aioredis.create_redis_pool(self.redis_url)
            
            logger.info(f"Agent {self.agent_id} connected to orchestrator")
            
        except Exception as e:
            logger.error(f"Failed to connect: {str(e)}")
            raise
    
    def register_handler(self, task_type: str, handler: Callable):
        """Register a handler for a specific task type"""
        self.task_handlers[task_type] = handler
    
    async def start(self):
        """Start consuming tasks"""
        if not self.amqp_connection:
            await self.connect()
        
        self.running = True
        
        # Declare queue
        queue = await self.task_channel.declare_queue(
            'agent_tasks',
            durable=True
        )
        
        # Start consuming
        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                if not self.running:
                    break
                
                async with message.process():
                    # Check if message is for this agent
                    headers = message.headers
                    target_agent = headers.get('agent-id')
                    
                    if target_agent and target_agent != self.agent_id:
                        # Not for us, reject
                        await message.reject(requeue=True)
                        continue
                    
                    # Process task
                    await self.process_task(message)
    
    async def process_task(self, message: aio_pika.IncomingMessage):
        """Process a task message"""
        try:
            # Parse message
            task_data = json.loads(message.body.decode())
            task = TaskMessage(**task_data)
            
            logger.info(f"Processing task {task.task_id} of type {task.task_type}")
            
            # Update status in Redis
            await self.update_task_status(task.task_id, "processing")
            
            # Execute task
            result = await self.execute_task(task)
            
            # Send result
            await self.send_result(result)
            
        except Exception as e:
            logger.error(f"Error processing task: {str(e)}")
            
            # Send error result
            error_result = TaskResult(
                task_id=task_data.get('task_id', 'unknown'),
                status='failed',
                error=str(e)
            )
            await self.send_result(error_result)
    
    async def execute_task(self, task: TaskMessage) -> TaskResult:
        """Execute a task using the appropriate handler"""
        start_time = datetime.now()
        
        try:
            # Check for custom handler
            if task.task_type in self.task_handlers:
                handler = self.task_handlers[task.task_type]
                result = await handler(task)
            else:
                # Use HTTP API to agent wrapper
                response = await self.http_client.post(
                    f"{self.agent_url}/execute",
                    json=task.dict(),
                    timeout=task.timeout
                )
                response.raise_for_status()
                result = response.json()
            
            execution_time = (datetime.now() - start_time).total_seconds()
            
            return TaskResult(
                task_id=task.task_id,
                status='completed',
                result=result,
                metrics={
                    'execution_time': execution_time,
                    'agent_id': self.agent_id
                }
            )
            
        except Exception as e:
            logger.error(f"Task execution failed: {str(e)}")
            return TaskResult(
                task_id=task.task_id,
                status='failed',
                error=str(e)
            )
    
    async def send_result(self, result: TaskResult):
        """Send task result back to orchestrator"""
        try:
            # Publish to results queue
            await self.result_channel.default_exchange.publish(
                aio_pika.Message(
                    body=json.dumps(result.dict()).encode(),
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT
                ),
                routing_key='task_results'
            )
            
            logger.info(f"Sent result for task {result.task_id}")
            
        except Exception as e:
            logger.error(f"Failed to send result: {str(e)}")
    
    async def update_task_status(self, task_id: str, status: str):
        """Update task status in Redis"""
        try:
            await self.redis.hset(
                f"task:{task_id}",
                mapping={
                    'status': status,
                    'agent_id': self.agent_id,
                    'updated_at': datetime.now().isoformat()
                }
            )
        except Exception as e:
            logger.warning(f"Failed to update task status: {str(e)}")
    
    async def report_capabilities(self, capabilities: Dict[str, Any]):
        """Report agent capabilities to orchestrator"""
        try:
            await self.redis.hset(
                'agent_capabilities',
                self.agent_id,
                json.dumps({
                    'agentId': self.agent_id,
                    'taskTypes': capabilities.get('task_types', ['coding']),
                    'maxConcurrentTasks': capabilities.get('max_concurrent', 1),
                    'specializations': capabilities.get('specializations', []),
                    'registered_at': datetime.now().isoformat()
                })
            )
            
            logger.info(f"Reported capabilities for agent {self.agent_id}")
            
        except Exception as e:
            logger.error(f"Failed to report capabilities: {str(e)}")
    
    async def heartbeat(self):
        """Send periodic heartbeat"""
        while self.running:
            try:
                await self.redis.setex(
                    f"agent:heartbeat:{self.agent_id}",
                    30,  # 30 second TTL
                    datetime.now().isoformat()
                )
                
                # Also update agent status
                status = await self.get_agent_status()
                await self.redis.hset(
                    'agent_status',
                    self.agent_id,
                    json.dumps(status)
                )
                
            except Exception as e:
                logger.warning(f"Heartbeat failed: {str(e)}")
            
            await asyncio.sleep(10)  # Every 10 seconds
    
    async def get_agent_status(self) -> Dict[str, Any]:
        """Get current agent status"""
        try:
            response = await self.http_client.get(f"{self.agent_url}/health")
            response.raise_for_status()
            return response.json()
        except:
            return {
                'status': 'unknown',
                'timestamp': datetime.now().isoformat()
            }
    
    async def stop(self):
        """Stop the client"""
        self.running = False
        
        # Clean up connections
        if self.amqp_connection:
            await self.amqp_connection.close()
        
        if self.redis:
            self.redis.close()
            await self.redis.wait_closed()
        
        await self.http_client.aclose()
        
        logger.info(f"Agent {self.agent_id} disconnected")


async def main():
    """Example usage"""
    # Get configuration from environment
    agent_id = os.getenv('AGENT_ID', 'test-agent')
    amqp_url = os.getenv('AMQP_URL', 'amqp://guest:guest@localhost/')
    redis_url = os.getenv('REDIS_URL', 'redis://localhost')
    
    # Create client
    client = OrchestratorClient(agent_id, amqp_url, redis_url)
    
    # Connect
    await client.connect()
    
    # Report capabilities
    await client.report_capabilities({
        'task_types': ['coding', 'analysis'],
        'max_concurrent': 2,
        'specializations': ['python', 'typescript']
    })
    
    # Start heartbeat
    heartbeat_task = asyncio.create_task(client.heartbeat())
    
    try:
        # Start processing tasks
        await client.start()
    finally:
        # Cleanup
        await client.stop()
        heartbeat_task.cancel()


if __name__ == "__main__":
    asyncio.run(main())