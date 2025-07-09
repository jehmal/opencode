/**
 * Evolution UI Tests
 * Agent ID: user-approval-workflow-004
 *
 * Test suite for Evolution UI components
 */

import { describe, it, expect, beforeEach, vi } from "bun:test"
import { EvolutionUI, createEvolutionUI } from "./index"
import { useEvolutionStore } from "./store"
import { ApprovalDialog } from "./ApprovalDialog"
import type { EvolutionItem } from "./types"

// Mock evolution bridge
const mockBridge = {
  on: vi.fn(),
  off: vi.fn(),
  getEvolutionHistory: vi.fn().mockResolvedValue([]),
  applyEvolution: vi.fn().mockResolvedValue(undefined),
  rollbackEvolution: vi.fn().mockResolvedValue(undefined),
}

describe("EvolutionUI", () => {
  let ui: EvolutionUI

  beforeEach(() => {
    vi.clearAllMocks()
    ui = createEvolutionUI({ bridge: mockBridge as any })
  })

  describe("initialization", () => {
    it("should create UI instance with bridge", () => {
      expect(ui).toBeInstanceOf(EvolutionUI)
    })

    it("should configure auto-approval settings", () => {
      const ui2 = createEvolutionUI({
        bridge: mockBridge as any,
        autoApprovalEnabled: true,
        minSafetyScore: 90,
      })

      const settings = ui2.getAutoApprovalSettings()
      expect(settings.enabled).toBe(true)
      expect(settings.minSafetyScore).toBe(90)
    })
  })

  describe("approval dialog", () => {
    const mockEvolution: EvolutionItem = {
      id: "test-evo-1",
      timestamp: new Date(),
      status: "awaiting-approval",
      phase: "testing",
      progress: 100,
      safetyScore: {
        overall: 85,
        categories: {
          apiCompatibility: 100,
          testCoverage: 80,
          performanceImpact: 90,
          securityRisk: 100,
          codeQuality: 75,
        },
        recommendation: "safe",
      },
      impact: {
        level: "medium",
        affectedFiles: 3,
        affectedFunctions: ["func1", "func2"],
        testsCoverage: 85,
        breakingChanges: false,
        description: "Test evolution",
      },
      changes: [
        {
          file: "test.ts",
          type: "modify",
          before: "old code",
          after: "new code",
          diff: "- old code\n+ new code",
          lineChanges: { added: 1, removed: 1 },
        },
      ],
      performance: {
        executionTime: { before: 100, after: 80, improvement: 20 },
        memoryUsage: { before: 1000, after: 900, improvement: 10 },
        cpuUsage: { before: 50, after: 45, improvement: 10 },
      },
    }

    it("should show approval dialog for evolution", async () => {
      const store = useEvolutionStore()
      store.getEvolution = vi.fn().mockReturnValue(mockEvolution)

      const dialogPromise = ui.showApprovalDialog("test-evo-1")
      expect(ui.getCurrentDialog()).toBeInstanceOf(ApprovalDialog)

      // Simulate approval
      const dialog = ui.getCurrentDialog()!
      dialog.handleInput("a")

      const result = await dialogPromise
      expect(result).toBe("approved")
    })

    it("should handle rejection", async () => {
      const store = useEvolutionStore()
      store.getEvolution = vi.fn().mockReturnValue(mockEvolution)

      const dialogPromise = ui.showApprovalDialog("test-evo-1")

      // Simulate rejection
      const dialog = ui.getCurrentDialog()!
      dialog.handleInput("r")

      const result = await dialogPromise
      expect(result).toBe("rejected")
    })

    it("should handle cancellation", async () => {
      const store = useEvolutionStore()
      store.getEvolution = vi.fn().mockReturnValue(mockEvolution)

      const dialogPromise = ui.showApprovalDialog("test-evo-1")

      // Simulate cancellation
      const dialog = ui.getCurrentDialog()!
      dialog.handleInput("Escape")

      const result = await dialogPromise
      expect(result).toBe("cancelled")
    })
  })

  describe("evolution filtering", () => {
    it("should filter evolutions awaiting approval", () => {
      const store = useEvolutionStore()
      const mockEvolutions = [
        { id: "1", status: "awaiting-approval" },
        { id: "2", status: "approved" },
        { id: "3", status: "awaiting-approval" },
        { id: "4", status: "rejected" },
      ]

      store.getEvolutions = vi.fn().mockReturnValue(mockEvolutions)

      const awaiting = ui.getEvolutionsAwaitingApproval()
      expect(awaiting).toHaveLength(2)
      expect(awaiting[0].id).toBe("1")
      expect(awaiting[1].id).toBe("3")
    })
  })
})

describe("ApprovalDialog", () => {
  const mockEvolution: EvolutionItem = {
    id: "test-evo-1",
    timestamp: new Date(),
    status: "awaiting-approval",
    phase: "testing",
    progress: 100,
    safetyScore: {
      overall: 85,
      categories: {
        apiCompatibility: 100,
        testCoverage: 80,
        performanceImpact: 90,
        securityRisk: 100,
        codeQuality: 75,
      },
      recommendation: "safe",
    },
    impact: {
      level: "medium",
      affectedFiles: 3,
      affectedFunctions: ["func1", "func2"],
      testsCoverage: 85,
      breakingChanges: false,
      description: "Test evolution",
    },
    changes: [
      {
        file: "test.ts",
        type: "modify",
        before: "old code",
        after: "new code",
        diff: "- old code\n+ new code",
        lineChanges: { added: 1, removed: 1 },
      },
    ],
    performance: {
      executionTime: { before: 100, after: 80, improvement: 20 },
      memoryUsage: { before: 1000, after: 900, improvement: 10 },
      cpuUsage: { before: 50, after: 45, improvement: 10 },
    },
  }

  it("should render dialog content", () => {
    const dialog = new ApprovalDialog({
      evolution: mockEvolution,
      onApprove: vi.fn(),
      onReject: vi.fn(),
      onCancel: vi.fn(),
    })

    const rendered = dialog.render(80, 30)
    expect(rendered).toBeInstanceOf(Array)
    expect(rendered.length).toBeGreaterThan(0)

    // Check for key elements
    const content = rendered.join("\n")
    expect(content).toContain("Evolution Approval")
    expect(content).toContain("Safety Score")
    expect(content).toContain("Impact")
    expect(content).toContain("Performance")
  })

  it("should handle keyboard navigation", () => {
    const dialog = new ApprovalDialog({
      evolution: {
        ...mockEvolution,
        changes: [
          {
            file: "file1.ts",
            type: "modify",
            diff: "",
            lineChanges: { added: 1, removed: 0 },
          },
          {
            file: "file2.ts",
            type: "modify",
            diff: "",
            lineChanges: { added: 2, removed: 1 },
          },
          {
            file: "file3.ts",
            type: "add",
            diff: "",
            lineChanges: { added: 10, removed: 0 },
          },
        ] as any,
      },
      onApprove: vi.fn(),
      onReject: vi.fn(),
      onCancel: vi.fn(),
    })

    // Navigate down
    expect(dialog.handleInput("ArrowDown")).toBe(true)
    expect(dialog.handleInput("j")).toBe(true)

    // Navigate up
    expect(dialog.handleInput("ArrowUp")).toBe(true)
    expect(dialog.handleInput("k")).toBe(true)

    // Toggle diff view
    expect(dialog.handleInput("d")).toBe(true)
  })
})
