/**
 * Evolution UI Integration
 * Agent ID: user-approval-workflow-004
 *
 * Main entry point for Evolution UI components
 */

export * from "./types"
export * from "./theme"
export * from "./store"
export * from "./ApprovalDialog"
export * from "./utils"

import type { IEvolutionBridge } from "../types"
import { useEvolutionStore } from "./store"
import { ApprovalDialog } from "./ApprovalDialog"
import { EventEmitter } from "events"

export interface EvolutionUIConfig {
  bridge: IEvolutionBridge
  autoApprovalEnabled?: boolean
  minSafetyScore?: number
}

export class EvolutionUI extends EventEmitter {
  private store = useEvolutionStore()
  private currentDialog: ApprovalDialog | null = null

  constructor(private config: EvolutionUIConfig) {
    super()
    this.store.setBridge(config.bridge)
    this.setupEventListeners()

    // Configure auto-approval if specified
    if (config.autoApprovalEnabled !== undefined) {
      const settings = this.store.getAutoApprovalSettings()
      settings.enabled = config.autoApprovalEnabled
      if (config.minSafetyScore !== undefined) {
        settings.minSafetyScore = config.minSafetyScore
      }
      this.store.setAutoApprovalSettings(settings)
    }
  }

  private setupEventListeners() {
    // Listen for evolutions that need approval
    this.store.on("evolution:updated", (evolution) => {
      if (evolution.status === "awaiting-approval") {
        this.emit("approval-needed", evolution)
      }
    })

    // Listen for auto-approvals
    this.store.on("evolution:approved", (evolution) => {
      this.emit("evolution-approved", evolution)
    })

    this.store.on("evolution:rejected", (evolution) => {
      this.emit("evolution-rejected", evolution)
    })

    this.store.on("error", (error) => {
      this.emit("error", error)
    })
  }

  /**
   * Show approval dialog for an evolution
   */
  async showApprovalDialog(
    evolutionId: string,
  ): Promise<"approved" | "rejected" | "cancelled"> {
    const evolution = this.store.getEvolution(evolutionId)
    if (!evolution) {
      throw new Error(`Evolution ${evolutionId} not found`)
    }

    return new Promise((resolve) => {
      this.currentDialog = new ApprovalDialog({
        evolution,
        onApprove: () => {
          this.store.approveEvolution(evolutionId)
          resolve("approved")
        },
        onReject: () => {
          this.store.rejectEvolution(evolutionId)
          resolve("rejected")
        },
        onCancel: () => {
          resolve("cancelled")
        },
      })

      this.emit("dialog-opened", this.currentDialog)
    })
  }

  /**
   * Get current dialog for rendering
   */
  getCurrentDialog(): ApprovalDialog | null {
    return this.currentDialog
  }

  /**
   * Close current dialog
   */
  closeDialog() {
    this.currentDialog = null
    this.emit("dialog-closed")
  }

  /**
   * Get all evolutions
   */
  getEvolutions() {
    return this.store.getEvolutions()
  }

  /**
   * Get evolutions awaiting approval
   */
  getEvolutionsAwaitingApproval() {
    return this.store
      .getEvolutions()
      .filter((e) => e.status === "awaiting-approval")
  }

  /**
   * Refresh evolution list
   */
  async refresh() {
    await this.store.refreshEvolutions()
  }

  /**
   * Get auto-approval settings
   */
  getAutoApprovalSettings() {
    return this.store.getAutoApprovalSettings()
  }

  /**
   * Update auto-approval settings
   */
  setAutoApprovalSettings(settings: any) {
    this.store.setAutoApprovalSettings(settings)
  }
}

/**
 * Create Evolution UI instance
 */
export function createEvolutionUI(config: EvolutionUIConfig): EvolutionUI {
  return new EvolutionUI(config)
}
