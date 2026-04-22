import type { Edge, Node } from 'reactflow';
import type { FamilyTreeConfig, FamilyTreeState, SimEntry, TrackerConfig, UnionNode } from '../../types/tracker';
import { computeLifeStage } from '../../utils/lifeStage';
import { getDeathYear } from '../../utils/simDates';

export function buildFamilyTree(
  sims: SimEntry[],
  unions: UnionNode[],
  saved: FamilyTreeState | undefined,
  treeConfig: FamilyTreeConfig,
  trackerConfig: TrackerConfig,
  currentDay: number
): { nodes: Node[]; edges: Edge[] } {
  const savedPos = new Map((saved?.nodes ?? []).map((n) => [n.id, n.position]));

  // Apply filters
  const hiddenStages = new Set(treeConfig.filters.hiddenLifeStages ?? []);
  const isDead = (s: SimEntry) => !!getDeathYear(s, trackerConfig);

  // Precompute living-descendant status on the FULL sim set (so dead-branch pruning
  // is not affected by other filters like "hide life stages").
  const childrenByParent = new Map<string, string[]>();
  for (const s of sims) {
    if (s.fatherId) childrenByParent.set(s.fatherId, [...(childrenByParent.get(s.fatherId) ?? []), s.id]);
    if (s.motherId) childrenByParent.set(s.motherId, [...(childrenByParent.get(s.motherId) ?? []), s.id]);
  }
  const memo = new Map<string, boolean>();
  const hasLivingDesc = (id: string): boolean => {
    if (memo.has(id)) return memo.get(id)!;
    const sim = sims.find((x) => x.id === id);
    if (!sim) { memo.set(id, false); return false; }
    if (!isDead(sim)) { memo.set(id, true); return true; }
    const kids = childrenByParent.get(id) ?? [];
    const res = kids.some((kid) => hasLivingDesc(kid));
    memo.set(id, res);
    return res;
  };

  let simsFiltered = sims;

  // Hide dead sims (simple)
  if (treeConfig.filters.hideDeadSims) {
    simsFiltered = simsFiltered.filter((s) => !isDead(s));
  }

  // Hide dead branches: remove sims where they and all descendants are dead
  if (treeConfig.filters.hideDeadBranches) {
    simsFiltered = simsFiltered.filter((s) => hasLivingDesc(s.id));
  }

  // Hide by life stage
  if (hiddenStages.size > 0) {
    simsFiltered = simsFiltered.filter((s) => {
      const stage = computeLifeStage(s, trackerConfig, currentDay);
      return !stage || !hiddenStages.has(stage);
    });
  }

  const visibleSimIds = new Set(simsFiltered.map((s) => s.id));

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Sims
  simsFiltered.forEach((sim, idx) => {
    const id = `sim:${sim.id}`;
    nodes.push({
      id,
      type: 'sim',
      data: { sim, treeConfig, trackerConfig, currentDay },
      position: savedPos.get(id) ?? { x: 40 + (idx % 5) * 220, y: 40 + Math.floor(idx / 5) * 140 },
    });
  });

  // Unions: do NOT create union nodes in the ReactFlow graph. Instead
  // draw a single marriage edge directly between the two sims when both
  // partners exist. We still keep unions in the data model (unions array)
  // but they won't be rendered as nodes.

  // Layout still uses one primary/current marriage per sim, but we can render
  // additional unions visually as secondary edges without letting them affect
  // spouse grouping/placement.
  const marriageCandidates = [...unions]
    .filter((u) => u.partnerAId && u.partnerBId && visibleSimIds.has(u.partnerAId) && visibleSimIds.has(u.partnerBId))
    .sort((a, b) => {
      const aActive = a.endYear == null ? 1 : 0;
      const bActive = b.endYear == null ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      const aStart = a.startYear ?? -Infinity;
      const bStart = b.startYear ?? -Infinity;
      if (aStart !== bStart) return bStart - aStart;
      const aStartDay = a.startDayOfYear ?? -Infinity;
      const bStartDay = b.startDayOfYear ?? -Infinity;
      if (aStartDay !== bStartDay) return bStartDay - aStartDay;
      return String(a.id).localeCompare(String(b.id));
    });

  const primaryUnionIds = new Set<string>();
  const renderedMarriageSimIds = new Set<string>();
  for (const u of marriageCandidates) {
    if (!u.partnerAId || !u.partnerBId) continue;
    if (renderedMarriageSimIds.has(u.partnerAId) || renderedMarriageSimIds.has(u.partnerBId)) continue;
    renderedMarriageSimIds.add(u.partnerAId);
    renderedMarriageSimIds.add(u.partnerBId);
    primaryUnionIds.add(String(u.id));
  }

  const unionOrderBySim = new Map<string, number>();
  for (const u of marriageCandidates) {
    if (!u.partnerAId || !u.partnerBId) continue;
    const keyA = `${u.partnerAId}:${u.id}`;
    const keyB = `${u.partnerBId}:${u.id}`;
    const idxA = (unionOrderBySim.get(u.partnerAId) ?? 0);
    const idxB = (unionOrderBySim.get(u.partnerBId) ?? 0);
    unionOrderBySim.set(keyA, idxA);
    unionOrderBySim.set(keyB, idxB);
    unionOrderBySim.set(u.partnerAId, idxA + 1);
    unionOrderBySim.set(u.partnerBId, idxB + 1);
  }

  marriageCandidates.forEach((u) => {
    if (!u.partnerAId || !u.partnerBId) return;
    const primary = primaryUnionIds.has(String(u.id));
    const status = u.endReason === 'divorce'
      ? 'divorce'
      : u.endReason === 'death'
      ? 'death'
      : (u.endYear != null ? 'ended' : 'active');
    const secondaryIndex = primary ? 0 : Math.max(
      unionOrderBySim.get(`${u.partnerAId}:${u.id}`) ?? 0,
      unionOrderBySim.get(`${u.partnerBId}:${u.id}`) ?? 0,
    );

    edges.push({
      id: `e:marriage:${u.id}`,
      source: `sim:${u.partnerAId}`,
      target: `sim:${u.partnerBId}`,
      sourceHandle: 'spouse-out',
      targetHandle: 'spouse-in',
      type: 'marriage',
      zIndex: primary ? 10 : 6,
      data: { kind: 'spouse', unionId: u.id, primary, status, secondaryIndex, startYear: u.startYear, endYear: u.endYear, endReason: u.endReason },
    });
  });

  // Children edges derived from sims father/mother
  // Prefer explicit child.birthUnionId. Otherwise, attempt to match union by parents + birthYear.
  const unionsByParents = new Map<string, UnionNode[]>();
  unions.forEach((u) => {
    const a = u.partnerAId;
    const b = u.partnerBId;
    if (!a || !b) return;
    const key = [a, b].sort().join('|');
    const arr = unionsByParents.get(key) ?? [];
    arr.push(u);
    unionsByParents.set(key, arr);
  });

  // Build child edges, sorted oldest->youngest per union when possible.
  const childrenByUnion = new Map<string, SimEntry[]>();
  const fallbackParentEdges: Edge[] = [];

  const addUnionChild = (unionId: string, child: SimEntry) => {
    const key = `union:${unionId}`;
    const arr = childrenByUnion.get(key) ?? [];
    arr.push(child);
    childrenByUnion.set(key, arr);
  };

  simsFiltered.forEach((child) => {
    const f = child.fatherId;
    const m = child.motherId;

    if (child.birthUnionId) {
      addUnionChild(child.birthUnionId, child);
      return;
    }

    if (f && m) {
      const key = [f, m].sort().join('|');
      const candidates = unionsByParents.get(key) ?? [];

      const birthYear = child.birthYear ?? undefined;
      const pick = (() => {
        if (!birthYear || candidates.length === 0) return null;
        const matching = candidates.filter((u) => {
          const start = u.startYear ?? -Infinity;
          const end = u.endYear ?? Infinity;
          return birthYear >= start && birthYear <= end;
        });
        if (matching.length === 0) return null;
        matching.sort((a, b) => (b.startYear ?? 0) - (a.startYear ?? 0));
        return matching[0];
      })();

      if (pick) {
        // Persist the picked union so subsequent renders don't fall back to parent->child edges.
        // (The UI also surfaces ambiguous cases for manual selection.)
        child.birthUnionId = pick.id;
        addUnionChild(pick.id, child);
      } else {
        const childNode = `sim:${child.id}`;
        if (visibleSimIds.has(f)) fallbackParentEdges.push({ id: `e:sim:${f}->${childNode}`, source: `sim:${f}`, target: childNode, sourceHandle: 'parent-out', targetHandle: 'parent-in', type: 'smoothstep', data: { kind: 'parent' } });
        if (visibleSimIds.has(m)) fallbackParentEdges.push({ id: `e:sim:${m}->${childNode}`, source: `sim:${m}`, target: childNode, sourceHandle: 'parent-out', targetHandle: 'parent-in', type: 'smoothstep', data: { kind: 'parent' } });
      }
      return;
    }

    const childNode = `sim:${child.id}`;
    if (f && visibleSimIds.has(f)) fallbackParentEdges.push({ id: `e:sim:${f}->${childNode}`, source: `sim:${f}`, target: childNode, sourceHandle: 'parent-out', targetHandle: 'parent-in', type: 'smoothstep', data: { kind: 'parent' } });
    if (m && visibleSimIds.has(m)) fallbackParentEdges.push({ id: `e:sim:${m}->${childNode}`, source: `sim:${m}`, target: childNode, sourceHandle: 'parent-out', targetHandle: 'parent-in', type: 'smoothstep', data: { kind: 'parent' } });
  });

  // Emit union->child edges sorted by birthYear. Since unions are not
  // rendered as nodes, connect children from the union's primary partner
  // (partnerA) if present, otherwise partnerB. Use the 'trunk' edge type
  // and set sourceHandle 'parent-out' so child lines originate from the
  // parent's out handle.
  for (const [unionNode, kids] of childrenByUnion.entries()) {
    kids.sort((a, b) => {
      const ay = a.birthYear ?? 999999;
      const by = b.birthYear ?? 999999;
      if (ay !== by) return ay - by;
      return String(a.id).localeCompare(String(b.id));
    });

    // unionNode is like "union:XYZ"; extract the id to find the union object
    const unionId = unionNode.replace(/^union:/, '');
    const unionObj = unions.find((u) => String(u.id) === String(unionId));
    const primaryParent = unionObj?.partnerAId ?? unionObj?.partnerBId ?? null;

    kids.forEach((kid, idx) => {
      const childNode = `sim:${kid.id}`;
      const birthYear = kid.birthYear ?? null;
      if (primaryParent && visibleSimIds.has(primaryParent)) {
        edges.push({
          id: `e:union:${unionId}->${childNode}:${idx}`,
          source: `sim:${primaryParent}`,
          target: childNode,
          sourceHandle: 'parent-out',
          targetHandle: 'parent-in',
          type: 'trunk',
          data: { kind: 'parent', birthYear },
        });
      } else {
        // If primary parent isn't visible, fall back to connecting from any visible parent.
        if (unionObj?.partnerAId && visibleSimIds.has(unionObj.partnerAId)) {
          edges.push({ id: `e:union:${unionId}->${childNode}:${idx}:a`, source: `sim:${unionObj.partnerAId}`, target: childNode, sourceHandle: 'parent-out', targetHandle: 'parent-in', type: 'trunk', data: { kind: 'parent', birthYear } });
        } else if (unionObj?.partnerBId && visibleSimIds.has(unionObj.partnerBId)) {
          edges.push({ id: `e:union:${unionId}->${childNode}:${idx}:b`, source: `sim:${unionObj.partnerBId}`, target: childNode, sourceHandle: 'parent-out', targetHandle: 'parent-in', type: 'trunk', data: { kind: 'parent', birthYear } });
        } else {
          // Neither partner visible; nothing to do (children may be connected via fallbackParentEdges)
        }
      }
    });
  }

  edges.push(...fallbackParentEdges);

  return { nodes, edges };
}
