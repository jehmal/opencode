/**
 * Evolution State Machine
 * Manages state transitions for evolution processes
 */

import { Log } from "../../util/log"
import type { EvolutionState } from "./evolution-process"

const log = Log.create({ service: "evolution-state-machine" })

/**
 * State transition
 */
export interface StateTransition {
  to: EvolutionState
  condition: string
  guard?: () => boolean
}

/**
 * State machine configuration
 */
export interface StateMachineConfig {
  initialState: EvolutionState
  transitions: Map<EvolutionState, StateTransition[]>
  onTransition?: (from: EvolutionState, to: EvolutionState) => void
}

/**
 * Evolution State Machine
 */
export class EvolutionStateMachine {
  private transitions: Map<EvolutionState, StateTransition[]>
  private currentState: EvolutionState
  private onTransition?: (from: EvolutionState, to: EvolutionState) => void

  constructor(config?: Partial<StateMachineConfig>) {
    this.currentState = config?.initialState || "pending"
    this.onTransition = config?.onTransition

    // Initialize default transitions
    this.transitions = config?.transitions || this.createDefaultTransitions()
  }

  /**
   * Get current state
   */
  getState(): EvolutionState {
    return this.currentState
  }

  /**
   * Check if transition is valid
   */
  canTransition(to: EvolutionState): boolean {
    const transitions = this.transitions.get(this.currentState) || []
    return transitions.some((t) => t.to === to && (!t.guard || t.guard()))
  }

  /**
   * Transition to new state
   */
  transition(to: EvolutionState, condition?: string): boolean {
    const transitions = this.transitions.get(this.currentState) || []
    const transition = transitions.find(
      (t) => t.to === to && (!condition || t.condition === condition),
    )

    if (!transition) {
      log.warn("Invalid state transition attempted", {
        from: this.currentState,
        to,
        condition,
      })
      return false
    }

    if (transition.guard && !transition.guard()) {
      log.warn("State transition guard failed", {
        from: this.currentState,
        to,
        condition,
      })
      return false
    }

    const from = this.currentState
    this.currentState = to

    log.info("State transition", { from, to, condition })

    if (this.onTransition) {
      this.onTransition(from, to)
    }

    return true
  }

  /**
   * Get available transitions from current state
   */
  getAvailableTransitions(): StateTransition[] {
    return this.transitions.get(this.currentState) || []
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.currentState = "pending"
  }

  /**
   * Create default transitions
   */
  private createDefaultTransitions(): Map<EvolutionState, StateTransition[]> {
    const transitions = new Map<EvolutionState, StateTransition[]>()

    // Pending state transitions
    transitions.set("pending", [
      { to: "generating", condition: "start" },
      { to: "cancelled", condition: "cancel" },
    ])

    // Generating state transitions
    transitions.set("generating", [
      { to: "testing", condition: "generated" },
      { to: "failed", condition: "generation-failed" },
      { to: "cancelled", condition: "cancel" },
    ])

    // Testing state transitions
    transitions.set("testing", [
      { to: "validating", condition: "tests-passed" },
      { to: "failed", condition: "tests-failed" },
      { to: "cancelled", condition: "cancel" },
    ])

    // Validating state transitions
    transitions.set("validating", [
      { to: "awaiting-approval", condition: "valid" },
      { to: "failed", condition: "invalid" },
      { to: "cancelled", condition: "cancel" },
    ])

    // Awaiting approval state transitions
    transitions.set("awaiting-approval", [
      { to: "applying", condition: "approved" },
      { to: "rejected", condition: "rejected" },
      { to: "cancelled", condition: "cancel" },
    ])

    // Applying state transitions
    transitions.set("applying", [
      { to: "completed", condition: "applied" },
      { to: "rollback", condition: "apply-failed" },
    ])

    // Rollback state transitions
    transitions.set("rollback", [
      { to: "failed", condition: "rollback-complete" },
    ])

    // Terminal states (no transitions)
    transitions.set("completed", [])
    transitions.set("failed", [])
    transitions.set("cancelled", [])
    transitions.set("rejected", [])

    return transitions
  }

  /**
   * Check if current state is terminal
   */
  isTerminal(): boolean {
    const terminalStates: EvolutionState[] = [
      "completed",
      "failed",
      "cancelled",
      "rejected",
    ]
    return terminalStates.includes(this.currentState)
  }

  /**
   * Get state diagram
   */
  getStateDiagram(): string {
    const lines: string[] = ["Evolution State Machine:"]

    for (const [state, transitions] of this.transitions) {
      if (transitions.length === 0) {
        lines.push(`  ${state} (terminal)`)
      } else {
        lines.push(`  ${state}:`)
        for (const transition of transitions) {
          lines.push(`    -> ${transition.to} [${transition.condition}]`)
        }
      }
    }

    return lines.join("\n")
  }
}
