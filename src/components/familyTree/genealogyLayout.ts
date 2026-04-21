import type { Edge, Node } from 'reactflow';

const NODE_W = 180;
const NODE_H = 220;
const GAP_X = 60;   // gap between sim nodes in same generation
const GAP_COUPLE = 20; // tighter gap between spouses
const GAP_Y = 120;  // vertical gap between generations — needs to be tall enough for trunk lines to clear cards

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
    // Only use parent edges — spouse edges would make partners appear as each other's parents
    const kind = (e.data as { kind?: string } | undefined)?.kind;
    if (kind === 'spouse') continue;
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

  // Third pass: nudge each sim group to center under their parents
  // For each union, find all its children and center them as a group under the union midpoint
  const childrenByUnion = new Map<string, string[]>();
  for (const e of edges) {
    const src = String(e.source);
    const tgt = String(e.target);
    const kind = (e.data as { kind?: string } | undefined)?.kind;
    if (kind !== 'parent' || !tgt.startsWith('sim:') || !src.startsWith('union:')) continue;
    const arr = childrenByUnion.get(src) ?? [];
    arr.push(tgt);
    childrenByUnion.set(src, arr);
  }

  for (const u of unionNodes) {
    const uid = u.id as string;
    const partners = unionPartners.get(uid);
    if (!partners) continue;
    const pA = positioned.get(partners[0]);
    const pB = positioned.get(partners[1]);
    if (!pA || !pB) continue;
    const parentMidX = (pA.x + pB.x + NODE_W) / 2;

    const children = childrenByUnion.get(uid) ?? [];
    if (children.length === 0) continue;

    // Get current child positions
    const childPositions = children.map(c => positioned.get(c)).filter(Boolean) as { x: number; y: number }[];
    if (childPositions.length === 0) continue;

    // Current center of children group
    const leftmost = Math.min(...childPositions.map(p => p.x));
    const rightmost = Math.max(...childPositions.map(p => p.x)) + NODE_W;
    const childGroupMidX = (leftmost + rightmost) / 2;

    // Shift all children to center under parents
    const shift = parentMidX - childGroupMidX;
    if (Math.abs(shift) > 1) {
      for (const c of children) {
        const pos = positioned.get(c);
        if (pos) positioned.set(c, { x: pos.x + shift, y: pos.y });
      }
    }
  }

  // Final pass: fix overlapping nodes within each generation
  for (const g of genKeys) {
    const ids = sortedGens.get(g)!;
    // Sort by current X position
    ids.sort((a, b) => (positioned.get(a)?.x ?? 0) - (positioned.get(b)?.x ?? 0));
    for (let i = 1; i < ids.length; i++) {
      const prev = positioned.get(ids[i - 1]);
      const cur = positioned.get(ids[i]);
      if (!prev || !cur) continue;
      const gap = spouseOf.get(ids[i - 1]) === ids[i] ? GAP_COUPLE : GAP_X;
      const minX = prev.x + NODE_W + gap;
      if (cur.x < minX) {
        positioned.set(ids[i], { x: minX, y: cur.y });
      }
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
    const midX = (apos.x + NODE_W + bpos.x) / 2 - 0.5;
    // Sit at bottom of cards so child lines drop naturally downward
    const midY = Math.max(apos.y, bpos.y) + NODE_H;
    const idx = result.findIndex((r) => r.id === u.id);
    if (idx !== -1) result[idx] = { ...result[idx], position: { x: midX - 0.5, y: midY - 0.5 } };
  }

  return result;
}
