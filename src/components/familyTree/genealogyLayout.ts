import dagre from 'dagre';
import type { Edge, Node } from 'reactflow';

type EdgeData = { kind?: string; birthYear?: number };
const getKind = (e: Edge): string | undefined => (e.data as EdgeData | undefined)?.kind;
const getBirthYear = (e: Edge): number | undefined => (e.data as EdgeData | undefined)?.birthYear;

// Node sizes (match CSS roughly)
const SIM_W = 170;
const SIM_H = 210;
const UNION_W = 26;
const UNION_H = 26;

export function genealogyLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));

  // Top-to-bottom
  g.setGraph({
    rankdir: 'TB',
    nodesep: 60,
    ranksep: 140,
    ranker: 'tight-tree',
  });

  for (const n of nodes) {
    const isUnion = n.type === 'union' || n.id.startsWith('union:');
    g.setNode(n.id, {
      width: isUnion ? UNION_W : SIM_W,
      height: isUnion ? UNION_H : SIM_H,
    });
  }

  // Only use parent/child edges for layout ranking — spouse edges cause rank conflicts
  const sortedEdges = [...edges].sort((a, b) => {
    const ak = getKind(a);
    const bk = getKind(b);
    if (ak === 'parent' && bk !== 'parent') return -1;
    if (ak !== 'parent' && bk === 'parent') return 1;
    if (ak === 'parent' && bk === 'parent') {
      const ay = getBirthYear(a) ?? 999999;
      const by = getBirthYear(b) ?? 999999;
      if (ay !== by) return ay - by;
    }
    return String(a.id).localeCompare(String(b.id));
  });

  for (const e of sortedEdges) {
    const kind = getKind(e);
    if (kind === 'spouse') {
      // Spouse edges keep partners on the same rank
      g.setEdge(e.source, e.target, { minlen: 0, weight: 2 });
    } else {
      g.setEdge(e.source, e.target, { weight: 1 });
    }
  }

  dagre.layout(g);

  return nodes.map((n) => {
    const p = g.node(n.id);
    if (!p) return n;
    return {
      ...n,
      position: {
        x: p.x - p.width / 2,
        y: p.y - p.height / 2,
      },
    };
  });
}
