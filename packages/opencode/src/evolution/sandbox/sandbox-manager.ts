/**
 * Sandbox Manager - Container Lifecycle Management
 * Agent: safe-evolution-sandbox-003
 * Purpose: Manages Docker containers for safe code evolution testing
 */

import { spawn } from "child_process"
import { EventEmitter } from "events"
import * as fs from "fs/promises"
import * as path from "path"
// Simple UUID v4 generator
const uuidv4 = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
import { Logger } from "./logger"
import {
  SandboxConfig,
  SandboxInstance,
  SandboxStatus,
  ExecutionResult,
  ResourceLimits,
} from "./types"

export class SandboxManager extends EventEmitter {
  private instances: Map<string, SandboxInstance> = new Map()
  private logger: Logger
  private dockerPath: string = "docker"
  private imageName: string = "evolution-sandbox:latest"
  private maxConcurrentSandboxes: number = 5
  private defaultTimeout: number = 300000 // 5 minutes

  constructor(private config: SandboxConfig) {
    super()
    this.logger = new Logger("SandboxManager")
    this.validateDockerInstallation()
  }

  /**
   * Initialize the sandbox manager and build Docker image
   */
  async initialize(): Promise<void> {
    this.logger.info("Initializing Sandbox Manager")

    // Build Docker image
    await this.buildSandboxImage()

    // Set up cleanup handlers
    process.on("SIGINT", () => this.cleanup())
    process.on("SIGTERM", () => this.cleanup())

    this.logger.info("Sandbox Manager initialized successfully")
  }

  /**
   * Create a new sandbox instance
   */
  async createSandbox(
    code: string,
    testSuite: string,
    limits?: Partial<ResourceLimits>,
  ): Promise<SandboxInstance> {
    const sandboxId = `sandbox-${uuidv4()}`
    const startTime = Date.now()

    this.logger.info(`Creating sandbox ${sandboxId}`)

    // Check concurrent sandbox limit
    if (this.instances.size >= this.maxConcurrentSandboxes) {
      throw new Error(
        `Maximum concurrent sandboxes (${this.maxConcurrentSandboxes}) reached`,
      )
    }

    // Prepare sandbox configuration
    const resourceLimits: ResourceLimits = {
      cpuShares: limits?.cpuShares || 512, // 0.5 CPU
      memoryMB: limits?.memoryMB || 512,
      diskMB: limits?.diskMB || 1024,
      maxProcesses: limits?.maxProcesses || 50,
      maxFileDescriptors: limits?.maxFileDescriptors || 1024,
      networkEnabled: limits?.networkEnabled || false,
      executionTimeoutMs: limits?.executionTimeoutMs || this.defaultTimeout,
    }

    // Create temporary directory for this sandbox
    const sandboxDir = path.join(this.config.tempDir, sandboxId)
    await fs.mkdir(sandboxDir, { recursive: true })

    // Write code and tests to sandbox directory
    await fs.writeFile(path.join(sandboxDir, "evolved-code.js"), code)
    await fs.writeFile(path.join(sandboxDir, "test-suite.js"), testSuite)

    // Create Docker container
    const containerId = await this.createDockerContainer(
      sandboxId,
      sandboxDir,
      resourceLimits,
    )

    const instance: SandboxInstance = {
      id: sandboxId,
      containerId,
      status: SandboxStatus.CREATED,
      createdAt: startTime,
      resourceLimits,
      directory: sandboxDir,
      logs: [],
      metrics: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkIO: { in: 0, out: 0 },
      },
    }

    this.instances.set(sandboxId, instance)
    this.emit("sandbox:created", instance)

