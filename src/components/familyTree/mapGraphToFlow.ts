import type { Edge, Node } from 'reactflow';
import type { FamilyTreeConfig, FamilyTreeState, SimEntry, TrackerConfig, UnionNode } from '../../types/tracker';
import type { RelationshipGraph, Union } from './graphModel';

export function mapGraphToFlow(
  graph: RelationshipGraph,
  simsFiltered: SimEntry[],
  unions: UnionNode[],
  saved: FamilyTreeState | undefined,
  treeConfig: FamilyTreeConfig,
  trackerConfig: TrackerConfig,
  currentDay: number,
): { nodes: Node[]; edges: Edge[] } {
  const savedPos = new Map((saved?.nodes ?? []).map((n) => [n.id, n.position]));
  const visibleSimIds = new Set(simsFiltered.map((s) => s.id));

  const nodes: Node[] = simsFiltered.map((sim, idx) => ({
    id: `sim:${sim.id}`,
    type: 'sim',
    data: { sim, treeConfig, trackerConfig, currentDay },
    position: savedPos.get(`sim:${sim.id}`) ?? { x: 40 + (idx % 5) * 220, y: 40 + Math.floor(idx / 5) * 140 },
  }));

  const edges: Edge[] = [];

  const inferredUnionChildCount = (union: UnionNode): number => {
    const a = union.partnerAId;
    const b = union.partnerBId;
    if (!a || !b) return 0;
    return simsFiltered.filter((s) => {
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

  const primaryUnionIds = new Set<string>();
  for (const u of marriageCandidates) {
    if (!u.partnerAId || !u.partnerBId) continue;
    if (preferredPrimaryBySim.get(u.partnerAId) === String(u.id) && preferredPrimaryBySim.get(u.partnerBId) === String(u.id)) {
      primaryUnionIds.add(String(u.id));
    }
  }

  const unionOrderBySim = new Map<string, number>();
  for (const u of marriageCandidates) {
    if (!u.partnerAId || !u.partnerBId) continue;
    const keyA = `${u.partnerAId}:${u.id}`;
    const keyB = `${u.partnerBId}:${u.id}`;
    const idxA = unionOrderBySim.get(u.partnerAId) ?? 0;
    const idxB = unionOrderBySim.get(u.partnerBId) ?? 0;
    unionOrderBySim.set(keyA, idxA);
    unionOrderBySim.set(keyB, idxB);
    unionOrderBySim.set(u.partnerAId, idxA + 1);
    unionOrderBySim.set(u.partnerBId, idxB + 1);
  }

  // multiUnion = true if EITHER partner is in more than 1 union total
  const multiUnionSims = new Set<string>();
  for (const [simId, count] of unionOrderBySim) {
    // unionOrderBySim stores both per-union keys (simId:unionId) and total counts (simId)
    // Total count key is just the simId without colon-union suffix
    if (!simId.includes(':') && count > 1) multiUnionSims.add(simId);
  }

  for (const u of marriageCandidates) {
    if (!u.partnerAId || !u.partnerBId) continue;
    const primary = primaryUnionIds.has(String(u.id));
    const multiUnion = multiUnionSims.has(u.partnerAId) || multiUnionSims.has(u.partnerBId);
    const status = u.endReason === 'divorce' ? 'divorce' : u.endReason === 'death' ? 'death' : (u.endYear != null ? 'ended' : 'active');
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
  }

  const childrenByUnion = new Map<string, SimEntry[]>();
  const fallbackParentEdges: Edge[] = [];
  const addUnionChild = (unionId: string, child: SimEntry) => {
    const arr = childrenByUnion.get(unionId) ?? [];
    arr.push(child);
    childrenByUnion.set(unionId, arr);
  };

  for (const child of simsFiltered) {
    const f = child.fatherId;
    const m = child.motherId;
    if (child.birthUnionId) {
      addUnionChild(String(child.birthUnionId), child);
      continue;
    }
    if (f && m) {
      const key = [f, m].sort().join('|');
      const candidateIds = graph.unionsByParents.get(key) ?? [];
      const candidateObjs = candidateIds.map((id) => graph.unions.get(String(id))).filter(Boolean) as Union[];
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
          if (matching.length > 1) return [...matching].sort((a, b) => (b.startYear ?? 0) - (a.startYear ?? 0))[0];
        }
        return [...candidateObjs].sort((a, b) => (b.startYear ?? 0) - (a.startYear ?? 0))[0] ?? null;
      })();
      if (pick) {
        addUnionChild(String(pick.id), child);
      } else {
        const childNode = `sim:${child.id}`;
        if (f && visibleSimIds.has(f)) fallbackParentEdges.push({ id: `e:sim:${f}->${childNode}`, source: `sim:${f}`, target: childNode, sourceHandle: 'parent-out', targetHandle: 'parent-in', type: 'smoothstep', data: { kind: 'parent' } });
        if (m && visibleSimIds.has(m)) fallbackParentEdges.push({ id: `e:sim:${m}->${childNode}`, source: `sim:${m}`, target: childNode, sourceHandle: 'parent-out', targetHandle: 'parent-in', type: 'smoothstep', data: { kind: 'parent' } });
      }
      continue;
    }
    const childNode = `sim:${child.id}`;
    if (f && visibleSimIds.has(f)) fallbackParentEdges.push({ id: `e:sim:${f}->${childNode}`, source: `sim:${f}`, target: childNode, sourceHandle: 'parent-out', targetHandle: 'parent-in', type: 'smoothstep', data: { kind: 'parent' } });
    if (m && visibleSimIds.has(m)) fallbackParentEdges.push({ id: `e:sim:${m}->${childNode}`, source: `sim:${m}`, target: childNode, sourceHandle: 'parent-out', targetHandle: 'parent-in', type: 'smoothstep', data: { kind: 'parent' } });
  }

  for (const [unionId, kids] of childrenByUnion.entries()) {
    kids.sort((a, b) => {
      const ay = a.birthYear ?? 999999;
      const by = b.birthYear ?? 999999;
      if (ay !== by) return ay - by;
      return String(a.id).localeCompare(String(b.id));
    });

    const unionObj = unions.find((u) => String(u.id) === unionId);
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
      } else if (unionObj?.partnerAId && visibleSimIds.has(unionObj.partnerAId)) {
        edges.push({ id: `e:union:${unionId}->${childNode}:${idx}:a`, source: `sim:${unionObj.partnerAId}`, target: childNode, sourceHandle: 'parent-out', targetHandle: 'parent-in', type: 'trunk', data: { kind: 'parent', birthYear, unionId } });
      } else if (unionObj?.partnerBId && visibleSimIds.has(unionObj.partnerBId)) {
        edges.push({ id: `e:union:${unionId}->${childNode}:${idx}:b`, source: `sim:${unionObj.partnerBId}`, target: childNode, sourceHandle: 'parent-out', targetHandle: 'parent-in', type: 'trunk', data: { kind: 'parent', birthYear, unionId } });
      }
    });
  }

  edges.push(...fallbackParentEdges);
  return { nodes, edges };
}
