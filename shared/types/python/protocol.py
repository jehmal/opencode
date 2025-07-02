"""Protocol-related Type Definitions"""

from typing import Dict, List, Optional, Any, Union, Literal
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum, IntEnum

from .base import Language, Metadata
from .tool import ToolExecutionRequest, ToolExecutionResult
from .command import Command, CommandResult
from .agent import AgentTask, TaskResult

# Message types
class MessageType(str, Enum):
    REQUEST = "request"
    RESPONSE = "response"
    NOTIFICATION = "notification"
    EVENT = "event"
    ERROR = "error"
    HEARTBEAT = "heartbeat"

# Protocol message
class ProtocolMessage(BaseModel):
    """Base protocol message structure"""
    id: str
    protocol: str
    version: str
    type: MessageType
    payload: Any
    metadata: Optional[Metadata] = None
    timestamp: str

# JSON-RPC error
class JsonRpcError(BaseModel):
    """JSON-RPC 2.0 error structure"""
    code: int
    message: str
    data: Optional[Any] = None

# JSON-RPC request
class JsonRpcRequest(BaseModel):
    """JSON-RPC 2.0 request"""
    jsonrpc: Literal["2.0"]
    id: Union[str, int]
    method: str
    params: Optional[Any] = None

# JSON-RPC response
class JsonRpcResponse(BaseModel):
    """JSON-RPC 2.0 response"""
    jsonrpc: Literal["2.0"]
    id: Union[str, int]
    result: Optional[Any] = None
    error: Optional[JsonRpcError] = None

# Request types
class RequestType(str, Enum):
    CODE_GENERATION = "code_generation"
    TEST_GENERATION = "test_generation"
    PROMPT_OPTIMIZATION = "prompt_optimization"
    EVALUATION = "evaluation"
    TOOL_EXECUTION = "tool_execution"
    COMMAND_EXECUTION = "command_execution"
    AGENT_TASK = "agent_task"
    WORKFLOW_EXECUTION = "workflow_execution"

# Response types
class ResponseType(str, Enum):
    SUCCESS = "success"
    ERROR = "error"
    PARTIAL = "partial"
    PROGRESS = "progress"
    STREAM = "stream"

# Request context
class RequestContext(BaseModel):
    """Request execution context"""
    session_id: Optional[str] = Field(None, alias="sessionId")
    user_id: Optional[str] = Field(None, alias="userId")
    workspace_id: Optional[str] = Field(None, alias="workspaceId")
    project_id: Optional[str] = Field(None, alias="projectId")
    environment: Optional[Dict[str, str]] = None
    timeout: Optional[int] = None
    priority: Optional[int] = None

# Code context
class CodeContext(BaseModel):
    """Code generation context"""
    files: Optional[List[str]] = None
    dependencies: Optional[List[str]] = None
    imports: Optional[List[str]] = None
    variables: Optional[Dict[str, Any]] = None

# Code constraints
class CodeConstraints(BaseModel):
    """Code generation constraints"""
    max_tokens: Optional[int] = Field(None, alias="maxTokens")
    temperature: Optional[float] = None
    style: Optional[str] = None
    patterns: Optional[List[str]] = None
    anti_patterns: Optional[List[str]] = Field(None, alias="antiPatterns")

# Code example
class CodeExample(BaseModel):
    """Code generation example"""
    input: str
    output: str
    explanation: Optional[str] = None

# Code generation payload
class CodeGenerationPayload(BaseModel):
    """Code generation request payload"""
    prompt: str
    language: Language
    context: Optional[CodeContext] = None
    constraints: Optional[CodeConstraints] = None
    examples: Optional[List[CodeExample]] = None

# Code metrics
class CodeMetrics(BaseModel):
    """Code quality metrics"""
    lines: int
    complexity: int
    tokens: int
    estimated_time: Optional[float] = Field(None, alias="estimatedTime")

# Code generation result
class CodeGenerationResult(BaseModel):
    """Code generation response"""
    code: str
    language: Language
    explanation: Optional[str] = None
    confidence: float
    alternatives: Optional[List[Dict[str, Any]]] = None
    metrics: Optional[CodeMetrics] = None

# Test framework
class TestFramework(str, Enum):
    JEST = "jest"
    PYTEST = "pytest"
    JUNIT = "junit"
    GO_TEST = "go_test"
    RSPEC = "rspec"
    MOCHA = "mocha"
    VITEST = "vitest"

# Test type
class TestType(str, Enum):
    UNIT = "unit"
    INTEGRATION = "integration"
    E2E = "e2e"

# Coverage requirements
class CoverageRequirements(BaseModel):
    """Test coverage requirements"""
    target: Optional[float] = None
    types: Optional[List[TestType]] = None
    focus_areas: Optional[List[str]] = Field(None, alias="focusAreas")

# Test generation payload
class TestGenerationPayload(BaseModel):
    """Test generation request payload"""
    code: str
    language: Language
    framework: TestFramework
    coverage: Optional[CoverageRequirements] = None

# Coverage report
class CoverageReport(BaseModel):
    """Test coverage report"""
    lines: float
    branches: float
    functions: float
    statements: float

# Test generation result
class TestGenerationResult(BaseModel):
    """Test generation response"""
    tests: str
    framework: TestFramework
    coverage: CoverageReport
    suggestions: Optional[List[str]] = None

# Prompt example
class PromptExample(BaseModel):
    """Prompt optimization example"""
    input: str
    output: str
    score: Optional[float] = None

# Prompt constraints
class PromptConstraints(BaseModel):
    """Prompt optimization constraints"""
    max_length: Optional[int] = Field(None, alias="maxLength")
    techniques: Optional[List[str]] = None
    target_model: Optional[str] = Field(None, alias="targetModel")

