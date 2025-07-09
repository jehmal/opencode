/**
 * Feature Flag Manager for Evolution Deployment
 * Controls gradual rollout and targeting of evolutions
 */

export interface FeatureFlag {
  id: string
  evolutionId: string
  enabled: boolean
  rules: FeatureFlagRule[]
  percentage: number
  userGroups: string[]
  metadata: {
    createdAt: number
    updatedAt: number
    version: number
    [key: string]: any
  }
}

export interface FeatureFlagConfig {
  enabled?: boolean
  rules?: FeatureFlagRule[]
  percentage?: number
  userGroups?: string[]
  metadata?: Record<string, any>
}

export interface FeatureFlagRule {
  type: "user" | "group" | "percentage" | "custom"
  condition: string
  value: any
}

export interface EvaluationContext {
  userId: string
  userGroup?: string
  attributes?: Record<string, any>
  timestamp?: number
}

export class FlagEvaluator {
  evaluate(rule: FeatureFlagRule, context: EvaluationContext): boolean {
    switch (rule.type) {
      case "user":
        return this.evaluateUserRule(rule, context)
      case "group":
        return this.evaluateGroupRule(rule, context)
      case "percentage":
        return this.evaluatePercentageRule(rule, context)
      case "custom":
        return this.evaluateCustomRule(rule, context)
      default:
        return false
    }
  }

  private evaluateUserRule(
    rule: FeatureFlagRule,
    context: EvaluationContext,
  ): boolean {
    if (rule.condition === "equals") {
      return context.userId === rule.value
    } else if (rule.condition === "in") {
      return Array.isArray(rule.value) && rule.value.includes(context.userId)
    }
    return false
  }

  private evaluateGroupRule(
    rule: FeatureFlagRule,
    context: EvaluationContext,
  ): boolean {
    if (!context.userGroup) return false

    if (rule.condition === "equals") {
      return context.userGroup === rule.value
    } else if (rule.condition === "in") {
      return Array.isArray(rule.value) && rule.value.includes(context.userGroup)
    }
    return false
  }

  private evaluatePercentageRule(
    rule: FeatureFlagRule,
    context: EvaluationContext,
  ): boolean {
    const hash = this.hashString(context.userId)
    const percentage = typeof rule.value === "number" ? rule.value : 0
    return hash % 100 < percentage
  }

  private evaluateCustomRule(
    rule: FeatureFlagRule,
    context: EvaluationContext,
  ): boolean {
    if (!context.attributes) return false

    // Simple attribute matching
    const attributeName = rule.condition
    const attributeValue = context.attributes[attributeName]

    if (typeof rule.value === "object" && rule.value.operator) {
      return this.evaluateOperator(
        attributeValue,
        rule.value.operator,
        rule.value.value,
      )
    }

    return attributeValue === rule.value
  }

  private evaluateOperator(value: any, operator: string, target: any): boolean {
    switch (operator) {
      case "gt":
        return value > target
      case "gte":
        return value >= target
      case "lt":
        return value < target
      case "lte":
        return value <= target
      case "contains":
        return String(value).includes(String(target))
      case "regex":
        return new RegExp(target).test(String(value))
      default:
        return value === target
    }
  }

  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }
}

export class FeatureFlagManager {
  private flags: Map<string, FeatureFlag> = new Map()
  private evaluator: FlagEvaluator
  private storage: IFeatureFlagStorage | null = null

  constructor(storage?: IFeatureFlagStorage) {
    this.evaluator = new FlagEvaluator()
    this.storage = storage || null

    if (this.storage) {
      this.loadFlags()
    }
  }

  async createFlag(
    evolutionId: string,
    config: FeatureFlagConfig,
  ): Promise<FeatureFlag> {
    const flag: FeatureFlag = {
      id: `flag-${evolutionId}`,
      evolutionId,
      enabled: config.enabled || false,
      rules: config.rules || [],
      percentage: config.percentage || 0,
      userGroups: config.userGroups || [],
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        ...(config.metadata || {}),
      },
    }

    this.flags.set(flag.id, flag)
    await this.persistFlag(flag)

