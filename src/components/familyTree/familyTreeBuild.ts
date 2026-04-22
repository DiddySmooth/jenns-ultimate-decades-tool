import type { Edge, Node } from 'reactflow';
import type { FamilyTreeConfig, FamilyTreeState, SimEntry, TrackerConfig, UnionNode } from '../../types/tracker';
import { computeLifeStage } from '../../utils/lifeStage';
import { buildRelationshipGraph } from './graphModel';
import { mapGraphToFlow } from './mapGraphToFlow';
import { getDeathYear } from '../../utils/simDates';

export function buildFamilyTree(
  sims: SimEntry[],
  unions: UnionNode[],
  saved: FamilyTreeState | undefined,
  treeConfig: FamilyTreeConfig,
  trackerConfig: TrackerConfig,
  currentDay: number
): { nodes: Node[]; edges: Edge[] } {
  // Apply filters first, then build a relationship graph from the visible set.
  const hiddenStages = new Set(treeConfig.filters.hiddenLifeStages ?? []);
  const isDead = (s: SimEntry) => !!getDeathYear(s, trackerConfig);

  // Precompute living-descendant status on the FULL sim set (so dead-branch pruning
  // is not affected by other filters like hide-by-life-stage).
  const graphAll = buildRelationshipGraph(sims, unions);
  const memo = new Map<string, boolean>();
  const hasLivingDesc = (id: string): boolean => {
    if (memo.has(id)) return memo.get(id)!;
    const simNode = graphAll.people.get(id);
    if (!simNode) { memo.set(id, false); return false; }
    const sim = simNode.raw as SimEntry;
    if (!isDead(sim)) { memo.set(id, true); return true; }
    const kids = graphAll.childrenByParent.get(id) ?? [];
    const res = kids.some((kid) => hasLivingDesc(kid));
    memo.set(id, res);
    return res;
  };

  let simsFiltered = sims;

  // NOTE: intentionally do NOT hide dead sims in the family tree.
  if (treeConfig.filters.hideDeadBranches) {
    simsFiltered = simsFiltered.filter((s) => hasLivingDesc(s.id));
  }

  if (hiddenStages.size > 0) {
    simsFiltered = simsFiltered.filter((s) => {
      const stage = computeLifeStage(s, trackerConfig, currentDay);
      return !stage || !hiddenStages.has(stage);
    });
  }

  const graphVisible = buildRelationshipGraph(simsFiltered, unions);
  return mapGraphToFlow(graphVisible, simsFiltered, unions, saved, treeConfig, trackerConfig, currentDay);
}
