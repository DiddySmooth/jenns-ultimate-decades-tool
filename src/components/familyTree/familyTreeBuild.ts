import type { Edge, Node } from 'reactflow';
import type { FamilyTreeConfig, FamilyTreeState, SimEntry, TrackerConfig, UnionNode } from '../../types/tracker';
import { computeLifeStage } from '../../utils/lifeStage';
import { buildRelationshipGraph } from './graphModel';
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
  // Build canonical relationship graph (people, unions, parentage)
  const graph = buildRelationshipGraph(sims, unions);

  const memo = new Map<string, boolean>();
  const hasLivingDesc = (id: string): boolean => {
    if (memo.has(id)) return memo.get(id)!;
    const simNode = graph.people.get(id);
    if (!simNode) { memo.set(id, false); return false; }
    const sim = simNode.raw;
    if (!isDead(sim)) { memo.set(id, true); return true; }
    const kids = graph.childrenByParent.get(id) ?? [];
    const res = kids.some((kid) => hasLivingDesc(kid));
    memo.set(id, res);
    return res;
  };

  let simsFiltered = sims;

  // NOTE: we intentionally do NOT hide dead sims in the family tree anymore.
  // Dead parents/spouses still define unions and child branches, and removing
  // them makes genealogy ambiguous (especially for remarriage/multi-union cases).

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
  // helper: inferred child count for a union (keeps previous behavior)
  const inferredUnionChildCount = (union: any): number => {
    const a = union.partnerAId;
    const b = union.partnerBId;
    if (!a || !b) return 0;
    return sims.filter((s) => {
      if (s.birthUnionId === union.id) return true;
      const parentsMatch = (s.fatherId === a && s.motherId === b) || (s.fatherId === b && s.motherId === a);
      return parentsMatch;
    }).length;
  };

  const marriageCandidates = [...unions]
    .filter((u) => u.partnerAId && u.partnerBId && visibleSimIds.has(u.partnerAId) && visibleSimIds.has(u.partnerBId))
    .sort((a, b) => {
      const aActive = a.endYear == null ? 1 : 0;
      const bActive = b.endYear == null ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;

      // Prefer the union that is actually functioning as the main family branch
      // (has children) over a newer-but-childless active union.
      const aKids = inferredUnionChildCount(a);
      const bKids = inferredUnionChildCount(b);
      if (aKids !== bKids) return bKids - aKids;

      const aStart = a.startYear ?? -Infinity;
      const bStart = b.startYear ?? -Infinity;
      if (aStart !== bStart) return aStart - bStart;
      const aStartDay = a.startDayOfYear ?? -Infinity;
      const bStartDay = b.startDayOfYear ?? -Infinity;
      if (aStartDay !== bStartDay) return aStartDay - bStartDay;
      return String(a.id).localeCompare(String(b.id));
    });

  const primaryUnionIds = new Set<string>();

  // Choose a primary union PER SIM first, then only mark a union primary when both
  // partners agree on that same union. This avoids one sim in a harem stealing the
  // wrong primary just because unions were globally sorted.
  const unionsBySim = new Map<string, UnionNode[]>();
  for (const u of marriageCandidates) {
    if (!u.partnerAId || !u.partnerBId) continue;
    unionsBySim.set(u.partnerAId, [...(unionsBySim.get(u.partnerAId) ?? []), u]);
    unionsBySim.set(u.partnerBId, [...(unionsBySim.get(u.partnerBId) ?? []), u]);
  }

  const preferredPrimaryBySim = new Map<string, string>();
  for (const [simId, simUnions] of unionsBySim) {
    const sorted = [...simUnions].sort((a, b) => {
      const aActive = a.endYear == null ? 1 : 0;
      const bActive = b.endYear == null ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      const aKids = inferredUnionChildCount(a);
      const bKids = inferredUnionChildCount(b);
      if (aKids !== bKids) return bKids - aKids;
      const aStart = a.startYear ?? Infinity;
      const bStart = b.startYear ?? Infinity;
      if (aStart !== bStart) return aStart - bStart;
      const aStartDay = a.startDayOfYear ?? Infinity;
      const bStartDay = b.startDayOfYear ?? Infinity;
      if (aStartDay !== bStartDay) return aStartDay - bStartDay;
      return String(a.id).localeCompare(String(b.id));
    });
    if (sorted[0]) preferredPrimaryBySim.set(simId, String(sorted[0].id));
  }

  for (const u of marriageCandidates) {
    if (!u.partnerAId || !u.partnerBId) continue;
    const preferredA = preferredPrimaryBySim.get(u.partnerAId);
    const preferredB = preferredPrimaryBySim.get(u.partnerBId);
    if (preferredA === String(u.id) && preferredB === String(u.id)) {
      primaryUnionIds.add(String(u.id));
    }
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
    const multiUnion = (unionOrderBySim.get(u.partnerAId) ?? 0) > 1 || (unionOrderBySim.get(u.partnerBId) ?? 0) > 1;
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
      zIndex: primary ? 100 : 90,
      data: { kind: 'spouse', unionId: u.id, primary, multiUnion, status, secondaryIndex, startYear: u.startYear, endYear: u.endYear, endReason: u.endReason },
    });
  });

  // Children edges derived from sims father/mother
  // Prefer explicit child.birthUnionId. Otherwise, attempt to match union by parents + birthYear.
  // Use the relationship graph's unions-by-parents map as a starting point
  const unionsByParents = graph.unionsByParents;

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

      // map union ids to union objects
      const candidateObjs = candidates.map((id) => graph.unions.get(String(id))).filter(Boolean) as any[];

      const birthYear = child.birthYear ?? undefined;
      const pick = (() => {
        if (candidateObjs.length === 0) return null;
        if (candidateObjs.length === 1) return candidateObjs[0];
        if (birthYear) {
          const matching = candidateObjs.filter((u) => {
            const start = u.startYear ?? -Infinity;
            const end = u.endYear ?? Infinity;
            return birthYear >= start && birthYear <= end;
          });
          if (matching.length === 1) return matching[0];
          if (matching.length > 1) {
            matching.sort((a, b) => (b.startYear ?? 0) - (a.startYear ?? 0));
            return matching[0];
          }
        }
        const latest = [...candidateObjs].sort((a, b) => (b.startYear ?? 0) - (a.startYear ?? 0));
        return latest[0] ?? null;
      })();

      if (pick) {
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
          data: { kind: 'parent', birthYear, unionId },
        });
      } else {
        // If primary parent isn't visible, fall back to connecting from any visible parent.
        if (unionObj?.partnerAId && visibleSimIds.has(unionObj.partnerAId)) {
          edges.push({ id: `e:union:${unionId}->${childNode}:${idx}:a`, source: `sim:${unionObj.partnerAId}`, target: childNode, sourceHandle: 'parent-out', targetHandle: 'parent-in', type: 'trunk', data: { kind: 'parent', birthYear, unionId } });
        } else if (unionObj?.partnerBId && visibleSimIds.has(unionObj.partnerBId)) {
          edges.push({ id: `e:union:${unionId}->${childNode}:${idx}:b`, source: `sim:${unionObj.partnerBId}`, target: childNode, sourceHandle: 'parent-out', targetHandle: 'parent-in', type: 'trunk', data: { kind: 'parent', birthYear, unionId } });
        } else {
          // Neither partner visible; nothing to do (children may be connected via fallbackParentEdges)
        }
      }
    });
  }

  edges.push(...fallbackParentEdges);

  return { nodes, edges };
}