    return flag
  }

  async updateFlag(
    evolutionId: string,
    updates: Partial<FeatureFlagConfig>,
  ): Promise<FeatureFlag> {
    const flagId = `flag-${evolutionId}`
    const flag = this.flags.get(flagId)

    if (!flag) {
      throw new Error(`Feature flag not found for evolution: ${evolutionId}`)
    }

    // Update flag properties
    if (updates.enabled !== undefined) flag.enabled = updates.enabled
    if (updates.rules !== undefined) flag.rules = updates.rules
    if (updates.percentage !== undefined) flag.percentage = updates.percentage
    if (updates.userGroups !== undefined) flag.userGroups = updates.userGroups
    if (updates.metadata !== undefined) {
      flag.metadata = { ...flag.metadata, ...updates.metadata }
    }

    flag.metadata.updatedAt = Date.now()
    flag.metadata.version++

    await this.persistFlag(flag)
    return flag
  }

  async evaluateFlag(
    flagId: string,
    context: EvaluationContext,
  ): Promise<boolean> {
    const flag = this.flags.get(flagId)
    if (!flag || !flag.enabled) return false

    // Check user group membership
    if (flag.userGroups.length > 0) {
      if (!context.userGroup || !flag.userGroups.includes(context.userGroup)) {
        return false
      }
    }

    // Check percentage rollout
    if (flag.percentage < 100) {
      const hash = this.hashUser(context.userId)
      if (hash > flag.percentage) {
        return false
      }
    }

    // Evaluate custom rules
    for (const rule of flag.rules) {
      if (!this.evaluator.evaluate(rule, context)) {
        return false
      }
    }

    return true
  }

  async getFlag(evolutionId: string): Promise<FeatureFlag | null> {
    const flagId = `flag-${evolutionId}`
    return this.flags.get(flagId) || null
  }

  async deleteFlag(evolutionId: string): Promise<void> {
    const flagId = `flag-${evolutionId}`
    this.flags.delete(flagId)

    if (this.storage) {
      await this.storage.deleteFlag(flagId)
    }
  }

  async getAllFlags(): Promise<FeatureFlag[]> {
    return Array.from(this.flags.values())
  }

  async getFlagsByGroup(userGroup: string): Promise<FeatureFlag[]> {
    return Array.from(this.flags.values()).filter((flag) =>
      flag.userGroups.includes(userGroup),
    )
  }

  private hashUser(userId: string): number {
    // Simple hash to distribute users evenly 0-100
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      hash = (hash << 5) - hash + userId.charCodeAt(i)
      hash = hash & hash
    }
    return Math.abs(hash) % 100
  }

  private async persistFlag(flag: FeatureFlag): Promise<void> {
    if (this.storage) {
      await this.storage.saveFlag(flag)
    }
  }

  private async loadFlags(): Promise<void> {
    if (this.storage) {
      const flags = await this.storage.loadAllFlags()
      flags.forEach((flag) => this.flags.set(flag.id, flag))
    }
  }
}

// Storage interface for persistence
export interface IFeatureFlagStorage {
  saveFlag(flag: FeatureFlag): Promise<void>
  loadFlag(flagId: string): Promise<FeatureFlag | null>
  loadAllFlags(): Promise<FeatureFlag[]>
  deleteFlag(flagId: string): Promise<void>
}

// In-memory storage implementation
export class InMemoryFeatureFlagStorage implements IFeatureFlagStorage {
  private storage: Map<string, FeatureFlag> = new Map()

  async saveFlag(flag: FeatureFlag): Promise<void> {
    this.storage.set(flag.id, { ...flag })
  }

  async loadFlag(flagId: string): Promise<FeatureFlag | null> {
    const flag = this.storage.get(flagId)
    return flag ? { ...flag } : null
  }

  async loadAllFlags(): Promise<FeatureFlag[]> {
    return Array.from(this.storage.values()).map((flag) => ({ ...flag }))
  }

  async deleteFlag(flagId: string): Promise<void> {
    this.storage.delete(flagId)
  }
}
