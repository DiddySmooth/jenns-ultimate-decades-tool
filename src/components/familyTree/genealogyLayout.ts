import type { Edge, Node } from 'reactflow';

// Simple generational layout — avoid dagre entirely. Positions sims by generation
// then place unions centered between their partners.

type EdgeData = { kind?: string; birthYear?: number };
const getKind = (e: Edge): string | undefined => (e.data as EdgeData | undefined)?.kind;
const getBirthYear = (e: Edge): number | undefined => (e.data as EdgeData | undefined)?.birthYear;

// Layout constants
const NODE_W = 180;
const NODE_H = 220;
const GAP_X = 80; // horizontal gap between sim nodes
const GAP_Y = 160; // vertical gap between generations

export function genealogyLayout(nodes: Node[], edges: Edge[]): Node[] {
  // Build parent -> children map using only edges where source starts with sim: or union: and target starts with sim:
  const parentMap = new Map<string, string[]>();
  const childParents = new Map<string, Set<string>>();

  for (const e of edges) {
    if (!String(e.target).startsWith('sim:')) continue;
    if (!(String(e.source).startsWith('sim:') || String(e.source).startsWith('union:'))) continue;
    const src = String(e.source);
    const tgt = String(e.target);
    parentMap.set(src, [...(parentMap.get(src) ?? []), tgt]);
    const set = childParents.get(tgt) ?? new Set<string>();
    set.add(src);
    childParents.set(tgt, set);
  }

  // Find all sim nodes
  const simNodes = nodes.filter((n) => String(n.id).startsWith('sim:'));
  const unionNodes = nodes.filter((n) => String(n.id).startsWith('union:'));

  // Assign generations: sims with no parents => gen 0. Children = max(parent gen) + 1
  const genBySim = new Map<string, number>();

  // Initialize roots
  for (const s of simNodes) {
    const id = s.id;
    const parents = childParents.get(id) ?? new Set();
    if (parents.size === 0) genBySim.set(id as string, 0);
  }

  // Iteratively assign generations until stable
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of simNodes) {
      const id = s.id as string;
      const parents = childParents.get(id) ?? new Set();
      if (parents.size === 0) continue; // already maybe gen 0
      let maxParentGen = -Infinity;
      let unknown = false;
      for (const p of parents) {
        const pg = genBySim.get(p);
        if (pg === undefined) {
          unknown = true;
          break;
        }
        if (pg > maxParentGen) maxParentGen = pg;
      }
      if (unknown) continue;
      const want = maxParentGen + 1;
      const cur = genBySim.get(id);
      if (cur === undefined || cur !== want) {
        genBySim.set(id, want);
        changed = true;
      }
    }
    // Any sims still without gen assign to 0 (disconnected components)
    for (const s of simNodes) {
      const id = s.id as string;
      if (!genBySim.has(id)) {
        genBySim.set(id, 0);
        changed = true;
      }
    }
  }

  // Group sims by generation
  const gens = new Map<number, string[]>();
  for (const [id, g] of genBySim.entries()) {
    gens.set(g, [...(gens.get(g) ?? []), id]);
  }

  // Sort generations ascending
  const genKeys = Array.from(gens.keys()).sort((a, b) => a - b);

  // For each generation, assign X positions spaced by NODE_W + GAP_X
  const positioned = new Map<string, { x: number; y: number }>();
  let maxWidth = 0;
  for (const g of genKeys) {
    const ids = gens.get(g) ?? [];
    const count = ids.length;
    const totalW = count * NODE_W + Math.max(0, count - 1) * GAP_X;
    if (totalW > maxWidth) maxWidth = totalW;
  }

  for (const g of genKeys) {
    const ids = gens.get(g) ?? [];
    const count = ids.length;
    const totalW = count * NODE_W + Math.max(0, count - 1) * GAP_X;
    // startX so generation is centered relative to widest generation
    const startX = (maxWidth - totalW) / 2 + 40; // small left padding
    const y = 40 + g * (NODE_H + GAP_Y);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const x = startX + i * (NODE_W + GAP_X);
      positioned.set(id, { x, y });
    }
  }

  // Build result nodes: sims positioned, unions placed at midpoint between partners
  const result: Node[] = nodes.map((n) => ({ ...n }));

  // Place sim nodes
  for (const s of simNodes) {
    const pos = positioned.get(s.id as string) ?? { x: 40, y: 40 };
    const idx = result.findIndex((r) => r.id === s.id);
    if (idx !== -1) result[idx] = { ...result[idx], position: { x: pos.x, y: pos.y } };
  }

  // Place unions at midpoint between partners (same Y as partners). If partners missing, leave existing position.
  for (const u of unionNodes) {
    const data = u.data as { union?: unknown } | undefined;
    const union = data?.union as { partnerAId?: string; partnerBId?: string } | undefined;
    if (!union || !union.partnerAId || !union.partnerBId) continue;
    const aId = `sim:${union.partnerAId}`;
    const bId = `sim:${union.partnerBId}`;
    const apos = positioned.get(aId);
    const bpos = positioned.get(bId);
    const idx = result.findIndex((r) => r.id === u.id);
    if (idx === -1) continue;
    if (!apos || !bpos) continue;

    // midpoint between right edge of left node and left edge of right node
    const left = apos.x <= bpos.x ? apos : bpos;
    const right = apos.x <= bpos.x ? bpos : apos;
    const leftEndX = left.x + NODE_W;
    const rightEndX = right.x;
    const midX = (leftEndX + rightEndX) / 2;
    const ay = left.y + NODE_H / 2;
    const by = right.y + NODE_H / 2;
    const lineY = (ay + by) / 2;

    const unionX = midX - 1 / 2; // union node small; center at midpoint
    const unionY = lineY - 1 / 2;

    result[idx] = { ...result[idx], position: { x: unionX, y: unionY } };
  }

  return result;
}
