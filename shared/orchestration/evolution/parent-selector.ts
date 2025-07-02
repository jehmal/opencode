/**
 * Parent Selector
 * Implements various parent selection strategies for evolution
 */

import { Agent, ParentSelectionResult, SelfImproveEntry } from './evolution-types';
import { ArchiveManager } from './archive-manager';

export class ParentSelector {
  constructor(private archiveManager: ArchiveManager) {}

  async selectParents(
    method: 'random' | 'score_prop' | 'score_child_prop' | 'best',
    count: number,
    runBaseline?: 'no_selfimprove' | 'no_darwin'
  ): Promise<ParentSelectionResult[]> {
    const candidates = this.archiveManager.getEligibleParents();
    
    if (candidates.length === 0) {
      throw new Error('No eligible parent candidates found');
    }

    if (runBaseline === 'no_darwin') {
      // Always take the last agent
      const lastAgent = candidates[candidates.length - 1];
      return this.createResults([lastAgent], method);
    }

    switch (method) {
      case 'score_prop':
        return this.selectByScoreProportion(candidates, count);
      case 'score_child_prop':
        return this.selectByScoreChildProportion(candidates, count);
      case 'best':
        return this.selectBest(candidates, count);
      case 'random':
      default:
        return this.selectRandom(candidates, count);
    }
  }

  private selectRandom(candidates: Agent[], count: number): ParentSelectionResult[] {
    const selected: Agent[] = [];
    const candidateScores = new Map<string, number>();
    
    // All candidates have equal probability
    candidates.forEach(agent => {
      candidateScores.set(agent.commitId, 1.0 / candidates.length);
    });

    for (let i = 0; i < count; i++) {
      const index = Math.floor(Math.random() * candidates.length);
      selected.push(candidates[index]);
    }

    return this.createResults(selected, 'random', candidateScores);
  }

  private selectByScoreProportion(candidates: Agent[], count: number): ParentSelectionResult[] {
    const candidateScores = new Map<string, number>();
    
    // Calculate scores with sigmoid transformation
    const scores = candidates.map(agent => {
      const rawScore = agent.fitness?.accuracy || 0;
      // Sigmoid transformation: 1 / (1 + exp(-10*(score-0.5)))
      const transformedScore = 1 / (1 + Math.exp(-10 * (rawScore - 0.5)));
      candidateScores.set(agent.commitId, transformedScore);
      return transformedScore;
    });

    // Normalize to probabilities
    const totalScore = scores.reduce((sum, score) => sum + score, 0);
    const probabilities = scores.map(score => score / totalScore);

    // Select parents based on probabilities
    const selected = this.weightedRandomSelection(candidates, probabilities, count);
    
    return this.createResults(selected, 'score_prop', candidateScores);
  }

  private selectByScoreChildProportion(candidates: Agent[], count: number): ParentSelectionResult[] {
    const candidateScores = new Map<string, number>();
    
    // Calculate combined scores
    const scores = candidates.map(agent => {
      const rawScore = agent.fitness?.accuracy || 0;
      const transformedScore = 1 / (1 + Math.exp(-10 * (rawScore - 0.5)));
      
      const childrenCount = agent.metadata.children_count || 0;
      const childFactor = 1 / (1 + childrenCount);
      
      const combinedScore = transformedScore * childFactor;
      candidateScores.set(agent.commitId, combinedScore);
      return combinedScore;
    });

    // Normalize to probabilities
    const totalScore = scores.reduce((sum, score) => sum + score, 0);
    const probabilities = scores.map(score => score / totalScore);

    // Select parents based on probabilities
    const selected = this.weightedRandomSelection(candidates, probabilities, count);
    
    return this.createResults(selected, 'score_child_prop', candidateScores);
  }

  private selectBest(candidates: Agent[], count: number): ParentSelectionResult[] {
    const candidateScores = new Map<string, number>();
    
    // Sort by fitness score
    const sorted = [...candidates].sort((a, b) => {
      const scoreA = a.fitness?.accuracy || 0;
      const scoreB = b.fitness?.accuracy || 0;
      candidateScores.set(a.commitId, scoreA);
      candidateScores.set(b.commitId, scoreB);
      return scoreB - scoreA;
    });

    // Take top candidates
    let selected = sorted.slice(0, Math.min(count, sorted.length));
    
    // If not enough candidates, repeat selection from the best
    while (selected.length < count) {
      const index = Math.floor(Math.random() * Math.min(count, sorted.length));
      selected.push(sorted[index]);
    }

    return this.createResults(selected, 'best', candidateScores);
  }

  private weightedRandomSelection(
    candidates: Agent[],
    probabilities: number[],
    count: number
  ): Agent[] {
    const selected: Agent[] = [];
    
    for (let i = 0; i < count; i++) {
      let random = Math.random();
      let index = 0;
      
      for (let j = 0; j < probabilities.length; j++) {
        random -= probabilities[j];
        if (random <= 0) {
          index = j;
          break;
        }
      }
      
      selected.push(candidates[index]);
    }
    
    return selected;
  }

  private createResults(
    selected: Agent[],
    method: string,
    candidateScores?: Map<string, number>
  ): ParentSelectionResult[] {
    return selected.map(agent => ({
      parentCommitId: agent.commitId,
      selectionScore: agent.fitness?.accuracy || 0,
      selectionMethod: method,
      candidateScores: candidateScores || new Map(),
    }));
  }

  chooseSelfImproveEntries(
    parents: ParentSelectionResult[],
    polyglot: boolean = false
  ): Array<[string, string | SelfImproveEntry]> {
    const entries: Array<[string, string | SelfImproveEntry]> = [];

    for (const parent of parents) {
      const agent = this.archiveManager.getAgent(parent.parentCommitId);
      if (!agent) continue;

      const perf = agent.metadata.overall_performance;
      const emptyIds = perf.total_emptypatch_ids;
      const resolvedIds = perf.total_resolved_ids;
      const unresolvedIds = perf.total_unresolved_ids;

      if (polyglot) {
        // For polyglot, focus on empty and unresolved
        let entryIds = [...emptyIds, ...unresolvedIds];
        if (entryIds.length === 0) {
          entryIds = [...resolvedIds, ...emptyIds, ...unresolvedIds];
        }
        
        if (entryIds.length > 0) {
          const entry = entryIds[Math.floor(Math.random() * entryIds.length)];
          entries.push([parent.parentCommitId, entry]);
        }
      } else {
        const totalIds = emptyIds.length + resolvedIds.length + unresolvedIds.length;
        
        // Solve empty patches
        if (emptyIds.length >= 0.1 * totalIds && Math.random() < 0.25) {
          entries.push([parent.parentCommitId, 'solve_empty_patches']);
          continue;
        }

        // Solve stochasticity
        if (Math.random() < 0.25) {
          entries.push([parent.parentCommitId, 'solve_stochasticity']);
          continue;
        }

        // Solve context length
        if (this.hasContextLengthIssues(agent, [...emptyIds, ...unresolvedIds]) && 
            Math.random() < 0.25) {
          entries.push([parent.parentCommitId, 'solve_contextlength']);
          continue;
        }

        // Choose a random unresolved entry
        if (unresolvedIds.length > 0) {
          const entry = unresolvedIds[Math.floor(Math.random() * unresolvedIds.length)];
          entries.push([parent.parentCommitId, entry]);
        }
      }
    }

    return entries;
  }

  private hasContextLengthIssues(agent: Agent, instanceIds: string[]): boolean {
    // This would check logs for context length errors
    // For now, we'll use the fitness flag if available
    return agent.fitness?.contextLengthExceeded || false;
  }
}

export default ParentSelector;