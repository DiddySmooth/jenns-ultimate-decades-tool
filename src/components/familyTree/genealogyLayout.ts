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
    const data = (e.data as { kind?: string; primary?: boolean } | undefined);
    const kind = data?.kind;
    if (kind !== 'spouse') continue;
    if (data?.primary === false) continue; // secondary unions are visual only for now
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

    // For each sim, find their parent's birth order (index in previous generation).
    // Must be cycle-safe: founder couples / multi-partner data can otherwise recurse forever.
    const parentOrder = (simId: string, seen = new Set<string>()): number => {
      if (seen.has(simId)) {
        const selfIdx = simNodes.findIndex((n) => n.id === simId);
        return selfIdx >= 0 ? selfIdx : 999999;
      }
      const nextSeen = new Set(seen);
      nextSeen.add(simId);

      const pars = childToParentSims.get(simId);
      if (!pars || pars.size === 0) {
        const spouse = spouseOf.get(simId);
        if (spouse && spouse !== simId) return parentOrder(spouse, nextSeen);
        const selfIdx = simNodes.findIndex((n) => n.id === simId);
        return selfIdx >= 0 ? selfIdx : 999999;
      }
      // Use lowest parent sim index in simNodes as proxy for left-to-right order
      let minIdx = 999999;
      for (const par of pars) {
        const idx = simNodes.findIndex((n) => n.id === par);
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
      const aX = Math.min(...a.map((id) => parentOrder(id)));
      const bX = Math.min(...b.map((id) => parentOrder(id)));
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

  // Third pass: group children by BOTH source parent sim and union id.
  // This is the first Phase 3 step toward union-centric layout: children of
  // different unions should not be merged just because they share one parent.
  const childrenByParent = new Map<string, string[]>();
  const childrenByUnion = new Map<string, string[]>();
  const unionPartners = new Map<string, Set<string>>();
  for (const e of edges) {
    const src = String(e.source);
    const tgt = String(e.target);
    const data = (e.data as { kind?: string; unionId?: string } | undefined);
    const kind = data?.kind;
    if (kind === 'spouse' && data?.unionId && src.startsWith('sim:') && String(e.target).startsWith('sim:')) {
      const set = unionPartners.get(data.unionId) ?? new Set<string>();
      set.add(src);
      set.add(String(e.target));
      unionPartners.set(data.unionId, set);
    }
    if (kind !== 'parent' || !tgt.startsWith('sim:') || !src.startsWith('sim:')) continue;
    const arr = childrenByParent.get(src) ?? [];
    arr.push(tgt);
    childrenByParent.set(src, arr);

    if (data?.unionId) {
      const unionArr = childrenByUnion.get(data.unionId) ?? [];
      unionArr.push(tgt);
      childrenByUnion.set(data.unionId, unionArr);
      const set = unionPartners.get(data.unionId) ?? new Set<string>();
      set.add(src);
      const spouse = spouseOf.get(src);
      if (spouse) set.add(spouse);
      unionPartners.set(data.unionId, set);
    }
  }

  const getChildrenForGroup = (parentA: string, parentB?: string): string[] => {
    const unionChildIds = Array.from(childrenByUnion.entries())
      .filter(([unionId]) => {
        const partners = unionPartners.get(unionId);
        if (!partners) return false;
        if (!partners.has(parentA)) return false;
        if (parentB) return partners.has(parentB);
        return true;
      })
      .flatMap(([, ids]) => ids);

    const directA = childrenByParent.get(parentA) ?? [];
    const directB = parentB ? (childrenByParent.get(parentB) ?? []) : [];
    return Array.from(new Set([...unionChildIds, ...directA, ...directB]));
  };

  type UnionInfo = {
    id: string;
    partners: string[];
    children: string[];
    primary: boolean;
    secondaryIndex: number;
  };

  type LayoutGroup = {
    id: string;
    type: 'single' | 'couple' | 'cluster';
    anchorId: string;
    memberIds: string[];
    unionIds: string[];
  };

  const unionInfos = new Map<string, UnionInfo>();
  for (const e of edges) {
    const data = (e.data as { kind?: string; unionId?: string; primary?: boolean; secondaryIndex?: number } | undefined);
    if (data?.kind !== 'spouse' || !data.unionId) continue;
    const existing = unionInfos.get(data.unionId);
    const partners = Array.from(new Set([...(existing?.partners ?? []), String(e.source), String(e.target)]));
    unionInfos.set(data.unionId, {
      id: data.unionId,
      partners,
      children: childrenByUnion.get(data.unionId) ?? existing?.children ?? [],
      primary: data.primary !== false,
      secondaryIndex: data.secondaryIndex ?? 0,
    });
  }

  const simToUnionIds = new Map<string, string[]>();
  for (const [unionId, info] of unionInfos) {
    for (const simId of info.partners) {
      const arr = simToUnionIds.get(simId) ?? [];
      arr.push(unionId);
      simToUnionIds.set(simId, arr);
    }
  }
  for (const [simId, unionIds] of simToUnionIds) {
    unionIds.sort((a, b) => {
      const ua = unionInfos.get(a);
      const ub = unionInfos.get(b);
      const pa = ua?.primary ? 1 : 0;
      const pb = ub?.primary ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return (ua?.secondaryIndex ?? 0) - (ub?.secondaryIndex ?? 0);
    });
    simToUnionIds.set(simId, unionIds);
  }

  const buildGroupsForGeneration = (ids: string[]): LayoutGroup[] => {
    const groups: LayoutGroup[] = [];
    const seen = new Set<string>();

    for (const id of ids) {
      if (seen.has(id)) continue;
      const memberships = simToUnionIds.get(id) ?? [];

      // Cluster: one visible sim with multiple unions on this generation.
      if (memberships.length > 1) {
        const memberIds = new Set<string>([id]);
        for (const unionId of memberships) {
          const info = unionInfos.get(unionId);
          if (!info) continue;
          for (const partnerId of info.partners) {
            if (ids.includes(partnerId)) memberIds.add(partnerId);
          }
        }
        const members = Array.from(memberIds);
        members.forEach((m) => seen.add(m));
        groups.push({ id: `cluster:${id}`, type: 'cluster', anchorId: id, memberIds: members, unionIds: memberships });
        continue;
      }

      const spouse = spouseOf.get(id);
      if (spouse && ids.includes(spouse) && !seen.has(spouse)) {
        seen.add(id);
        seen.add(spouse);
        const unionIds = (simToUnionIds.get(id) ?? []).filter((uid) => (unionInfos.get(uid)?.partners ?? []).includes(spouse));
        groups.push({ id: `couple:${id}:${spouse}`, type: 'couple', anchorId: id, memberIds: [id, spouse], unionIds });
      } else {
        seen.add(id);
        groups.push({ id: `single:${id}`, type: 'single', anchorId: id, memberIds: [id], unionIds: simToUnionIds.get(id) ?? [] });
      }
    }

    return groups;
  };

  const getChildrenForLayoutGroup = (group: LayoutGroup): string[] => {
    if (group.unionIds.length > 0) {
      return Array.from(new Set(group.unionIds.flatMap((uid) => unionInfos.get(uid)?.children ?? [])));
    }
    if (group.memberIds.length === 2) return getChildrenForGroup(group.memberIds[0], group.memberIds[1]);
    return getChildrenForGroup(group.memberIds[0]);
  };

  // ── Bottom-up subtree width layout ───────────────────────────────────────
  // Calculate how wide each couple's subtree needs to be, then position
  // each generation based on subtree widths rather than fixed gaps.

  const genKeysSorted = [...genKeys].sort((a, b) => b - a); // deepest first

  // subtreeWidth: minimum width needed for a sim's entire subtree
  const subtreeWidth = new Map<string, number>();
  const groupWidth = new Map<string, number>();

  // Process deepest generation first, work upward using union-aware layout groups.
  for (const g of genKeysSorted) {
    const ids = sortedGens.get(g)!;
    const groups = buildGroupsForGeneration(ids);

    for (const group of groups) {
      const allChildren = getChildrenForLayoutGroup(group);
      const minWidth = group.type === 'cluster'
        ? (() => {
            const unionSlots = group.unionIds.length;
            const clusterCore = NODE_W; // anchor sim
            const unionsSpan = unionSlots > 0 ? (unionSlots * (NODE_W * 2 + GAP_COUPLE)) + ((unionSlots - 1) * 36) : 0;
            return Math.max(clusterCore + unionsSpan, NODE_W * 3 + GAP_X);
          })()
        : group.type === 'couple'
        ? NODE_W * 2 + GAP_COUPLE
        : NODE_W;

      if (allChildren.length === 0) {
        groupWidth.set(group.id, minWidth);
      } else {
        let childrenTotalWidth = 0;
        allChildren.forEach((c, i) => {
          childrenTotalWidth += subtreeWidth.get(c) ?? NODE_W;
          if (i > 0) childrenTotalWidth += GAP_X;
        });
        groupWidth.set(group.id, Math.max(minWidth, childrenTotalWidth));
      }

      const resolvedWidth = groupWidth.get(group.id) ?? minWidth;
      group.memberIds.forEach((id) => subtreeWidth.set(id, resolvedWidth));
    }
  }

  // Now re-position all generations top-down using union-aware group widths.
  for (const g of genKeys) {
    const ids = sortedGens.get(g)!;
    const sorted = [...ids].sort((a, b) => (positioned.get(a)?.x ?? 0) - (positioned.get(b)?.x ?? 0));
    const groups = buildGroupsForGeneration(sorted);

    let totalGenWidth = 0;
    groups.forEach((group, i) => {
      totalGenWidth += groupWidth.get(group.id) ?? NODE_W;
      if (i > 0) totalGenWidth += GAP_X;
    });

    const startX = 40;
    let curX = startX;
    const y = 40 + g * (NODE_H + GAP_Y);

    for (const group of groups) {
      const sw = groupWidth.get(group.id) ?? NODE_W;
      const grpMidX = curX + sw / 2;

      if (group.type === 'single') {
        positioned.set(group.memberIds[0], { x: grpMidX - NODE_W / 2, y });
      } else if (group.type === 'couple') {
        positioned.set(group.memberIds[0], { x: grpMidX - NODE_W - GAP_COUPLE / 2, y });
        positioned.set(group.memberIds[1], { x: grpMidX + GAP_COUPLE / 2, y });
      } else {
        const anchorId = group.anchorId;
        const secondaries = group.memberIds.filter((id) => id !== anchorId).sort((a, b) => {
          const aUnion = (simToUnionIds.get(anchorId) ?? []).find((uid) => (unionInfos.get(uid)?.partners ?? []).includes(a));
          const bUnion = (simToUnionIds.get(anchorId) ?? []).find((uid) => (unionInfos.get(uid)?.partners ?? []).includes(b));
          return (unionInfos.get(aUnion ?? '')?.secondaryIndex ?? 0) - (unionInfos.get(bUnion ?? '')?.secondaryIndex ?? 0);
        });

        const clusterLeft = curX;
        const clusterRight = curX + sw;
        const anchorX = clusterLeft + Math.max(0, (sw - (NODE_W + secondaries.length * (NODE_W + GAP_COUPLE + 24))) / 2);
        positioned.set(anchorId, { x: anchorX, y });

        secondaries.forEach((sid, i) => {
          const x = anchorX + NODE_W + GAP_COUPLE + (i * (NODE_W + GAP_COUPLE + 24));
          positioned.set(sid, { x: Math.min(x, clusterRight - NODE_W), y });
        });
      }

      const allChildren = getChildrenForLayoutGroup(group);
      if (allChildren.length > 0) {
        const childrenSorted = [...allChildren].sort((a, b) => {
          const aNode = simNodes.find(n => n.id === a);
          const bNode = simNodes.find(n => n.id === b);
          const ay = (aNode?.data as { sim?: { birthYear?: number } } | undefined)?.sim?.birthYear ?? 999999;
          const by2 = (bNode?.data as { sim?: { birthYear?: number } } | undefined)?.sim?.birthYear ?? 999999;
          return ay - by2;
        });

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

      const allChildren = getChildrenForGroup(simId, spouseId);
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

  // Secondary union satellite pass.
  // Keep the current primary-couple layout intact, but pull additional partners
  // closer to the shared sim when one sim has many unions and the other sim is
  // only in that one union. This is a pragmatic step toward union-centric layout.
  const marriageEdges = edges.filter((e) => (e.data as { kind?: string } | undefined)?.kind === 'spouse');
  const marriageCountBySim = new Map<string, number>();
  for (const e of marriageEdges) {
    const a = String(e.source);
    const b = String(e.target);
    marriageCountBySim.set(a, (marriageCountBySim.get(a) ?? 0) + 1);
    marriageCountBySim.set(b, (marriageCountBySim.get(b) ?? 0) + 1);
  }
  const secondaryMarriageEdges = marriageEdges
    .filter((e) => (e.data as { primary?: boolean } | undefined)?.primary === false)
    .sort((a, b) => (((a.data as { secondaryIndex?: number } | undefined)?.secondaryIndex ?? 0) - ((b.data as { secondaryIndex?: number } | undefined)?.secondaryIndex ?? 0)));

  const unionChildrenById = new Map<string, string[]>();
  const anchorToSatellites = new Map<string, { satelliteId: string; unionId?: string; secondaryIndex: number }[]>();

  for (const e of secondaryMarriageEdges) {
    const data = (e.data as { unionId?: string; secondaryIndex?: number } | undefined);
    const a = String(e.source);
    const b = String(e.target);
    const aCount = marriageCountBySim.get(a) ?? 0;
    const bCount = marriageCountBySim.get(b) ?? 0;

    // Only do the satellite collapse when one endpoint is the obvious shared anchor
    // and the other endpoint is a one-union partner.
    let anchorId: string | null = null;
    let satelliteId: string | null = null;
    if (aCount > 1 && bCount === 1) {
      anchorId = a;
      satelliteId = b;
    } else if (bCount > 1 && aCount === 1) {
      anchorId = b;
      satelliteId = a;
    } else {
      continue;
    }

    const anchorPos = positioned.get(anchorId);
    const satellitePos = positioned.get(satelliteId);
    if (!anchorPos || !satellitePos) continue;

    const idx = Math.max(1, data?.secondaryIndex ?? 1);
    const side = idx % 2 === 1 ? 1 : -1;
    const slot = Math.ceil(idx / 2);
    const extraGap = (slot - 1) * (NODE_W + 24);
    const nextX = side === 1
      ? anchorPos.x + NODE_W + GAP_COUPLE + extraGap
      : anchorPos.x - GAP_COUPLE - NODE_W - extraGap;

    positioned.set(satelliteId, { x: nextX, y: anchorPos.y });

    const satellites = anchorToSatellites.get(anchorId) ?? [];
    satellites.push({ satelliteId, unionId: data?.unionId, secondaryIndex: idx });
    anchorToSatellites.set(anchorId, satellites);
    if (data?.unionId) unionChildrenById.set(data.unionId, childrenByUnion.get(data.unionId) ?? []);
  }

  // Local post-satellite packing: keep the cluster near the anchor, but make sure
  // the anchor + all satellites have safe gaps and no card overlap.
  for (const [anchorId, satellites] of anchorToSatellites) {
    const anchorPos = positioned.get(anchorId);
    if (!anchorPos) continue;

    const cluster = [
      { id: anchorId, fixed: true, preferredX: anchorPos.x },
      ...satellites.map((s) => ({
        id: s.satelliteId,
        fixed: false,
        preferredX: positioned.get(s.satelliteId)?.x ?? anchorPos.x,
      })),
    ].sort((a, b) => a.preferredX - b.preferredX);

    // Forward pass
    for (let i = 1; i < cluster.length; i++) {
      const prev = positioned.get(cluster[i - 1].id);
      const cur = positioned.get(cluster[i].id);
      if (!prev || !cur) continue;
      const minX = prev.x + NODE_W + GAP_COUPLE;
      if (cur.x < minX && !cluster[i].fixed) {
        positioned.set(cluster[i].id, { x: minX, y: cur.y });
      }
    }
    // Backward pass to preserve some symmetry around the anchor
    for (let i = cluster.length - 2; i >= 0; i--) {
      const next = positioned.get(cluster[i + 1].id);
      const cur = positioned.get(cluster[i].id);
      if (!next || !cur) continue;
      const maxX = next.x - NODE_W - GAP_COUPLE;
      if (cur.x > maxX && !cluster[i].fixed) {
        positioned.set(cluster[i].id, { x: maxX, y: cur.y });
      }
    }

    // Re-center each affected union's children after packing.
    for (const s of satellites) {
      if (!s.unionId) continue;
      const satPos = positioned.get(s.satelliteId);
      const ancPos = positioned.get(anchorId);
      if (!satPos || !ancPos) continue;
      const unionChildren = unionChildrenById.get(s.unionId) ?? [];
      if (unionChildren.length === 0) continue;
      const unionMidX = (ancPos.x + satPos.x + NODE_W) / 2;
      const childPositions = unionChildren
        .map((childId) => positioned.get(childId))
        .filter(Boolean) as { x: number; y: number }[];
      if (childPositions.length === 0) continue;
      const childLeft = Math.min(...childPositions.map((p) => p.x));
      const childRight = Math.max(...childPositions.map((p) => p.x)) + NODE_W;
      const childMidX = (childLeft + childRight) / 2;
      const shift = unionMidX - childMidX;
      if (Math.abs(shift) > 0.5) {
        for (const childId of unionChildren) {
          const pos = positioned.get(childId);
          if (pos) positioned.set(childId, { x: pos.x + shift, y: pos.y });
        }
      }
    }
  }

  // Final family centering pass: after all spacing/overlap nudges are done,
  // shift each visible child group so its rendered center matches the final
  // midpoint of its parent couple. This fixes the slight kinks that can appear
  // when filters (like hide dead sims) change the visible set.
  const recenteredParents = new Set<string>();
  for (const [parentId] of childrenByParent) {
    if (recenteredParents.has(parentId)) continue;
    const spouseId = spouseOf.get(parentId);
    if (spouseId && recenteredParents.has(spouseId)) continue;

    const allChildren = getChildrenForGroup(parentId, spouseId);
    if (allChildren.length === 0) continue;

    recenteredParents.add(parentId);
    if (spouseId) recenteredParents.add(spouseId);

    const pA = positioned.get(parentId);
    const pB = spouseId ? positioned.get(spouseId) : null;
    if (!pA) continue;

    const coupleMidX = pB
      ? (pA.x + pB.x + NODE_W) / 2
      : pA.x + NODE_W / 2;

    const childPositions = allChildren
      .map((childId) => positioned.get(childId))
      .filter(Boolean) as { x: number; y: number }[];
    if (childPositions.length === 0) continue;

    const childLeft = Math.min(...childPositions.map((p) => p.x));
    const childRight = Math.max(...childPositions.map((p) => p.x)) + NODE_W;
    const childGroupMidX = (childLeft + childRight) / 2;
    const shift = coupleMidX - childGroupMidX;

    if (Math.abs(shift) > 0.5) {
      for (const childId of allChildren) {
        const childPos = positioned.get(childId);
        if (childPos) positioned.set(childId, { x: childPos.x + shift, y: childPos.y });
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

  // Inject midX into child edges so FamilyEdge can draw from the correct X between parents
  const unionLaneOffsetX = new Map<string, number>();
  for (const e of edges) {
    const data = (e.data as { kind?: string; unionId?: string; primary?: boolean; secondaryIndex?: number } | undefined);
    if (data?.kind !== 'spouse' || !data.unionId) continue;
    const secondaryIndex = data.secondaryIndex ?? 0;
    const laneX = data.primary === false
      ? (((secondaryIndex % 2 === 1 ? 1 : -1) * Math.ceil(Math.max(1, secondaryIndex) / 2)) * 14)
      : 0;
    unionLaneOffsetX.set(data.unionId, laneX);
  }

  const updatedEdges = edges.map((e) => {
    const data = (e.data as { kind?: string; unionId?: string } | undefined);
    const kind = data?.kind;
    if (kind !== 'parent') return e;

    const srcPos = positioned.get(String(e.source));
    if (!srcPos) return e;

    // Prefer the exact union partners when available.
    if (data?.unionId) {
      const partners = Array.from(unionPartners.get(data.unionId) ?? []);
      const partnerPositions = partners
        .map((id) => positioned.get(id))
        .filter(Boolean) as { x: number; y: number }[];
      if (partnerPositions.length >= 2) {
        const leftX = Math.min(...partnerPositions.map((p) => p.x));
        const rightX = Math.max(...partnerPositions.map((p) => p.x));
        const midX = (leftX + rightX + NODE_W) / 2 + (unionLaneOffsetX.get(data.unionId) ?? 0);
        return { ...e, data: { ...e.data, midX } };
      }
    }

    // Fallback to the primary spouse pair assumption when no union is known.
    const spouseId = spouseOf.get(String(e.source));
    if (!spouseId) return e;
    const spousePos = positioned.get(spouseId);
    if (!spousePos) return e;
    const midX = (srcPos.x + spousePos.x + NODE_W) / 2;
    return { ...e, data: { ...e.data, midX } };
  });

  return { nodes: result, edges: updatedEdges };
}
