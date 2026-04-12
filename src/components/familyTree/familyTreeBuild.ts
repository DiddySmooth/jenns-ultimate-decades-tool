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

  sims.forEach((child) => {
    const childNode = `sim:${child.id}`;

    // If explicitly assigned, connect that union
    if (child.birthUnionId) {
      const unionNode = `union:${child.birthUnionId}`;
      edges.push({ id: `e:${unionNode}->${childNode}`, source: unionNode, target: childNode, sourceHandle: 'child-out', targetHandle: 'parent-in', type: 'smoothstep', data: { kind: 'parent' } });
      return;
    }

    const f = child.fatherId;
    const m = child.motherId;
    if (f && m) {
      const key = [f, m].sort().join('|');
      const candidates = unionsByParents.get(key) ?? [];

      // Pick best candidate by birthYear if available
      const birthYear = (child.birthYear ?? undefined);
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
        edges.push({ id: `e:union:${pick.id}->${childNode}`, source: `union:${pick.id}`, target: childNode, sourceHandle: 'child-out', targetHandle: 'parent-in', type: 'smoothstep', data: { kind: 'parent' } });
      } else {
        // fallback direct parent edges
        edges.push({ id: `e:sim:${f}->${childNode}`, source: `sim:${f}`, target: childNode, sourceHandle: 'parent-out', targetHandle: 'parent-in', type: 'smoothstep', data: { kind: 'parent' } });
        edges.push({ id: `e:sim:${m}->${childNode}`, source: `sim:${m}`, target: childNode, sourceHandle: 'parent-out', targetHandle: 'parent-in', type: 'smoothstep', data: { kind: 'parent' } });
      }
      return;
    }

    if (f) edges.push({ id: `e:sim:${f}->${childNode}`, source: `sim:${f}`, target: childNode, sourceHandle: 'parent-out', targetHandle: 'parent-in', type: 'smoothstep', data: { kind: 'parent' } });
    if (m) edges.push({ id: `e:sim:${m}->${childNode}`, source: `sim:${m}`, target: childNode, sourceHandle: 'parent-out', targetHandle: 'parent-in', type: 'smoothstep', data: { kind: 'parent' } });
  });

  return { nodes, edges };
}
