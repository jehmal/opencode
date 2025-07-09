/**
 * Sandbox Runner - Executes code in Docker container
 * Agent: safe-evolution-sandbox-003
 */

const fs = require("fs")
const path = require("path")
const vm = require("vm")

// Resource monitoring
let startTime = Date.now()
let startMemory = process.memoryUsage()

// Setup sandbox environment
const sandbox = {
  console: {
    log: (...args) => console.log("[SANDBOX]", ...args),
    error: (...args) => console.error("[SANDBOX ERROR]", ...args),
    warn: (...args) => console.warn("[SANDBOX WARN]", ...args),
  },
  setTimeout: setTimeout,
  setInterval: setInterval,
  clearTimeout: clearTimeout,
  clearInterval: clearInterval,
  Promise: Promise,
  Array: Array,
  Object: Object,
  String: String,
  Number: Number,
  Boolean: Boolean,
  Date: Date,
  Math: Math,
  JSON: JSON,
}

// Load and execute code
async function runSandbox() {
  try {
    // Read evolved code
    const codePath = path.join("/sandbox/code/evolved-code.js")
    const testPath = path.join("/sandbox/code/test-suite.js")

    const code = fs.readFileSync(codePath, "utf8")
    const tests = fs.readFileSync(testPath, "utf8")

    // Create VM context
    const context = vm.createContext(sandbox)

    // Execute code
    const codeScript = new vm.Script(code, {
      filename: "evolved-code.js",
    })

    codeScript.runInContext(context)

    // Execute tests
    const testScript = new vm.Script(tests, {
      filename: "test-suite.js",
    })

    const result = testScript.runInContext(context)

    // Calculate metrics
    const endMemory = process.memoryUsage()
    const executionTime = Date.now() - startTime

    // Output results
    const output = {
      success: true,
      executionTime,
      memoryUsage: {
        start: startMemory,
        end: endMemory,
        peak: endMemory.heapUsed,
      },
      result,
    }

    console.log(JSON.stringify(output))
    process.exit(0)
  } catch (error) {
    console.error(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
        executionTime: Date.now() - startTime,
      }),
    )
    process.exit(1)
  }
}

// Handle timeout
const timeout = parseInt(process.env.MAX_EXECUTION_TIME) || 300000
setTimeout(() => {
  console.error(
    JSON.stringify({
      success: false,
      error: "Execution timeout",
      executionTime: timeout,
    }),
  )
  process.exit(2)
}, timeout)

// Run
runSandbox()
