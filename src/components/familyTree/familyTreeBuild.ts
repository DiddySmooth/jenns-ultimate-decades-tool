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

  // Unions
  unions.forEach((u, idx) => {
    const id = `union:${u.id}`;

    // Default union position: use saved position, otherwise place near the midpoint of partners if possible.
    const fallbackPos = (() => {
      const a = u.partnerAId ? savedPos.get(`sim:${u.partnerAId}`) : null;
      const b = u.partnerBId ? savedPos.get(`sim:${u.partnerBId}`) : null;
      if (a && b) return { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) + 60 };
      return { x: 180 + (idx % 5) * 220, y: 100 + Math.floor(idx / 5) * 140 };
    })();

    nodes.push({
      id,
      type: 'union',
      data: { union: u },
      position: savedPos.get(id) ?? fallbackPos,
    });

    // Marriage edge drawn directly between partners (union node is used as child anchor)
    if (u.partnerAId && u.partnerBId) {
      edges.push({
        id: `e:marriage:${u.id}`,
        source: `sim:${u.partnerAId}`,
        target: `sim:${u.partnerBId}`,
        sourceHandle: 'spouse-out',
        targetHandle: 'spouse-in',
        type: 'straight',
        data: { kind: 'marriage', unionId: u.id },
      });
    }
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

  // Emit union->child edges sorted by birthYear
  for (const [unionNode, kids] of childrenByUnion.entries()) {
    kids.sort((a, b) => {
      const ay = a.birthYear ?? 999999;
      const by = b.birthYear ?? 999999;
      if (ay !== by) return ay - by;
      return String(a.id).localeCompare(String(b.id));
    });

    kids.forEach((kid, idx) => {
      const childNode = `sim:${kid.id}`;
      const birthYear = kid.birthYear ?? null;
      edges.push({
        id: `e:${unionNode}->${childNode}:${idx}`,
        source: unionNode,
        target: childNode,
        sourceHandle: 'child-out',
        targetHandle: 'parent-in',
        type: 'smoothstep',
        data: { kind: 'parent', birthYear },
      });
    });
  }

  edges.push(...fallbackParentEdges);


  return { nodes, edges };
}
