import type {
  PromptingTechnique,
  TechniqueContext,
  EnhancedPrompt,
  TaskType,
  Capability,
} from "../../types"

export class PromptChainingTechnique implements PromptingTechnique {
  id = "prompt-chaining"
  name = "Prompt Chaining"
  category = "advanced" as const
  description =
    "Break complex tasks into sequential subtasks, using outputs as inputs for subsequent steps"
  complexity = "high" as const
  requiredCapabilities: Capability[] = ["iteration"]

  template = `# Prompt Chaining Framework

## Task Decomposition
Original task: {task},

### Chain Design
Breaking down into sequential subtasks:

#### Chain Step 1: {step1_name},
**Objective**: {step1_objective},
**Input**: {step1_input},
**Expected Output**: {step1_output},
**Validation**: {step1_validation},

#### Chain Step 2: {step2_name},
**Objective**: {step2_objective},
**Input**: Output from Step 1
**Expected Output**: {step2_output},
**Validation**: {step2_validation},

#### Chain Step 3: {step3_name},
**Objective**: {step3_objective},
**Input**: Output from Step 2
**Expected Output**: {step3_output},
**Validation**: {step3_validation},

{additional_steps},

## Chain Execution

### Step 1 Execution: {step1_name},
{step1_execution},

**Step 1 Result**:
{step1_result},

### Step 2 Execution: {step2_name},
Using result from Step 1:
{step2_execution},

**Step 2 Result**:
{step2_result},

### Step 3 Execution: {step3_name},
Using result from Step 2:
{step3_execution},

**Step 3 Result**:
{step3_result},

{additional_executions},

## Chain Integration

### Final Synthesis
Combining all chain outputs:
{synthesis},

### Quality Verification
- Chain coherence: {coherence_check},
- Information preservation: {preservation_check},
- Goal achievement: {goal_check},

## Final Output
{final_output},

### Chain Metadata
- Total steps: {total_steps},
- Successful steps: {successful_steps},
- Chain efficiency: {efficiency}%`

  examples = [
    {
      input: "Create a comprehensive API documentation system with examples",
      output: `# Prompt Chaining Framework

## Task Decomposition
Original task: Create a comprehensive API documentation system with examples

### Chain Design
Breaking down into sequential subtasks:

#### Chain Step 1: API Analysis
**Objective**: Analyze API structure and extract endpoints
**Input**: API codebase or specification
**Expected Output**: Structured list of endpoints with parameters
**Validation**: All endpoints discovered and categorized

#### Chain Step 2: Documentation Generation
**Objective**: Generate detailed documentation for each endpoint
**Input**: Structured endpoint list from Step 1
**Expected Output**: Markdown documentation with descriptions
**Validation**: Each endpoint fully documented

#### Chain Step 3: Example Creation
**Objective**: Create realistic examples for each endpoint
**Input**: Documentation from Step 2
**Expected Output**: Code examples in multiple languages
**Validation**: Examples are executable and cover edge cases

#### Chain Step 4: Integration & Formatting
**Objective**: Combine all elements into cohesive documentation
**Input**: Documentation and examples from Steps 2-3
**Expected Output**: Complete API documentation system
**Validation**: Professional format, easy navigation

## Chain Execution

### Step 1 Execution: API Analysis
Scanning codebase for API endpoints...

**Step 1 Result**:
\`\`\`json
{
  "endpoints": [
    {
      "path": "/api/users",
      "method": "GET",
      "parameters": ["limit", "offset", "filter"],
      "authentication": "required"
    },
    {
      "path": "/api/users/:id",
      "method": "GET",
      "parameters": ["id"],
      "authentication": "required"
    },
    {
      "path": "/api/users",
      "method": "POST",
      "body": ["name", "email", "role"],
      "authentication": "required"
    },
  ]
},
\`\`\`

### Step 2 Execution: Documentation Generation
Using endpoint structure to generate documentation...

**Step 2 Result**:
\`\`\`markdown
## GET /api/users
Retrieve a paginated list of users.

### Parameters
- \`limit\` (integer, optional): Maximum number of users to return (default: 20)
- \`offset\` (integer, optional): Number of users to skip (default: 0)
- \`filter\` (string, optional): Filter users by name or email

### Response
Returns an array of user objects with pagination metadata.

### Authentication
Bearer token required in Authorization header.
\`\`\`

### Step 3 Execution: Example Creation
Generating examples based on documentation...

**Step 3 Result**:
\`\`\`javascript
// JavaScript Example
const getUsers = async (limit = 20, offset = 0) => {
  const response = await fetch(\`/api/users?limit=\${limit}&offset=\${offset}\`, {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN'
    },
  });
  return response.json();
};

// Usage
const users = await getUsers(10, 0);
console.log(users);
\`\`\`

\`\`\`python
# Python Example
import requests

def get_users(limit=20, offset=0, token=None):
    headers = {'Authorization': f'Bearer {token}'},
    params = {'limit': limit, 'offset': offset},
    
    response = requests.get('/api/users', headers=headers, params=params)
    return response.json()

# Usage
users = get_users(limit=10, offset=0, token='YOUR_TOKEN')
print(users)
\`\`\`

### Step 4 Execution: Integration & Formatting
Combining all documentation elements...

**Step 4 Result**:
Complete API documentation with:
- Interactive table of contents
- Endpoint descriptions with parameters
- Authentication requirements
- Code examples in multiple languages
- Error handling documentation
- Rate limiting information

## Chain Integration

### Final Synthesis
All chain outputs combined into a comprehensive documentation system featuring:
1. Auto-generated from code analysis
2. Detailed endpoint documentation
3. Executable examples in 5 languages
4. Interactive API explorer
5. Version history tracking

### Quality Verification
- Chain coherence: ✓ Each step built upon previous results
- Information preservation: ✓ No data lost between steps
- Goal achievement: ✓ Complete documentation system created

## Final Output
[Complete API Documentation System with 25 endpoints, 125 examples, and interactive features]

### Chain Metadata
- Total steps: 4
- Successful steps: 4
- Chain efficiency: 95%`,
    },
  ]