# Prompt optimization payload
class PromptOptimizationPayload(BaseModel):
    """Prompt optimization request payload"""
    original_prompt: str = Field(alias="originalPrompt")
    objective: str
    technique: Optional[str] = None
    examples: Optional[List[PromptExample]] = None
    constraints: Optional[PromptConstraints] = None

# Prompt optimization result
class PromptOptimizationResult(BaseModel):
    """Prompt optimization response"""
    optimized_prompt: str = Field(alias="optimizedPrompt")
    technique: str
    improvements: List[str]
    score: float
    alternatives: Optional[List[Dict[str, Any]]] = None

# Evaluation metric
class EvaluationMetric(str, Enum):
    CORRECTNESS = "correctness"
    PERFORMANCE = "performance"
    READABILITY = "readability"
    MAINTAINABILITY = "maintainability"
    SECURITY = "security"
    EFFICIENCY = "efficiency"

# Evaluation environment
class EvaluationEnvironment(BaseModel):
    """Evaluation execution environment"""
    runtime: str
    version: str
    dependencies: Dict[str, str]
    configuration: Optional[Dict[str, Any]] = None

# Evaluation payload
class EvaluationPayload(BaseModel):
    """Evaluation request payload"""
    code: str
    tests: List[str]
    metrics: Optional[List[EvaluationMetric]] = None
    environment: Optional[EvaluationEnvironment] = None

# Code location
class CodeLocation(BaseModel):
    """Code issue location"""
    file: Optional[str] = None
    line: int
    column: Optional[int] = None

# Issue type
class IssueType(str, Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"

# Issue
class Issue(BaseModel):
    """Code issue details"""
    type: IssueType
    metric: EvaluationMetric
    message: str
    location: Optional[CodeLocation] = None
    suggestion: Optional[str] = None

# Metric result
class MetricResult(BaseModel):
    """Individual metric evaluation result"""
    score: float
    details: str
    sub_metrics: Optional[Dict[str, float]] = Field(None, alias="subMetrics")

# Evaluation result
class EvaluationResult(BaseModel):
    """Evaluation response"""
    passed: bool
    score: float
    metrics: Dict[EvaluationMetric, MetricResult]
    issues: Optional[List[Issue]] = None
    suggestions: Optional[List[str]] = None

# Workflow execution payload
class WorkflowExecutionPayload(BaseModel):
    """Workflow execution request payload"""
    workflow_id: str = Field(alias="workflowId")
    input: Any
    configuration: Optional[Dict[str, Any]] = None

# Workflow step status
class WorkflowStepStatus(str, Enum):
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"

# Workflow step result
class WorkflowStepResult(BaseModel):
    """Workflow step execution result"""
    step_id: str = Field(alias="stepId")
    status: WorkflowStepStatus
    output: Optional[Any] = None
    error: Optional[Any] = None
    duration: int

# Workflow status
class WorkflowStatus(str, Enum):
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"

# Workflow execution result
class WorkflowExecutionResult(BaseModel):
    """Workflow execution response"""
    workflow_id: str = Field(alias="workflowId")
    execution_id: str = Field(alias="executionId")
    status: WorkflowStatus
    outputs: Dict[str, Any]
    steps: List[WorkflowStepResult]

# Request payload union
RequestPayload = Union[
    CodeGenerationPayload,
    TestGenerationPayload,
    PromptOptimizationPayload,
    EvaluationPayload,
    ToolExecutionRequest,
    Command,
    AgentTask,
    WorkflowExecutionPayload
]

# Response payload union
ResponsePayload = Union[
    CodeGenerationResult,
    TestGenerationResult,
    PromptOptimizationResult,
    EvaluationResult,
    ToolExecutionResult,
    CommandResult,
    TaskResult,
    WorkflowExecutionResult
]

# OpenCode-DGM request
class OpenCodeDGMRequest(BaseModel):
    """OpenCode-DGM protocol request"""
    id: str
    type: RequestType
    payload: RequestPayload
    context: Optional[RequestContext] = None
    metadata: Optional[Metadata] = None

# OpenCode-DGM response
class OpenCodeDGMResponse(BaseModel):
    """OpenCode-DGM protocol response"""
    id: str
    request_id: str = Field(alias="requestId")
    type: ResponseType
    payload: ResponsePayload
    metadata: Optional[Metadata] = None

# Protocol error codes
class ProtocolErrorCode(IntEnum):
    """Protocol-specific error codes"""
    PARSE_ERROR = -32700
    INVALID_REQUEST = -32600
    METHOD_NOT_FOUND = -32601
    INVALID_PARAMS = -32602
    INTERNAL_ERROR = -32603
    
    # Custom error codes
    AUTHENTICATION_REQUIRED = -32000
    AUTHORIZATION_FAILED = -32001
    RATE_LIMIT_EXCEEDED = -32002
    RESOURCE_NOT_FOUND = -32003
    RESOURCE_CONFLICT = -32004
    VALIDATION_ERROR = -32005
    TIMEOUT_ERROR = -32006
    EXECUTION_ERROR = -32007

# Type guards
def is_json_rpc_request(value: Any) -> bool:
    """Check if value is a JSON-RPC request"""
    return (
        isinstance(value, dict) and
        value.get("jsonrpc") == "2.0" and
        "id" in value and
        "method" in value
    )

def is_json_rpc_response(value: Any) -> bool:
    """Check if value is a JSON-RPC response"""
    return (
        isinstance(value, dict) and
        value.get("jsonrpc") == "2.0" and
        "id" in value and
        ("result" in value or "error" in value)
    )