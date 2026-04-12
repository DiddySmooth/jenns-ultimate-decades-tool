import dagre from 'dagre';
import type { Edge, Node } from 'reactflow';

// Node sizes (match CSS roughly)
const SIM_W = 160;
const SIM_H = 56;
const UNION_W = 26;
const UNION_H = 26;

export function genealogyLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));

  // Top-to-bottom
  g.setGraph({
    rankdir: 'TB',
    nodesep: 40,
    ranksep: 80,
  });

  for (const n of nodes) {
    const isUnion = n.type === 'union' || n.id.startsWith('union:');
    g.setNode(n.id, {
      width: isUnion ? UNION_W : SIM_W,
      height: isUnion ? UNION_H : SIM_H,
    });
  }

  for (const e of edges) {
    g.setEdge(e.source, e.target);
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
