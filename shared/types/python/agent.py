"""Agent-related Type Definitions"""

from typing import Dict, List, Optional, Any, Literal, Union
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum

from .base import JSONSchema, Metadata, Priority, Status

# Agent capability category
class AgentCapabilityCategory(str, Enum):
    REASONING = "reasoning"
    GENERATION = "generation"
    ANALYSIS = "analysis"
    TRANSFORMATION = "transformation"
    IO = "io"
    COORDINATION = "coordination"

# Agent capability
class AgentCapability(BaseModel):
    """Agent capability definition"""
    id: str
    name: str
    description: str
    category: AgentCapabilityCategory
    required_tools: Optional[List[str]] = Field(None, alias="requiredTools")
    required_agents: Optional[List[str]] = Field(None, alias="requiredAgents")
    input_schema: Optional[JSONSchema] = Field(None, alias="inputSchema")
    output_schema: Optional[JSONSchema] = Field(None, alias="outputSchema")

# Agent role
class AgentRole(BaseModel):
    """Agent role definition"""
    id: str
    name: str
    description: str
    capabilities: List[str]
    constraints: Optional[List[str]] = None
    expertise: Optional[List[str]] = None
    prompting_technique: Optional[str] = Field(None, alias="promptingTechnique")

# Retry policy
class RetryPolicy(BaseModel):
    """Retry policy configuration"""
    max_attempts: int = Field(alias="maxAttempts")
    backoff_ms: int = Field(alias="backoffMs")
    exponential_backoff: Optional[bool] = Field(None, alias="exponentialBackoff")
    retryable_errors: Optional[List[str]] = Field(None, alias="retryableErrors")

# Memory type
class MemoryType(str, Enum):
    SHORT_TERM = "short-term"
    LONG_TERM = "long-term"
    WORKING = "working"
    EPISODIC = "episodic"

# Vector store configuration
class VectorStoreConfig(BaseModel):
    """Vector store configuration"""
    provider: str
    dimensions: int
    similarity_threshold: float = Field(alias="similarityThreshold")

# Memory configuration
class MemoryConfiguration(BaseModel):
    """Memory configuration"""
    type: MemoryType
    max_items: Optional[int] = Field(None, alias="maxItems")
    ttl: Optional[int] = None
    persist_to_disk: Optional[bool] = Field(None, alias="persistToDisk")
    vector_store: Optional[VectorStoreConfig] = Field(None, alias="vectorStore")

# Communication protocol
class CommunicationProtocol(str, Enum):
    JSON_RPC = "json-rpc"
    GRPC = "grpc"
    HTTP = "http"
    WEBSOCKET = "websocket"

# Communication format
class CommunicationFormat(str, Enum):
    JSON = "json"
    PROTOBUF = "protobuf"
    MSGPACK = "msgpack"

# Communication configuration
class CommunicationConfiguration(BaseModel):
    """Communication configuration"""
    protocol: CommunicationProtocol
    format: CommunicationFormat
    compression: Optional[bool] = None
    encryption: Optional[bool] = None

# Model preferences
class ModelPreferences(BaseModel):
    """Model preferences"""
    preferred_models: List[str] = Field(alias="preferredModels")
    fallback_models: Optional[List[str]] = Field(None, alias="fallbackModels")
    temperature: Optional[float] = None
    max_tokens: Optional[int] = Field(None, alias="maxTokens")
    top_p: Optional[float] = Field(None, alias="topP")
    frequency_penalty: Optional[float] = Field(None, alias="frequencyPenalty")
    presence_penalty: Optional[float] = Field(None, alias="presencePenalty")

# Agent configuration
class AgentConfiguration(BaseModel):
    """Agent configuration"""
    max_concurrent_tasks: Optional[int] = Field(None, alias="maxConcurrentTasks")
    timeout: Optional[int] = None
    retry_policy: Optional[RetryPolicy] = Field(None, alias="retryPolicy")
    memory: Optional[MemoryConfiguration] = None
    communication: Optional[CommunicationConfiguration] = None
    prompt_template: Optional[str] = Field(None, alias="promptTemplate")
    model_preferences: Optional[ModelPreferences] = Field(None, alias="modelPreferences")

# Agent definition
class Agent(BaseModel):
    """Agent definition"""
    id: str
    name: str
    description: str
    version: str
    role: AgentRole
    capabilities: List[AgentCapability]
    tools: List[str]
    sub_agents: Optional[List[str]] = Field(None, alias="subAgents")
    configuration: Optional[AgentConfiguration] = None
    metadata: Optional[Metadata] = None

