import type {
  PromptingTechnique,
  TechniqueContext,
  EnhancedPrompt,
  TaskType,
  Capability,
} from "../../types"

export class ProgramAidedLanguageTechnique implements PromptingTechnique {
  id = "pal"
  name = "Program-Aided Language (PAL)"
  category = "reasoning" as const
  description =
    "Generates executable programs as intermediate reasoning steps to solve problems"

  complexity = "high" as const
  suitableFor: TaskType[] = ["problem_solving", "analysis"]
  requiredCapabilities: Capability[] = ["tools"]

  metrics = {
    totalExecutions: 0,
    successRate: 0.88,
    averageLatency: 20,
    averageTokenUsage: 1000,
    lastUpdated: Date.now(),
  }

  template = `Let's solve this problem by writing and reasoning about code:

{{task}}

Step 1: Problem Analysis
[Understand what needs to be computed or solved]

Step 2: Algorithm Design
[Design the approach and identify required data structures]

Step 3: Code Implementation
\`\`\`{{language}}
# Write the solution code here
# Include comments explaining the logic
\`\`\`

Step 4: Trace Through Execution
[Walk through the code execution with example inputs]

Step 5: Verify and Optimize
[Check correctness and consider optimizations]

Remember: Generate actual executable code that solves the problem, not pseudocode.`

  examples = [
    {
      input:
        "Calculate the compound interest for $1000 at 5% annual rate over 3 years, compounded monthly",
      output: `Let's solve this problem by writing and reasoning about code:

Step 1: Problem Analysis
We need to calculate compound interest with:
- Principal (P) = $1000
- Annual rate (r) = 5% = 0.05
- Time (t) = 3 years
- Compounding frequency (n) = 12 (monthly)

Step 2: Algorithm Design
Use the compound interest formula: A = P(1 + r/n)^(nt)
Where A is the final amount, and interest = A - P

Step 3: Code Implementation
\`\`\`python
def calculate_compound_interest(principal, annual_rate, years, compounds_per_year):
    """
    Calculate compound interest and return final amount and interest earned.
    
    Args:
        principal: Initial investment amount
        annual_rate: Annual interest rate as decimal (5% = 0.05)
        years: Number of years
        compounds_per_year: How many times interest compounds per year
    
    Returns:
        tuple: (final_amount, interest_earned)
    """
    # Apply compound interest formula
    final_amount = principal * (1 + annual_rate / compounds_per_year) ** (compounds_per_year * years)
    
    # Calculate interest earned
    interest_earned = final_amount - principal
    
    return final_amount, interest_earned

# Solve the specific problem
principal = 1000
annual_rate = 0.05
years = 3
compounds_per_year = 12

final_amount, interest = calculate_compound_interest(principal, annual_rate, years, compounds_per_year)

print("Principal: $" + "{:,.2f}".format(principal))
print("Annual Rate: " + str(annual_rate * 100) + "%")
print("Time: " + str(years) + " years")
print("Compounding: Monthly (" + str(compounds_per_year) + " times/year)")
print("Final Amount: $" + "{:,.2f}".format(final_amount))
print("Interest Earned: $" + "{:,.2f}".format(interest))
\`\`\`

Step 4: Trace Through Execution
- Rate per period: 0.05 / 12 = 0.004167
- Total periods: 12 × 3 = 36
- Growth factor: (1 + 0.004167)^36 = 1.1614
- Final amount: $1000 × 1.1614 = $1161.40
- Interest: $1161.40 - $1000 = $161.40

Step 5: Verify and Optimize
The code correctly implements the compound interest formula. The result shows that $1000 invested at 5% annual rate compounded monthly for 3 years grows to $1161.40, earning $161.40 in interest.`,
    },
    {
      input: "Find all prime numbers up to 100 using the Sieve of Eratosthenes",
      output: `Let's solve this problem by writing and reasoning about code:

Step 1: Problem Analysis
We need to find all prime numbers up to 100 using the Sieve of Eratosthenes algorithm, which efficiently finds all primes up to a given limit by iteratively marking multiples of each prime as composite.

Step 2: Algorithm Design
1. Create a boolean array of size n+1, initially all true
2. Start with the smallest prime (2)
3. Mark all multiples of each prime as composite
4. Move to the next unmarked number and repeat
5. All unmarked numbers are prime

Step 3: Code Implementation
\`\`\`python
def sieve_of_eratosthenes(limit):
    """
    Find all prime numbers up to the given limit using the Sieve of Eratosthenes.
    
    Args:
        limit: Upper bound (inclusive) for finding primes
    
    Returns:
        list: All prime numbers up to limit
    """
    # Create a boolean array "is_prime" and initialize all entries as true
    is_prime = [True] * (limit + 1)
    is_prime[0] = is_prime[1] = False  # 0 and 1 are not prime
    
    # Start with the smallest prime number, 2
    p = 2
    while p * p <= limit:
        # If is_prime[p] is not changed, then it's a prime
        if is_prime[p]:
            # Mark all multiples of p as not prime
            for i in range(p * p, limit + 1, p):
                is_prime[i] = False
        p += 1
    
    # Collect all prime numbers
    primes = [num for num in range(2, limit + 1) if is_prime[num]]
    return primes

# Find all primes up to 100
primes_up_to_100 = sieve_of_eratosthenes(100)

print("Prime numbers up to 100: " + str(len(primes_up_to_100)) + " found")
print("First 10 primes: " + str(primes_up_to_100[:10]))
print("Last 10 primes: " + str(primes_up_to_100[-10:]))
print("\\nAll primes up to 100:")
for i in range(0, len(primes_up_to_100), 10):
    print(" ".join("{:3d}".format(p) for p in primes_up_to_100[i:i+10]))
\`\`\`

Step 4: Trace Through Execution
- Initialize: [True] * 101, mark 0 and 1 as False
- p=2: Mark 4,6,8,10...100 as False (multiples of 2)
- p=3: Mark 9,12,15,18...99 as False (multiples of 3)
- p=5: Mark 25,30,35...100 as False (multiples of 5)
- p=7: Mark 49,56,63...98 as False (multiples of 7)
- Continue until p² > 100 (p > 10)

Step 5: Verify and Optimize
The algorithm has O(n log log n) time complexity, making it very efficient for finding all primes up to a limit. The implementation correctly identifies all 25 prime numbers up to 100: 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97.`,
    },
  ]

