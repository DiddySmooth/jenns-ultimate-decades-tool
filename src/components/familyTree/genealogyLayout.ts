import type { Edge, Node } from 'reactflow';

const NODE_W = 180;
const NODE_H = 220;
const GAP_X = 60;   // gap between sim nodes in same generation
const GAP_COUPLE = 20; // tighter gap between spouses
const GAP_Y = 180;  // vertical gap between generations

export function genealogyLayout(nodes: Node[], edges: Edge[]): Node[] {
  const simNodes = nodes.filter((n) => String(n.id).startsWith('sim:'));
  const unionNodes = nodes.filter((n) => String(n.id).startsWith('union:'));

  // Build union -> [partnerA, partnerB] from node data
  const unionPartners = new Map<string, [string, string]>();
  for (const u of unionNodes) {
    const union = (u.data as { union?: { partnerAId?: string; partnerBId?: string } } | undefined)?.union;
    if (!union?.partnerAId || !union?.partnerBId) continue;
    unionPartners.set(u.id as string, [`sim:${union.partnerAId}`, `sim:${union.partnerBId}`]);
  }

  // Build spouse sets (bidirectional)
  const spouseOf = new Map<string, string>();
  for (const [, [a, b]] of unionPartners) {
    // Only set if not already set (first union wins for layout purposes)
    if (!spouseOf.has(a)) spouseOf.set(a, b);
    if (!spouseOf.has(b)) spouseOf.set(b, a);
  }

  // Build child -> parent sims map (expand union sources to partners)
  const childToParentSims = new Map<string, Set<string>>();
  for (const e of edges) {
    const src = String(e.source);
    const tgt = String(e.target);
    if (!tgt.startsWith('sim:')) continue;
    const parentSims: string[] = [];
    if (src.startsWith('sim:')) {
      parentSims.push(src);
    } else if (src.startsWith('union:')) {
      const partners = unionPartners.get(src);
      if (partners) parentSims.push(...partners);
    }
    const set = childToParentSims.get(tgt) ?? new Set<string>();
    for (const p of parentSims) set.add(p);
    childToParentSims.set(tgt, set);
  }

  // Assign generations
  const genBySim = new Map<string, number>();
  for (const s of simNodes) {
    const id = s.id as string;
    if (!childToParentSims.has(id) || childToParentSims.get(id)!.size === 0) {
      genBySim.set(id, 0);
    }
  }
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 300) {
    changed = false;
    for (const s of simNodes) {
      const id = s.id as string;
      const parents = childToParentSims.get(id);
      if (!parents || parents.size === 0) continue;
      let maxPG = -1;
      let allKnown = true;
      for (const p of parents) {
        const pg = genBySim.get(p);
        if (pg === undefined) { allKnown = false; break; }
        if (pg > maxPG) maxPG = pg;
      }
      if (!allKnown) continue;
      const want = maxPG + 1;
      if (genBySim.get(id) !== want) { genBySim.set(id, want); changed = true; }
    }
  }
  for (const s of simNodes) {
    if (!genBySim.has(s.id as string)) genBySim.set(s.id as string, 0);
  }

  // Married-in sims: if a sim has no parents but their spouse has a generation,
  // place them on the same generation as their spouse instead of gen 0
  for (const s of simNodes) {
    const id = s.id as string;
    const parents = childToParentSims.get(id);
    const hasParents = parents && parents.size > 0;
    if (hasParents) continue; // skip sims with known parents
    const spouse = spouseOf.get(id);
    if (!spouse) continue;
    const spouseGen = genBySim.get(spouse);
    if (spouseGen !== undefined && spouseGen > 0) {
      genBySim.set(id, spouseGen);
    }
  }

  // Group by generation
  const gens = new Map<number, string[]>();
  for (const [id, g] of genBySim) gens.set(g, [...(gens.get(g) ?? []), id]);
  const genKeys = Array.from(gens.keys()).sort((a, b) => a - b);

  // Sort each generation: group spouses together, order couples by their children's future position
  // Simple approach: pair up spouses, then order pairs by earliest child index in next gen
  const sortedGens = new Map<number, string[]>();
  for (const g of genKeys) {
    const ids = new Set(gens.get(g)!);
    const ordered: string[] = [];
    const visited = new Set<string>();

    for (const id of ids) {
      if (visited.has(id)) continue;
      visited.add(id);
      ordered.push(id);
      // If this sim has a spouse in the same generation, place spouse immediately after
      const spouse = spouseOf.get(id);
      if (spouse && ids.has(spouse) && !visited.has(spouse)) {
        visited.add(spouse);
        ordered.push(spouse);
      }
    }
    sortedGens.set(g, ordered);
  }

  // Compute X positions — couples get GAP_COUPLE between them, others get GAP_X
  const positioned = new Map<string, { x: number; y: number }>();

  // First pass: compute total widths
  const genWidths = new Map<number, number>();
  for (const g of genKeys) {
    const ids = sortedGens.get(g)!;
    let w = 0;
    for (let i = 0; i < ids.length; i++) {
      if (i > 0) {
        const prev = ids[i - 1];
        const cur = ids[i];
        // Use tighter gap if this is a couple
        const gap = spouseOf.get(prev) === cur ? GAP_COUPLE : GAP_X;
        w += gap;
      }
      w += NODE_W;
    }
    genWidths.set(g, w);
  }

  const maxWidth = Math.max(...Array.from(genWidths.values()), 0);

  // Second pass: assign positions
  for (const g of genKeys) {
    const ids = sortedGens.get(g)!;
    const totalW = genWidths.get(g)!;
    const startX = (maxWidth - totalW) / 2 + 40;
    const y = 40 + g * (NODE_H + GAP_Y);
    let x = startX;
    for (let i = 0; i < ids.length; i++) {
      if (i > 0) {
        const prev = ids[i - 1];
        const cur = ids[i];
        x += spouseOf.get(prev) === cur ? GAP_COUPLE : GAP_X;
      }
      positioned.set(ids[i], { x, y });
      x += NODE_W;
    }
  }

  // Build result
  const result: Node[] = nodes.map((n) => ({ ...n }));

  for (const s of simNodes) {
    const pos = positioned.get(s.id as string) ?? { x: 40, y: 40 };
    const idx = result.findIndex((r) => r.id === s.id);
    if (idx !== -1) result[idx] = { ...result[idx], position: pos };
  }

  // Place unions at midpoint between partners
  for (const u of unionNodes) {
    const partners = unionPartners.get(u.id as string);
    if (!partners) continue;
    const apos = positioned.get(partners[0]);
    const bpos = positioned.get(partners[1]);
    if (!apos || !bpos) continue;
    const midX = (apos.x + bpos.x + NODE_W) / 2;
    const midY = (apos.y + bpos.y) / 2 + NODE_H / 2;
    const idx = result.findIndex((r) => r.id === u.id);
    if (idx !== -1) result[idx] = { ...result[idx], position: { x: midX - 0.5, y: midY - 0.5 } };
  }

  return result;
}
