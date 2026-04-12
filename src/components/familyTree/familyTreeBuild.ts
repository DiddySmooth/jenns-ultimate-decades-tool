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
    nodes.push({
      id,
      type: 'union',
      data: { union: u },
      position: savedPos.get(id) ?? { x: 180 + (idx % 5) * 220, y: 100 + Math.floor(idx / 5) * 140 },
    });

    if (u.partnerAId) {
      edges.push({ id: `e:${id}:a`, source: `sim:${u.partnerAId}`, target: id, type: 'partner' });
    }
    if (u.partnerBId) {
      edges.push({ id: `e:${id}:b`, source: `sim:${u.partnerBId}`, target: id, type: 'partner' });
    }
  });

  // Children edges derived from sims father/mother
  // If a union matches parents, connect union->child. If ambiguous/missing, connect parent->child directly.
  const unionByParents = new Map<string, string>();
  unions.forEach((u) => {
    const a = u.partnerAId;
    const b = u.partnerBId;
    if (!a || !b) return;
    unionByParents.set([a, b].sort().join('|'), `union:${u.id}`);
  });

  sims.forEach((child) => {
    const childNode = `sim:${child.id}`;
    const f = child.fatherId;
    const m = child.motherId;
    if (f && m) {
      const key = [f, m].sort().join('|');
      const unionNode = unionByParents.get(key);
      if (unionNode) {
        edges.push({ id: `e:${unionNode}->${childNode}`, source: unionNode, target: childNode, type: 'parent' });
      } else {
        edges.push({ id: `e:sim:${f}->${childNode}`, source: `sim:${f}`, target: childNode, type: 'parent' });
        edges.push({ id: `e:sim:${m}->${childNode}`, source: `sim:${m}`, target: childNode, type: 'parent' });
      }
      return;
    }
    if (f) edges.push({ id: `e:sim:${f}->${childNode}`, source: `sim:${f}`, target: childNode, type: 'parent' });
    if (m) edges.push({ id: `e:sim:${m}->${childNode}`, source: `sim:${m}`, target: childNode, type: 'parent' });
  });

  return { nodes, edges };
}