    return instance
  }

  /**
   * Execute code in sandbox
   */
  async execute(sandboxId: string): Promise<ExecutionResult> {
    const instance = this.instances.get(sandboxId)
    if (!instance) {
      throw new Error(`Sandbox ${sandboxId} not found`)
    }

    this.logger.info(`Executing code in sandbox ${sandboxId}`)
    instance.status = SandboxStatus.RUNNING
    instance.startedAt = Date.now()

    try {
      // Start the container
      await this.startContainer(instance.containerId)

      // Monitor execution
      const monitoringPromise = this.monitorExecution(instance)

      // Execute tests with timeout
      const executionPromise = this.executeInContainer(instance)

      // Wait for execution or timeout
      const result = await Promise.race([
        executionPromise,
        this.createTimeout(instance.resourceLimits.executionTimeoutMs),
      ])

      // Stop monitoring
      await monitoringPromise

      instance.status = SandboxStatus.COMPLETED
      instance.completedAt = Date.now()

      return result as ExecutionResult
    } catch (error) {
      instance.status = SandboxStatus.FAILED
      instance.error = error instanceof Error ? error.message : String(error)
      throw error
    } finally {
      // Always cleanup
      await this.stopContainer(instance.containerId)
    }
  }

  /**
   * Destroy a sandbox and clean up resources
   */
  async destroySandbox(sandboxId: string): Promise<void> {
    const instance = this.instances.get(sandboxId)
    if (!instance) {
      return
    }

    this.logger.info(`Destroying sandbox ${sandboxId}`)

    try {
      // Stop and remove container
      await this.removeContainer(instance.containerId)

      // Clean up temporary files
      await fs.rm(instance.directory, { recursive: true, force: true })

      // Remove from tracking
      this.instances.delete(sandboxId)

      this.emit("sandbox:destroyed", sandboxId)
    } catch (error) {
      this.logger.error(`Error destroying sandbox ${sandboxId}:`, error)
    }
  }

  /**
   * Get sandbox metrics
   */
  async getMetrics(sandboxId: string): Promise<any> {
    const instance = this.instances.get(sandboxId)
    if (!instance) {
      throw new Error(`Sandbox ${sandboxId} not found`)
    }

    // Get real-time metrics from Docker
    const stats = await this.getContainerStats(instance.containerId)

    return {
      ...instance.metrics,
      realtime: stats,
    }
  }

  /**
   * Private: Build sandbox Docker image
   */
  private async buildSandboxImage(): Promise<void> {
    this.logger.info("Building sandbox Docker image")

    const dockerfilePath = path.join(__dirname, "Dockerfile")
    const buildContext = path.dirname(dockerfilePath)

    return new Promise((resolve, reject) => {
      const buildProcess = spawn(this.dockerPath, [
        "build",
        "-t",
        this.imageName,
        "-f",
        dockerfilePath,
        buildContext,
      ])

      buildProcess.stdout.on("data", (data) => {
        this.logger.debug(`Docker build: ${data}`)
      })

      buildProcess.stderr.on("data", (data) => {
        this.logger.error(`Docker build error: ${data}`)
      })

      buildProcess.on("close", (code) => {
        if (code === 0) {
          this.logger.info("Docker image built successfully")
          resolve()
        } else {
          reject(new Error(`Docker build failed with code ${code}`))
        }
      })
    })
  }

  /**
   * Private: Create Docker container
   */
  private async createDockerContainer(
    sandboxId: string,
    sandboxDir: string,
    limits: ResourceLimits,
  ): Promise<string> {
    const args = [
      "create",
      "--name",
      sandboxId,
      // Resource limits
      "--cpus",
      (limits.cpuShares / 1024).toString(),
      "--memory",
      `${limits.memoryMB}m`,
      "--memory-swap",
      `${limits.memoryMB}m`, // Prevent swap usage
      "--pids-limit",
      limits.maxProcesses.toString(),
      "--ulimit",
      `nofile=${limits.maxFileDescriptors}`,
      // Security
      "--security-opt",
      "no-new-privileges",
      "--cap-drop",
      "ALL",
      "--read-only",
      // Volumes
      "-v",
      `${sandboxDir}:/sandbox/code:ro`,
      "-v",
      `${sandboxDir}/logs:/sandbox/logs:rw`,
      // Environment
      "-e",
      `SANDBOX_ID=${sandboxId}`,
      "-e",
      `MAX_EXECUTION_TIME=${limits.executionTimeoutMs}`,
      // Network
      limits.networkEnabled ? "--network=bridge" : "--network=none",
      // Image
      this.imageName,
    ]

    return new Promise((resolve, reject) => {
      const createProcess = spawn(this.dockerPath, args)
      let containerId = ""

      createProcess.stdout.on("data", (data) => {
        containerId += data.toString().trim()
      })

      createProcess.on("close", (code) => {
        if (code === 0 && containerId) {
          resolve(containerId)
        } else {
          reject(new Error(`Failed to create container: exit code ${code}`))
        }
      })
    })
  }

  /**
   * Private: Monitor container execution
   */
  private async monitorExecution(instance: SandboxInstance): Promise<void> {
    const interval = setInterval(async () => {
      if (instance.status !== SandboxStatus.RUNNING) {
        clearInterval(interval)
        return
      }

      try {
        const stats = await this.getContainerStats(instance.containerId)
        instance.metrics = {
          cpuUsage: stats.cpu_percent || 0,
          memoryUsage: stats.memory_usage || 0,
          diskUsage: stats.disk_usage || 0,
          networkIO: stats.network || { in: 0, out: 0 },
        }

        this.emit("sandbox:metrics", instance.id, instance.metrics)
      } catch (error) {
        this.logger.error(`Error monitoring sandbox ${instance.id}:`, error)
      }
    }, 1000) // Monitor every second
  }

  /**
   * Private: Validate Docker installation
   */
  private async validateDockerInstallation(): Promise<void> {
    try {
      await this.execCommand("docker", ["--version"])
    } catch (error) {
      throw new Error("Docker is not installed or not accessible")
    }
  }

  /**
   * Private: Execute command and return output
   */
  private execCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args)
      let output = ""
      let error = ""

      process.stdout.on("data", (data) => (output += data))
      process.stderr.on("data", (data) => (error += data))

      process.on("close", (code) => {
        if (code === 0) {
          resolve(output)
        } else {
          reject(new Error(error || `Command failed with code ${code}`))
        }
      })
    })
  }

  /**
   * Private: Helper methods for Docker operations
   */
  private async startContainer(containerId: string): Promise<void> {
    await this.execCommand(this.dockerPath, ["start", containerId])
  }

  private async stopContainer(containerId: string): Promise<void> {
    await this.execCommand(this.dockerPath, ["stop", "-t", "10", containerId])
  }

  private async removeContainer(containerId: string): Promise<void> {
    await this.execCommand(this.dockerPath, ["rm", "-f", containerId])
  }

  private async getContainerStats(containerId: string): Promise<any> {
    const output = await this.execCommand(this.dockerPath, [
      "stats",
      "--no-stream",
      "--format",
      "json",
      containerId,
    ])
    return JSON.parse(output)
  }

  private async executeInContainer(
    instance: SandboxInstance,
  ): Promise<ExecutionResult> {
    const output = await this.execCommand(this.dockerPath, [
      "exec",
      instance.containerId,
      "node",
      "/sandbox/runtime/test-runner.js",
    ])

    return JSON.parse(output)
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Execution timeout")), ms)
    })
  }

  /**
   * Cleanup all sandboxes
   */
  private async cleanup(): Promise<void> {
    this.logger.info("Cleaning up all sandboxes")

    for (const [sandboxId] of this.instances) {
      await this.destroySandbox(sandboxId)
    }
  }
}
