import type {
  TechniqueSet,
  TechniqueModification,
  PromptingTechnique,
} from "../types"

export class TechniqueInheritance {
  private agentTechniques = new Map<string, TechniqueSet>()

  async getAgentTechniques(agentId: string): Promise<TechniqueSet> {
    const existing = this.agentTechniques.get(agentId)
    if (existing) return existing

    // Default technique set for new agents
    const defaultSet: TechniqueSet = {
      techniques: new Map(),
      metadata: {
        agentId,
        parentId: undefined,
        modifications: [],
        inheritanceChain: [agentId],
      },
    }

    this.agentTechniques.set(agentId, defaultSet)
    return defaultSet
  }

  inherit(
    parentSet: TechniqueSet,
    modifications: TechniqueModification[],
  ): TechniqueSet {
    // Create a new technique set inheriting from parent
    const inherited = new Map<string, PromptingTechnique>()

    // Copy all parent techniques
    for (const [id, technique] of parentSet.techniques) {
      inherited.set(id, { ...technique })
    }

    // Apply modifications
    for (const mod of modifications) {
      switch (mod.type) {
        case "add":
          if (
            mod.value &&
            typeof mod.value === "object" &&
            "technique" in mod.value
          ) {
            const technique = mod.value.technique as PromptingTechnique
            inherited.set(technique.id, technique)
          }
          break
        case "remove":
          inherited.delete(mod.techniqueId)
          break
        case "parameter":
          const technique = inherited.get(mod.techniqueId)
          if (technique && mod.value) {
            // Apply parameter modifications
            inherited.set(mod.techniqueId, {
              ...technique,
              parameters: {
                ...technique.parameters,
                ...(mod.value as Record<string, any>),
              },
            })
          }
          break
      }
    }

    return {
      techniques: inherited,
      metadata: {
        agentId: `${parentSet.metadata.agentId}-child`,
        parentId: parentSet.metadata.agentId,
        modifications,
        inheritanceChain: [
          ...parentSet.metadata.inheritanceChain,
          `${parentSet.metadata.agentId}-child`,
        ],
      },
    }
  }

  async storeAgentTechniques(
    agentId: string,
    techniqueSet: TechniqueSet,
  ): Promise<void> {
    this.agentTechniques.set(agentId, techniqueSet)
  }

  clear(): void {
    this.agentTechniques.clear()
  }
}