  suitableFor: TaskType[] = ["generation", "analysis", "problem_solving"]

  metrics = {
    totalExecutions: 0,
    successRate: 0,
    averageLatency: 0,
    averageTokenUsage: 0,
    lastUpdated: Date.now(),
  }

  async apply(context: TechniqueContext): Promise<EnhancedPrompt> {
    const { task } = context

    const prompt = this.template!.replace("{task}", task)
      .replace("{step1_name}", "Initial Analysis")
      .replace("{step1_objective}", "Understand and structure the problem")
      .replace("{step1_input}", "Original task description")
      .replace("{step1_output}", "Structured problem breakdown")
      .replace("{step1_validation}", "All aspects identified")
      .replace("{step2_name}", "Core Implementation")
      .replace("{step2_objective}", "Implement main functionality")
      .replace("{step2_output}", "Working solution")
      .replace("{step2_validation}", "Meets requirements")
      .replace("{step3_name}", "Enhancement & Polish")
      .replace("{step3_objective}", "Refine and optimize")
      .replace("{step3_output}", "Polished final result")
      .replace("{step3_validation}", "Quality standards met")
      .replace("{additional_steps}", "")
      .replace("{step1_execution}", "Analyzing task requirements...")
      .replace("{step1_result}", "[Structured analysis]")
      .replace("{step2_execution}", "Implementing based on analysis...")
      .replace("{step2_result}", "[Core implementation]")
      .replace("{step3_execution}", "Enhancing and polishing...")
      .replace("{step3_result}", "[Final polished result]")
      .replace("{additional_executions}", "")
      .replace("{synthesis}", "Integrated solution combining all steps")
      .replace("{coherence_check}", "✓ Logical flow maintained")
      .replace("{preservation_check}", "✓ All information preserved")
      .replace("{goal_check}", "✓ Original goal achieved")
      .replace("{final_output}", "[Complete solution]")
      .replace("{total_steps}", "3")
      .replace("{successful_steps}", "3")
      .replace("{efficiency}", "92")

    return {
      content: prompt,
      metadata: {
        techniques: ["prompt-chaining"],
        confidence: 0.87,
        estimatedTokens: 1600,
        compositionStrategy: "sequential",
      },
      variables: {},
    }
  }

  validate(input: unknown): boolean {
    return typeof input === "string" && input.length > 10
  }
}

// Keep the const export for backward compatibility
export const promptChaining = new PromptChainingTechnique()