# Resource limits
class ResourceLimits(BaseModel):
    """Resource limits for task execution"""
    max_memory: Optional[int] = Field(None, alias="maxMemory")
    max_cpu: Optional[int] = Field(None, alias="maxCpu")
    max_tokens: Optional[int] = Field(None, alias="maxTokens")

# Task constraints
class TaskConstraints(BaseModel):
    """Task execution constraints"""
    timeout: Optional[int] = None
    max_retries: Optional[int] = Field(None, alias="maxRetries")
    required_capabilities: Optional[List[str]] = Field(None, alias="requiredCapabilities")
    resource_limits: Optional[ResourceLimits] = Field(None, alias="resourceLimits")

# Log level
class LogLevel(str, Enum):
    DEBUG = "debug"
    INFO = "info"
    WARN = "warn"
    ERROR = "error"

# Log entry
class LogEntry(BaseModel):
    """Log entry"""
    timestamp: str
    level: LogLevel
    message: str
    data: Optional[Any] = None

# Task artifact
class TaskArtifact(BaseModel):
    """Task execution artifact"""
    name: str
    type: str
    size: Optional[int] = None
    content: Optional[Any] = None
    url: Optional[str] = None
    hash: Optional[str] = None

# Task performance metrics
class TaskPerformance(BaseModel):
    """Task performance metrics"""
    duration: int
    tokens_used: Optional[int] = Field(None, alias="tokensUsed")
    retries: Optional[int] = None

# Task result
class TaskResult(BaseModel):
    """Task execution result"""
    output: Any
    performance: TaskPerformance
    artifacts: Optional[List[TaskArtifact]] = None
    logs: Optional[List[LogEntry]] = None

# Agent task
class AgentTask(BaseModel):
    """Agent task definition"""
    id: str
    agent_id: str = Field(alias="agentId")
    type: str
    priority: Priority
    input: Any
    constraints: Optional[TaskConstraints] = None
    dependencies: Optional[List[str]] = None
    status: Status
    created_at: str = Field(alias="createdAt")
    started_at: Optional[str] = Field(None, alias="startedAt")
    completed_at: Optional[str] = Field(None, alias="completedAt")
    result: Optional[TaskResult] = None

# Agent message type
class AgentMessageType(str, Enum):
    REQUEST = "request"
    RESPONSE = "response"
    EVENT = "event"
    BROADCAST = "broadcast"

# Agent coordination message
class AgentMessage(BaseModel):
    """Agent coordination message"""
    id: str
    from_agent: str = Field(alias="from")
    to_agent: str = Field(alias="to")
    type: AgentMessageType
    subject: str
    content: Any
    metadata: Optional[Metadata] = None
    reply_to: Optional[str] = Field(None, alias="replyTo")
    expires_at: Optional[str] = Field(None, alias="expiresAt")

# Workflow agent node
class WorkflowAgent(BaseModel):
    """Workflow agent node"""
    id: str
    agent_id: str = Field(alias="agentId")
    position: Optional[Dict[str, float]] = None
    configuration: Optional[Any] = None

# Workflow connection
class WorkflowConnection(BaseModel):
    """Workflow connection between agents"""
    from_node: str = Field(alias="from")
    to_node: str = Field(alias="to")
    condition: Optional[str] = None
    transform: Optional[str] = None

# Workflow trigger type
class WorkflowTriggerType(str, Enum):
    MANUAL = "manual"
    SCHEDULE = "schedule"
    EVENT = "event"
    WEBHOOK = "webhook"

# Workflow trigger
class WorkflowTrigger(BaseModel):
    """Workflow trigger configuration"""
    type: WorkflowTriggerType
    configuration: Any

# Workflow output
class WorkflowOutput(BaseModel):
    """Workflow output definition"""
    name: str
    source: str
    transform: Optional[str] = None

# Multi-agent workflow
class AgentWorkflow(BaseModel):
    """Multi-agent workflow definition"""
    id: str
    name: str
    description: str
    agents: List[WorkflowAgent]
    connections: List[WorkflowConnection]
    triggers: Optional[List[WorkflowTrigger]] = None
    outputs: Optional[List[WorkflowOutput]] = None

# Type guards
def is_agent_message(value: Any) -> bool:
    """Check if value is an agent message"""
    return (
        isinstance(value, dict) and
        "id" in value and
        "from" in value and
        "to" in value and
        value.get("type") in ["request", "response", "event", "broadcast"]
    )