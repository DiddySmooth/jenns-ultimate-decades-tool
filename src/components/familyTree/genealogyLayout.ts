import type { Edge, Node } from 'reactflow';

// Simple generational layout — avoid dagre entirely. Positions sims by generation
// then place unions centered between their partners.

// Layout constants
const NODE_W = 180;
const NODE_H = 220;
const GAP_X = 80;  // horizontal gap between sim nodes
const GAP_Y = 160; // vertical gap between generations

export function genealogyLayout(nodes: Node[], edges: Edge[]): Node[] {
  const simNodes = nodes.filter((n) => String(n.id).startsWith('sim:'));
  const unionNodes = nodes.filter((n) => String(n.id).startsWith('union:'));

  // Build union -> [partnerA, partnerB] map from node data
  const unionPartners = new Map<string, string[]>();
  for (const u of unionNodes) {
    const union = (u.data as { union?: { partnerAId?: string; partnerBId?: string } } | undefined)?.union;
    if (!union) continue;
    const partners: string[] = [];
    if (union.partnerAId) partners.push(`sim:${union.partnerAId}`);
    if (union.partnerBId) partners.push(`sim:${union.partnerBId}`);
    unionPartners.set(u.id as string, partners);
  }

  // Build child -> parent sims map
  // For each edge: if source is sim: -> direct parent
  //                if source is union: -> expand to partners
  const childToParentSims = new Map<string, Set<string>>();

  for (const e of edges) {
    const src = String(e.source);
    const tgt = String(e.target);
    if (!tgt.startsWith('sim:')) continue;

    const parentSims: string[] = [];
    if (src.startsWith('sim:')) {
      parentSims.push(src);
    } else if (src.startsWith('union:')) {
      // expand union to its partners
      const partners = unionPartners.get(src) ?? [];
      parentSims.push(...partners);
    }

    const set = childToParentSims.get(tgt) ?? new Set<string>();
    for (const p of parentSims) set.add(p);
    childToParentSims.set(tgt, set);
  }

  // Assign generations
  const genBySim = new Map<string, number>();

  // Roots = sims with no parents
  for (const s of simNodes) {
    const id = s.id as string;
    if (!childToParentSims.has(id) || childToParentSims.get(id)!.size === 0) {
      genBySim.set(id, 0);
    }
  }

  // Iteratively assign gen = max(parent gen) + 1
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 200) {
    changed = false;
    for (const s of simNodes) {
      const id = s.id as string;
      const parents = childToParentSims.get(id);
      if (!parents || parents.size === 0) continue;

      let maxParentGen = -1;
      let allKnown = true;
      for (const p of parents) {
        const pg = genBySim.get(p);
        if (pg === undefined) { allKnown = false; break; }
        if (pg > maxParentGen) maxParentGen = pg;
      }
      if (!allKnown) continue;

      const want = maxParentGen + 1;
      if (genBySim.get(id) !== want) {
        genBySim.set(id, want);
        changed = true;
      }
    }
  }

  // Any sim still without a gen = disconnected, assign 0
  for (const s of simNodes) {
    const id = s.id as string;
    if (!genBySim.has(id)) genBySim.set(id, 0);
  }

  // Group sims by generation
  const gens = new Map<number, string[]>();
  for (const [id, g] of genBySim.entries()) {
    gens.set(g, [...(gens.get(g) ?? []), id]);
  }

  const genKeys = Array.from(gens.keys()).sort((a, b) => a - b);

  // Find widest generation for centering
  let maxWidth = 0;
  for (const g of genKeys) {
    const count = gens.get(g)!.length;
    const w = count * NODE_W + Math.max(0, count - 1) * GAP_X;
    if (w > maxWidth) maxWidth = w;
  }

  // Position each sim
  const positioned = new Map<string, { x: number; y: number }>();
  for (const g of genKeys) {
    const ids = gens.get(g)!;
    const count = ids.length;
    const totalW = count * NODE_W + Math.max(0, count - 1) * GAP_X;
    const startX = (maxWidth - totalW) / 2 + 40;
    const y = 40 + g * (NODE_H + GAP_Y);
    for (let i = 0; i < count; i++) {
      positioned.set(ids[i], { x: startX + i * (NODE_W + GAP_X), y });
    }
  }

  // Build result — clone all nodes then update positions
  const result: Node[] = nodes.map((n) => ({ ...n }));

  for (const s of simNodes) {
    const pos = positioned.get(s.id as string) ?? { x: 40, y: 40 };
    const idx = result.findIndex((r) => r.id === s.id);
    if (idx !== -1) result[idx] = { ...result[idx], position: pos };
  }

  // Place unions at midpoint between their partners
  for (const u of unionNodes) {
    const partners = unionPartners.get(u.id as string) ?? [];
    if (partners.length < 2) continue;
    const apos = positioned.get(partners[0]);
    const bpos = positioned.get(partners[1]);
    if (!apos || !bpos) continue;

    const left  = apos.x <= bpos.x ? apos : bpos;
    const right = apos.x <= bpos.x ? bpos : apos;
    const midX  = (left.x + NODE_W + right.x) / 2;
    const midY  = (left.y + right.y) / 2 + NODE_H / 2;

    const idx = result.findIndex((r) => r.id === u.id);
    if (idx !== -1) result[idx] = { ...result[idx], position: { x: midX - 0.5, y: midY - 0.5 } };
  }

  return result;
}
