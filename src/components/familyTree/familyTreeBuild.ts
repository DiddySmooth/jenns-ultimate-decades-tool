import type { Edge, Node } from 'reactflow';
import type { FamilyTreeState, SimEntry, UnionNode } from '../../types/tracker';

export function buildFamilyTree(
  sims: SimEntry[],
  unions: UnionNode[],
  saved?: FamilyTreeState
): { nodes: Node[]; edges: Edge[] } {
  const savedPos = new Map((saved?.nodes ?? []).map((n) => [n.id, n.position]));

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Sims
  sims.forEach((sim, idx) => {
    const id = `sim:${sim.id}`;
    nodes.push({
      id,
      type: 'sim',
      data: { sim },
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

  sims.forEach((child) => {
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
        fallbackParentEdges.push({ id: `e:sim:${f}->${childNode}`, source: `sim:${f}`, target: childNode, sourceHandle: 'parent-out', targetHandle: 'parent-in', type: 'smoothstep', data: { kind: 'parent' } });
        fallbackParentEdges.push({ id: `e:sim:${m}->${childNode}`, source: `sim:${m}`, target: childNode, sourceHandle: 'parent-out', targetHandle: 'parent-in', type: 'smoothstep', data: { kind: 'parent' } });
      }
      return;
    }

    const childNode = `sim:${child.id}`;
    if (f) fallbackParentEdges.push({ id: `e:sim:${f}->${childNode}`, source: `sim:${f}`, target: childNode, sourceHandle: 'parent-out', targetHandle: 'parent-in', type: 'smoothstep', data: { kind: 'parent' } });
    if (m) fallbackParentEdges.push({ id: `e:sim:${m}->${childNode}`, source: `sim:${m}`, target: childNode, sourceHandle: 'parent-out', targetHandle: 'parent-in', type: 'smoothstep', data: { kind: 'parent' } });
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