  async apply(context: TechniqueContext): Promise<EnhancedPrompt> {
    // Determine the programming language based on context
    const language =
      context.variables["language"] ||
      this.inferLanguage(context.task) ||
      "python"

    // Replace template variables
    let content = this.template
      .replace("{{task}}", context.task)
      .replace("{{language}}", language)

    // Add language-specific hints
    if (language === "python") {
      content +=
        "\n\nUse Python's built-in functions and libraries where appropriate."
    } else if (language === "javascript") {
      content += "\n\nUse modern JavaScript (ES6+) features where appropriate."
    }

    // Add domain-specific context
    if (context.variables["domain"]) {
      content = `Domain: ${context.variables["domain"]}\n\n${content}`
    }

    // Add examples for complex tasks
    const taskComplexity = this.assessTaskComplexity(context.task)
    if (taskComplexity > 0.6 && this.examples.length > 0) {
      const relevantExample = this.selectRelevantExample(context.task)
      if (relevantExample) {
        content = `Example of program-aided reasoning:\n${relevantExample.output}\n\nNow for your task:\n\n${content}`
      }
    }

    // Add execution reminder if tools are available
    if (context.variables["hasExecutionCapability"]) {
      content +=
        "\n\nNote: After writing the code, execute it to verify the solution."
    }

    return {
      content,
      metadata: {
        techniques: [this.id],
        confidence: 0.88,
        estimatedTokens: Math.ceil(content.split(/\s+/).length * 1.5),
        compositionStrategy: "single",
      },
      variables: {
        ...context.variables,
        techniqueApplied: this.id,
        preferredLanguage: language,
      },
    }
  }

  validate(input: any): boolean {
    // Validate that input is suitable for PAL
    if (typeof input !== "string") return false

    // Check minimum length
    if (input.length < 30) return false

    // Check for computational/algorithmic indicators
    const computationalIndicators = [
      "calculate",
      "compute",
      "algorithm",
      "find all",
      "generate",
      "optimize",
      "implement",
      "solve",
      "formula",
      "equation",
      "function",
      "program",
      "code",
    ]

    const hasComputationalNature = computationalIndicators.some((indicator) =>
      input.toLowerCase().includes(indicator),
    )

    // Check for mathematical/numerical content
    const hasMathematical =
      /\d+|percent|rate|interest|prime|factorial|fibonacci/i.test(input)

    return hasComputationalNature || hasMathematical
  }

  private assessTaskComplexity(task: string): number {
    let score = 0

    // Length factor
    if (task.length > 100) score += 0.2
    if (task.length > 200) score += 0.2

    // Algorithmic complexity indicators
    if (/algorithm|optimize|efficient|complexity/i.test(task)) score += 0.3

    // Mathematical operations
    if (/calculate|compute|solve|equation/i.test(task)) score += 0.2

    // Multiple requirements
    if (/and|also|then|with/i.test(task)) score += 0.1

    return Math.min(score, 1)
  }

  private inferLanguage(task: string): string | null {
    // Infer programming language from task context
    const taskLower = task.toLowerCase()

    if (
      taskLower.includes("javascript") ||
      taskLower.includes("node") ||
      taskLower.includes("react")
    ) {
      return "javascript"
    }
    if (
      taskLower.includes("python") ||
      taskLower.includes("numpy") ||
      taskLower.includes("pandas")
    ) {
      return "python"
    }
    if (taskLower.includes("java") && !taskLower.includes("javascript")) {
      return "java"
    }
    if (taskLower.includes("c++") || taskLower.includes("cpp")) {
      return "cpp"
    }
    if (taskLower.includes("rust")) {
      return "rust"
    }
    if (taskLower.includes("go") || taskLower.includes("golang")) {
      return "go"
    }

    // Default to Python for general computational tasks
    return "python"
  }

  private selectRelevantExample(
    task: string,
  ): { input: string; output: string } | null {
    const taskLower = task.toLowerCase()

    // Select example based on task content
    for (const example of this.examples) {
      const exampleLower = example.input.toLowerCase()

      // Check for keyword matches
      const taskKeywords = taskLower.split(/\s+/)
      const exampleKeywords = exampleLower.split(/\s+/)

      const matchCount = taskKeywords.filter(
        (keyword: string) =>
          exampleKeywords.includes(keyword) && keyword.length > 3,
      ).length

      if (matchCount >= 2) {
        return example
      }
    }

    // Return first example as fallback for complex tasks
    return this.examples[0]
  }
}
