import type { Edge, Node } from 'reactflow';

const NODE_W = 110; // matches CSS width
const NODE_H = 200; // matches fixed CSS height
const GAP_X = 60;   // gap between sim nodes in same generation
const GAP_COUPLE = 30; // gap between spouses — enough for the 24px heart
const GAP_Y = 160;  // vertical gap — must be enough for heart + trunk line to clear before children

export function genealogyLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const simNodes = nodes.filter((n) => String(n.id).startsWith('sim:'));
  // Union nodes no longer exist in the graph; spouses derived from marriage edges below

  // Build spouse sets from marriage edges (union nodes no longer exist in graph)
  const spouseOf = new Map<string, string>();
  for (const e of edges) {
    const kind = (e.data as { kind?: string } | undefined)?.kind;
    if (kind !== 'spouse') continue;
    const a = String(e.source);
    const b = String(e.target);
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

  // Married-in sims: iterate until stable so chained inheritance works
  let inheritChanged = true;
  while (inheritChanged) {
    inheritChanged = false;
    for (const s of simNodes) {
      const id = s.id as string;
      const parents = childToParentSims.get(id);
      const hasParents = parents && parents.size > 0;
      if (hasParents) continue;
      const spouse = spouseOf.get(id);
      if (!spouse) continue;
      const spouseGen = genBySim.get(spouse);
      if (spouseGen !== undefined && spouseGen >= 0) {
        if (genBySim.get(id) !== spouseGen) {
          genBySim.set(id, spouseGen);
          inheritChanged = true;
        }
      }
    }
  }

  // Re-run child generation assignment now that married-in sims have correct generations
  let rerunChanged = true;
  while (rerunChanged) {
    rerunChanged = false;
    for (const s of simNodes) {
      const id = s.id as string;
      const parents = childToParentSims.get(id);
      if (!parents || parents.size === 0) continue;
      let maxPG = -1, allKnown = true;
      for (const p of parents) {
        const pg = genBySim.get(p);
        if (pg === undefined) { allKnown = false; break; }
        if (pg > maxPG) maxPG = pg;
      }
      if (!allKnown) continue;
      const want = maxPG + 1;
      if (genBySim.get(id) !== want) { genBySim.set(id, want); rerunChanged = true; }
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

  for (const _u of []) { // union nodes removed
    const uid = '';
    const partners: [string,string] | undefined = undefined;
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

  // Snap spouses to identical Y so marriage lines are perfectly horizontal
  for (const [a, b] of spouseOf) {
    const posA = positioned.get(a);
    const posB = positioned.get(b);
    if (!posA || !posB) continue;
    if (posA.y !== posB.y) {
      const sharedY = Math.min(posA.y, posB.y);
      positioned.set(a, { ...posA, y: sharedY });
      positioned.set(b, { ...posB, y: sharedY });
    }
  }

  // Build result
  const result: Node[] = nodes.map((n) => ({ ...n }));

  for (const s of simNodes) {
    const pos = positioned.get(s.id as string) ?? { x: 40, y: 40 };
    const idx = result.findIndex((r) => r.id === s.id);
    if (idx !== -1) result[idx] = { ...result[idx], position: pos };
  }



  // Inject midX into child edges so FamilyEdge can draw from the correct X between parents
  const updatedEdges = edges.map((e) => {
    const kind = (e.data as { kind?: string; unionId?: string } | undefined)?.kind;
    if (kind !== 'parent') return e;
    // Find the source sim's spouse
    const spouseId = spouseOf.get(String(e.source));
    if (!spouseId) return e;
    const srcPos = positioned.get(String(e.source));
    const spousePos = positioned.get(spouseId);
    if (!srcPos || !spousePos) return e;
    const midX = (srcPos.x + spousePos.x + NODE_W) / 2;
    return { ...e, data: { ...e.data, midX } };
  });

  return { nodes: result, edges: updatedEdges };
}
