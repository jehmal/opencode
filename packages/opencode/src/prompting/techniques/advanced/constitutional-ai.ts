import type {
  PromptingTechnique,
  TechniqueContext,
  EnhancedPrompt,
  TaskType,
  Capability,
} from "../../types"

export class ConstitutionalAITechnique implements PromptingTechnique {
  id = "constitutional-ai"
  name = "Constitutional AI"
  category = "advanced" as const
  description =
    "Self-critique and improvement using constitutional principles for ethical and high-quality outputs"
  complexity = "very_high" as const
  requiredCapabilities: Capability[] = ["self_reflection"]

  template = `# Constitutional AI Framework

## Initial Response Generation
First, I'll provide my initial response to: {task}

### Initial Response:
{initial_response_placeholder}

## Constitutional Review
Now I'll review my response against these constitutional principles:

### Principle 1: Accuracy and Truthfulness
- Is my response factually accurate?
- Have I avoided speculation or misinformation?
- Are my claims verifiable?

### Principle 2: Helpfulness and Relevance
- Does my response directly address the user's needs?
- Is it comprehensive yet focused?
- Have I provided actionable information?

### Principle 3: Safety and Ethics
- Is my response safe and responsible?
- Have I avoided harmful content or suggestions?
- Does it respect user privacy and security?

### Principle 4: Clarity and Accessibility
- Is my language clear and appropriate for the audience?
- Have I structured information logically?
- Are technical concepts explained well?

### Principle 5: Objectivity and Balance
- Have I presented multiple perspectives where relevant?
- Am I avoiding unwarranted bias?
- Is my tone professional and neutral?

## Self-Critique Analysis
Based on these principles, here are issues I've identified:

1. **Accuracy Issues**: {accuracy_critique}
2. **Helpfulness Gaps**: {helpfulness_critique}
3. **Safety Concerns**: {safety_critique}
4. **Clarity Problems**: {clarity_critique}
5. **Objectivity Issues**: {objectivity_critique}

## Revised Response
Incorporating my constitutional review, here's my improved response:

{final_response}

## Confidence Assessment
- Overall confidence in revised response: {confidence_score}/10
- Areas still needing improvement: {improvement_areas}
- Principles fully satisfied: {satisfied_principles}`

  examples = [
    {
      input: "Write code to scrape data from websites",
      output: `# Constitutional AI Framework

## Initial Response Generation
First, I'll provide my initial response to: Write code to scrape data from websites

### Initial Response:
Here's a Python script using BeautifulSoup to scrape data from any website...

## Constitutional Review

### Principle 1: Accuracy and Truthfulness
- The code is technically correct
- However, I should mention legal considerations
- Need to include rate limiting best practices

### Principle 2: Helpfulness and Relevance
- Code examples are practical
- Missing error handling
- Should include robots.txt checking

### Principle 3: Safety and Ethics
- CRITICAL: Must emphasize legal and ethical considerations
- Need to mention website terms of service
- Should promote responsible scraping

### Principle 4: Clarity and Accessibility
- Code is well-commented
- Could add more explanation for beginners
- Examples are clear

### Principle 5: Objectivity and Balance
- Should present alternatives (APIs, datasets)
- Need to discuss when NOT to scrape
- Balance technical capability with responsibility

## Self-Critique Analysis

1. **Accuracy Issues**: Need to add information about robots.txt, rate limiting, and legal frameworks
2. **Helpfulness Gaps**: Missing error handling, retry logic, and data storage best practices
3. **Safety Concerns**: Initial response didn't adequately address legal/ethical considerations
4. **Clarity Problems**: Could better explain BeautifulSoup concepts for beginners
5. **Objectivity Issues**: Focused too much on "how" without discussing "whether you should"

## Revised Response

I'll help you understand web scraping, but first, let's discuss important considerations:

**Legal and Ethical Guidelines:**
1. Always check the website's Terms of Service
2. Respect robots.txt files
3. Use official APIs when available
4. Don't overload servers with requests

**Responsible Web Scraping Example:**

\`\`\`python
import requests
from bs4 import BeautifulSoup
import time
from urllib.robotparser import RobotFileParser

def can_fetch(url):
    """Check if we're allowed to scrape this URL"""
    rp = RobotFileParser()
    rp.set_url(url + "/robots.txt")
    rp.read()
    return rp.can_fetch("*", url)

def respectful_scrape(url, wait_time=1):
    """Scrape responsibly with rate limiting"""
    if not can_fetch(url):
        print(f"Scraping not allowed for {url}")
        return None
    
    try:
        # Add headers to identify your bot
        headers = {
            'User-Agent': 'YourBot/1.0 (your@email.com)'
        }
        
        # Make request
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        # Parse content
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Wait before next request
        time.sleep(wait_time)
        
        return soup
        
    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return None
\`\`\`

**Better Alternatives:**
1. Check if the site offers an API
2. Look for existing datasets
3. Contact the website owner for permission
4. Use services like Common Crawl for web data

Remember: Just because you CAN scrape doesn't mean you SHOULD. Always prioritize ethical data collection.

## Confidence Assessment
- Overall confidence in revised response: 9/10
- Areas still needing improvement: Could add more specific legal jurisdiction information
- Principles fully satisfied: Accuracy, Safety, Ethics, Clarity, Balance`,
    },
  ]

  suitableFor: TaskType[] = ["analysis", "generation", "refinement"]

  metrics = {
    totalExecutions: 0,
    successRate: 0,
    averageLatency: 0,
    averageTokenUsage: 0,
    lastUpdated: Date.now(),
  }

  async apply(context: TechniqueContext): Promise<EnhancedPrompt> {
    const { task } = context

    const prompt = this.template
      .replace("{task}", task)
      .replace(
        "{initial_response_placeholder}",
        "[Initial response will be generated here]",
      )
      .replace("{accuracy_critique}", "Checking for factual accuracy...")
      .replace("{helpfulness_critique}", "Evaluating helpfulness...")
      .replace("{safety_critique}", "Assessing safety and ethics...")
      .replace("{clarity_critique}", "Reviewing clarity...")
      .replace("{objectivity_critique}", "Checking objectivity...")
      .replace(
        "{final_response}",
        "[Improved response based on constitutional review]",
      )
      .replace("{confidence_score}", "8")
      .replace("{improvement_areas}", "Further examples could be added")
      .replace("{satisfied_principles}", "All core principles")

    return {
      content: prompt,
      metadata: {
        techniques: ["constitutional-ai"],
        confidence: 0.85,
        estimatedTokens: 2000,
        compositionStrategy: "self-critique",
      },
      variables: {},
    }
  }

  validate(input: unknown): boolean {
    return typeof input === "string" && input.length > 10
  }
}

// Keep the const export for backward compatibility
export const constitutionalAI = new ConstitutionalAITechnique()
