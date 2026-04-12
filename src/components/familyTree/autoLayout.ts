import type { FamilyTreeState } from '../../types/tracker';

// Very simple layout for MVP:
// - Place couples (union nodes) in rows, with partners on left/right
// - Place children below
// This is NOT a full genealogy layout engine (we can replace with dagre/elk later).

export function autoLayoutFamilyTree(state: FamilyTreeState): FamilyTreeState {
  const nodes = [...(state.nodes ?? [])];

  // naive: keep existing positions if present
  if (nodes.length === 0) return state;

  const simNodes = nodes.filter((n) => n.id.startsWith('sim:'));
  const unionNodes = nodes.filter((n) => n.id.startsWith('union:'));

  // Grid sims if nothing set
  simNodes.forEach((n, idx) => {
    if (n.position && (n.position.x !== 0 || n.position.y !== 0)) return;
    n.position = { x: 40 + (idx % 6) * 220, y: 40 + Math.floor(idx / 6) * 140 };
  });

  // Grid unions nearby
  unionNodes.forEach((n, idx) => {
    if (n.position && (n.position.x !== 0 || n.position.y !== 0)) return;
    n.position = { x: 150 + (idx % 6) * 220, y: 100 + Math.floor(idx / 6) * 140 };
  });

  return { ...state, nodes, edges: state.edges ?? [] };
}
