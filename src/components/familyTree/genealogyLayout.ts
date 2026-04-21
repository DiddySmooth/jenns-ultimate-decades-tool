import type { Edge, Node } from 'reactflow';

const NODE_W = 110; // matches CSS width
const NODE_H = 200; // matches fixed CSS height
const GAP_X = 120;  // gap between couples/unrelated sims
const GAP_COUPLE = 40; // gap between spouses
const GAP_Y = 200;  // extra room for heart + child lines below cards

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

  // Sort each generation: group spouses together, ordered by parent position
  const sortedGens = new Map<number, string[]>();
  for (const g of genKeys) {
    const ids = new Set(gens.get(g)!);

    // For each sim, find their parent's birth order (index in previous generation)
    // Use the sim's own ID hash as tiebreaker for stable sort
    const parentOrder = (simId: string): number => {
      const pars = childToParentSims.get(simId);
      if (!pars || pars.size === 0) {
        const spouse = spouseOf.get(simId);
        if (spouse) return parentOrder(spouse);
        return 999999;
      }
      // Use lowest parent sim index in simNodes as proxy for left-to-right order
      let minIdx = 999999;
      for (const par of pars) {
        const idx = simNodes.findIndex(n => n.id === par);
        if (idx >= 0 && idx < minIdx) minIdx = idx;
      }
      return minIdx;
    };

    // Group into couples first
    const couples: string[][] = [];
    const visited = new Set<string>();
    for (const id of ids) {
      if (visited.has(id)) continue;
      visited.add(id);
      const spouse = spouseOf.get(id);
      if (spouse && ids.has(spouse) && !visited.has(spouse)) {
        visited.add(spouse);
        couples.push([id, spouse]);
      } else {
        couples.push([id]);
      }
    }

    // Sort couples by their leftmost parent order
    couples.sort((a, b) => {
      const aX = Math.min(...a.map(parentOrder));
      const bX = Math.min(...b.map(parentOrder));
      return aX - bX;
    });

    // Within each couple, put the one with parents first (not married-in)
    const ordered: string[] = [];
    for (const couple of couples) {
      if (couple.length === 2) {
        const [x, y] = couple;
        const xHasParents = (childToParentSims.get(x)?.size ?? 0) > 0;
        const yHasParents = (childToParentSims.get(y)?.size ?? 0) > 0;
        // Put the one with parents on the left
        if (!xHasParents && yHasParents) {
          ordered.push(y, x);
        } else {
          ordered.push(x, y);
        }
      } else {
        ordered.push(...couple);
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

  // Third pass: center each group of children under their parents' midpoint
  // Group children by their source parent sim
  const childrenByParent = new Map<string, string[]>();
  for (const e of edges) {
    const src = String(e.source);
    const tgt = String(e.target);
    const kind = (e.data as { kind?: string } | undefined)?.kind;
    if (kind !== 'parent' || !tgt.startsWith('sim:') || !src.startsWith('sim:')) continue;
    const arr = childrenByParent.get(src) ?? [];
    arr.push(tgt);
    childrenByParent.set(src, arr);
  }

  // ── Bottom-up subtree width layout ───────────────────────────────────────
  // Calculate how wide each couple's subtree needs to be, then position
  // each generation based on subtree widths rather than fixed gaps.

  const genKeysSorted = [...genKeys].sort((a, b) => b - a); // deepest first

  // subtreeWidth: minimum width needed for a sim's entire subtree
  const subtreeWidth = new Map<string, number>();

  // Process deepest generation first, work upward
  for (const g of genKeysSorted) {
    const ids = sortedGens.get(g)!;
    const processedCouples = new Set<string>();

    for (const simId of ids) {
      if (processedCouples.has(simId)) continue;
      processedCouples.add(simId);
      const spouseId = spouseOf.get(simId);
      if (spouseId) processedCouples.add(spouseId);

      const myChildren = childrenByParent.get(simId) ?? [];
      const spouseChildren = spouseId ? (childrenByParent.get(spouseId) ?? []) : [];
      const allChildren = Array.from(new Set([...myChildren, ...spouseChildren]));

      if (allChildren.length === 0) {
        // Leaf couple: width is just the two cards + couple gap
        const coupleW = spouseId ? NODE_W * 2 + GAP_COUPLE : NODE_W;
        subtreeWidth.set(simId, coupleW);
        if (spouseId) subtreeWidth.set(spouseId, coupleW);
      } else {
        // Width = sum of children subtree widths + gaps between them
        let childrenTotalWidth = 0;
        allChildren.forEach((c, i) => {
          childrenTotalWidth += subtreeWidth.get(c) ?? NODE_W;
          if (i > 0) childrenTotalWidth += GAP_X;
        });
        const coupleMinWidth = spouseId ? NODE_W * 2 + GAP_COUPLE : NODE_W;
        const totalWidth = Math.max(coupleMinWidth, childrenTotalWidth);
        subtreeWidth.set(simId, totalWidth);
        if (spouseId) subtreeWidth.set(spouseId, totalWidth);
      }
    }
  }

  // Now re-position all generations top-down using subtree widths
  // Gen 0 starts centered at x=40
  for (const g of genKeys) {
    const ids = sortedGens.get(g)!;
    // Sort by current X (from initial positioning)
    const sorted = [...ids].sort((a, b) => (positioned.get(a)?.x ?? 0) - (positioned.get(b)?.x ?? 0));

    // Group into couples
    const coupleGroups: string[][] = [];
    const seen = new Set<string>();
    for (const id of sorted) {
      if (seen.has(id)) continue;
      seen.add(id);
      const spouse = spouseOf.get(id);
      if (spouse && ids.includes(spouse) && !seen.has(spouse)) {
        seen.add(spouse);
        // Put parent-child first
        const idHasParents = (childToParentSims.get(id)?.size ?? 0) > 0;
        const spouseHasParents = (childToParentSims.get(spouse)?.size ?? 0) > 0;
        coupleGroups.push((!idHasParents && spouseHasParents) ? [spouse, id] : [id, spouse]);
      } else {
        coupleGroups.push([id]);
      }
    }

    // Place couple groups left to right with inter-couple gap
    // Total width of generation
    let totalGenWidth = 0;
    coupleGroups.forEach((grp, i) => {
      const sw = subtreeWidth.get(grp[0]) ?? NODE_W;
      totalGenWidth += sw;
      if (i > 0) totalGenWidth += GAP_X;
    });

    const startX = 40;
    let curX = startX;
    const y = 40 + g * (NODE_H + GAP_Y);

    for (const grp of coupleGroups) {
      const sw = subtreeWidth.get(grp[0]) ?? NODE_W;
      const grpMidX = curX + sw / 2;

      if (grp.length === 2) {
        // Place couple centered within their subtree width
        positioned.set(grp[0], { x: grpMidX - NODE_W - GAP_COUPLE / 2, y });
        positioned.set(grp[1], { x: grpMidX + GAP_COUPLE / 2, y });
      } else {
        positioned.set(grp[0], { x: grpMidX - NODE_W / 2, y });
      }

      // Place children evenly within the subtree width
      const myChildren = childrenByParent.get(grp[0]) ?? [];
      const spouseChildren = grp[1] ? (childrenByParent.get(grp[1]) ?? []) : [];
      const allChildren = Array.from(new Set([...myChildren, ...spouseChildren]));

      if (allChildren.length > 0) {
        const childrenSorted = [...allChildren].sort((a, b) => {
          // Sort by birth year for stable left-to-right ordering
          const aNode = simNodes.find(n => n.id === a);
          const bNode = simNodes.find(n => n.id === b);
          const ay = (aNode?.data as { sim?: { birthYear?: number } } | undefined)?.sim?.birthYear ?? 999999;
          const by2 = (bNode?.data as { sim?: { birthYear?: number } } | undefined)?.sim?.birthYear ?? 999999;
          return ay - by2;
        });

        // Calculate total children width using their subtree widths
        let totalChildW = 0;
        childrenSorted.forEach((c, i) => {
          totalChildW += subtreeWidth.get(c) ?? NODE_W;
          if (i > 0) totalChildW += GAP_X;
        });

        let childX = curX + (sw - totalChildW) / 2;
        for (const c of childrenSorted) {
          const csw = subtreeWidth.get(c) ?? NODE_W;
          const childMidX = childX + csw / 2;
          const childY = 40 + ((genBySim.get(c) ?? 0)) * (NODE_H + GAP_Y);
          positioned.set(c, { x: childMidX - NODE_W / 2, y: childY });
          childX += csw + GAP_X;
        }
      }

      curX += sw + GAP_X;
    }
  }

  // Re-run collision detection after parent widening
  for (const g of genKeys) {
    const ids = [...(sortedGens.get(g) ?? [])];
    ids.sort((a, b) => (positioned.get(a)?.x ?? 0) - (positioned.get(b)?.x ?? 0));
    for (let i = 1; i < ids.length; i++) {
      const prev = positioned.get(ids[i - 1]);
      const cur = positioned.get(ids[i]);
      if (!prev || !cur) continue;
      const gap = spouseOf.get(ids[i - 1]) === ids[i] ? GAP_COUPLE : GAP_X;
      const minX = prev.x + NODE_W + gap;
      if (cur.x < minX) positioned.set(ids[i], { x: minX, y: cur.y });
    }
  }

  // ── Top-down centering pass ─────────────────────────────────────────────
  // For each couple, re-center their children group under the couple's midpoint,
  // then fix any overlaps that result.
  for (const g of genKeys) {
    const ids = sortedGens.get(g)!;
    const processedCouples = new Set<string>();

    for (const simId of ids) {
      if (processedCouples.has(simId)) continue;
      processedCouples.add(simId);
      const spouseId = spouseOf.get(simId);
      if (spouseId) processedCouples.add(spouseId);

      const pA = positioned.get(simId);
      const pB = spouseId ? positioned.get(spouseId) : null;
      if (!pA) continue;

      const myChildren = childrenByParent.get(simId) ?? [];
      const spouseChildren = spouseId ? (childrenByParent.get(spouseId) ?? []) : [];
      const allChildren = Array.from(new Set([...myChildren, ...spouseChildren]));
      if (allChildren.length === 0) continue;

      // Couple midpoint
      const leftX = Math.min(pA.x, pB?.x ?? pA.x);
      const rightX = Math.max(pA.x, pB?.x ?? pA.x) + NODE_W;
      const coupleMidX = (leftX + rightX) / 2;

      // Current children group bounds
      const childPositions = allChildren.map(c => positioned.get(c)).filter(Boolean) as { x: number; y: number }[];
      if (childPositions.length === 0) continue;
      const childLeft = Math.min(...childPositions.map(p => p.x));
      const childRight = Math.max(...childPositions.map(p => p.x)) + NODE_W;
      const childGroupMidX = (childLeft + childRight) / 2;

      const shift = coupleMidX - childGroupMidX;
      if (Math.abs(shift) > 1) {
        for (const c of allChildren) {
          const pos = positioned.get(c);
          if (pos) positioned.set(c, { x: pos.x + shift, y: pos.y });
        }
      }
    }

    // Fix overlaps after centering
    const sortedIds = [...ids].sort((a, b) => (positioned.get(a)?.x ?? 0) - (positioned.get(b)?.x ?? 0));
    for (let i = 1; i < sortedIds.length; i++) {
      const prev = positioned.get(sortedIds[i - 1]);
      const cur = positioned.get(sortedIds[i]);
      if (!prev || !cur) continue;
      const gap = spouseOf.get(sortedIds[i - 1]) === sortedIds[i] ? GAP_COUPLE : GAP_X;
      const minX = prev.x + NODE_W + gap;
      if (cur.x < minX) positioned.set(sortedIds[i], { x: minX, y: cur.y });
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
