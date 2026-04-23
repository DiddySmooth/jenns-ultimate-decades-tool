import type { Edge, Node } from 'reactflow';

const NODE_W = 110; // matches CSS width
const NODE_H = 200; // matches fixed CSS height
const GAP_X = 120;  // gap between couples/unrelated sims
const GAP_COUPLE = 40; // gap between spouses
const GAP_Y = 200;  // extra room for heart + child lines below cards
const GAP_UNION_GROUP = 42; // visual gutter between adjacent union groups in shared-parent strips

export function genealogyLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const simNodes = nodes.filter((n) => String(n.id).startsWith('sim:'));
  // Union nodes no longer exist in the graph; spouses derived from marriage edges below

  // Build explicit union-aware relationship indices from edge metadata.
  const unionPartnersAll = new Map<string, Set<string>>();
  const unionChildrenAll = new Map<string, Set<string>>();
  const personToUnionIds = new Map<string, Set<string>>();
  const primaryUnionByPerson = new Map<string, string>();

  for (const e of edges) {
    const data = (e.data as { kind?: string; primary?: boolean; unionId?: string } | undefined);
    const kind = data?.kind;
    const a = String(e.source);
    const b = String(e.target);

    if (kind === 'spouse') {
      if (data?.unionId) {
        const set = unionPartnersAll.get(data.unionId) ?? new Set<string>();
        set.add(a);
        set.add(b);
        unionPartnersAll.set(data.unionId, set);

        const unionsA = personToUnionIds.get(a) ?? new Set<string>();
        unionsA.add(data.unionId);
        personToUnionIds.set(a, unionsA);
        const unionsB = personToUnionIds.get(b) ?? new Set<string>();
        unionsB.add(data.unionId);
        personToUnionIds.set(b, unionsB);

        if (data.primary) {
          primaryUnionByPerson.set(a, data.unionId);
          primaryUnionByPerson.set(b, data.unionId);
        }
      }
      continue;
    }

    if (kind === 'parent' && data?.unionId && b.startsWith('sim:')) {
      const children = unionChildrenAll.get(data.unionId) ?? new Set<string>();
      children.add(b);
      unionChildrenAll.set(data.unionId, children);
    }
  }

  const unionIdsByPerson = new Map<string, string[]>();
  for (const [personId, unionIds] of personToUnionIds) {
    const arr = [...unionIds];
    arr.sort((a, b) => {
      const aPrimary = primaryUnionByPerson.get(personId) === a ? 1 : 0;
      const bPrimary = primaryUnionByPerson.get(personId) === b ? 1 : 0;
      if (aPrimary !== bPrimary) return bPrimary - aPrimary;
      const aEdge = edges.find((e) => (e.data as { kind?: string; unionId?: string } | undefined)?.kind === 'spouse' && (e.data as { unionId?: string } | undefined)?.unionId === a);
      const bEdge = edges.find((e) => (e.data as { kind?: string; unionId?: string } | undefined)?.kind === 'spouse' && (e.data as { unionId?: string } | undefined)?.unionId === b);
      const aSec = ((aEdge?.data as { secondaryIndex?: number } | undefined)?.secondaryIndex ?? 0);
      const bSec = ((bEdge?.data as { secondaryIndex?: number } | undefined)?.secondaryIndex ?? 0);
      return aSec - bSec;
    });
    unionIdsByPerson.set(personId, arr);
  }

  // Build child -> parent sims map.
  // Important: for union-backed child edges, count BOTH union partners as parents,
  // not just the visible source node used for rendering.
  const childToParentSims = new Map<string, Set<string>>();
  for (const e of edges) {
    const src = String(e.source);
    const tgt = String(e.target);
    if (!tgt.startsWith('sim:')) continue;
    const data = (e.data as { kind?: string; unionId?: string } | undefined);
    const kind = data?.kind;
    if (kind === 'spouse') continue;
    const parentSims: string[] = [];

    if (data?.unionId && unionPartnersAll.has(data.unionId)) {
      parentSims.push(...Array.from(unionPartnersAll.get(data.unionId)!));
    } else if (src.startsWith('sim:')) {
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

  // Married-in / union-inherited generation: if a sim has no parents but belongs to a union
  // with someone whose generation is known, inherit that generation.
  let inheritChanged = true;
  while (inheritChanged) {
    inheritChanged = false;
    for (const s of simNodes) {
      const id = s.id as string;
      const parents = childToParentSims.get(id);
      const hasParents = parents && parents.size > 0;
      if (hasParents) continue;

      const unionIds = unionIdsByPerson.get(id) ?? [];
      let inheritedGen: number | undefined;
      for (const unionId of unionIds) {
        const partners = Array.from(unionPartnersAll.get(unionId) ?? []);
        for (const partnerId of partners) {
          if (partnerId === id) continue;
          const partnerGen = genBySim.get(partnerId);
          if (partnerGen !== undefined && partnerGen >= 0) {
            inheritedGen = partnerGen;
            break;
          }
        }
        if (inheritedGen !== undefined) break;
      }

      if (inheritedGen !== undefined && genBySim.get(id) !== inheritedGen) {
        genBySim.set(id, inheritedGen);
        inheritChanged = true;
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

  // Second married-in inheritance pass — runs AFTER children have their final
  // generations so spouses like Raff (married to Piper who is gen 1) correctly
  // inherit gen 1 instead of defaulting to gen 0 alongside the harem wives.
  let inheritChanged2 = true;
  while (inheritChanged2) {
    inheritChanged2 = false;
    for (const s of simNodes) {
      const id = s.id as string;
      const hasParents = (childToParentSims.get(id)?.size ?? 0) > 0;
      if (hasParents) continue;
      const unionIds = unionIdsByPerson.get(id) ?? [];
      let inheritedGen: number | undefined;
      for (const unionId of unionIds) {
        for (const partnerId of Array.from(unionPartnersAll.get(unionId) ?? [])) {
          if (partnerId === id) continue;
          const partnerGen = genBySim.get(partnerId);
          if (partnerGen !== undefined && partnerGen >= 0) {
            if (inheritedGen === undefined || partnerGen > inheritedGen) inheritedGen = partnerGen;
          }
        }
      }
      if (inheritedGen !== undefined && genBySim.get(id) !== inheritedGen) {
        genBySim.set(id, inheritedGen);
        inheritChanged2 = true;
      }
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
        const unionIds = unionIdsByPerson.get(simId) ?? [];
        for (const unionId of unionIds) {
          const partners = Array.from(unionPartnersAll.get(unionId) ?? []);
          for (const partnerId of partners) {
            if (partnerId !== simId) return parentOrder(partnerId, nextSeen);
          }
        }
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

    // Group into couples first. Prefer explicit union pairs when present.
    const couples: string[][] = [];
    const visited = new Set<string>();

    for (const id of ids) {
      if (visited.has(id)) continue;
      visited.add(id);
      // prefer explicit union pair detection
      const spouse = Array.from(ids).find((other) => shareExclusivePairUnion(id, other));
      if (spouse && spouse !== id && !visited.has(spouse)) {
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
        const isCouple = shareExclusivePairUnion(prev, cur);
        const gap = isCouple ? GAP_COUPLE : GAP_X;
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
        const isCouple = shareExclusivePairUnion(prev, cur);
        x += isCouple ? GAP_COUPLE : GAP_X;
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
      for (const partnerId of Array.from(unionPartnersAll.get(data.unionId) ?? [])) set.add(partnerId);
      set.add(src);
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
    const partners = Array.from(unionPartnersAll.get(data.unionId) ?? new Set([...(existing?.partners ?? []), String(e.source), String(e.target)]));
    unionInfos.set(data.unionId, {
      id: data.unionId,
      partners,
      children: Array.from(unionChildrenAll.get(data.unionId) ?? new Set(existing?.children ?? [])),
      primary: data.primary !== false,
      secondaryIndex: data.secondaryIndex ?? 0,
    });
  }

  const simToUnionIds = new Map<string, string[]>();
  for (const [simId, unionIds] of unionIdsByPerson) {
    simToUnionIds.set(simId, [...unionIds].filter((uid) => unionInfos.has(uid)));
  }

  // Helper: does a and b share an exclusive 2-partner union?
  function shareExclusivePairUnion(a: string, b: string) {
    const aUnionIds = unionIdsByPerson.get(a) ?? [];
    const bUnionIds = unionIdsByPerson.get(b) ?? [];
    const shared = aUnionIds.filter((uid) => bUnionIds.includes(uid));
    return shared.some((uid) => (unionPartnersAll.get(uid)?.size ?? 0) === 2);
  }

  const getPreferredClusterAnchor = (memberIds: string[]): string => {
    const scored = [...memberIds].map((id) => {
      const parentCount = childToParentSims.get(id)?.size ?? 0;
      const childCount = childrenByParent.get(id)?.length ?? 0;
      const explicitUnionCount = unionIdsByPerson.get(id)?.length ?? 0;
      return {
        id,
        score: (parentCount > 0 ? 100 : 0) + (childCount > 0 ? 20 : 0) + explicitUnionCount,
      };
    }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return scored[0]?.id ?? memberIds[0];
  };

  const buildGroupsForGeneration = (ids: string[]): LayoutGroup[] => {
    const groups: LayoutGroup[] = [];
    const seen = new Set<string>();

    for (const id of ids) {
      if (seen.has(id)) continue;
      const memberships = simToUnionIds.get(id) ?? [];

      // Cluster: one visible sim with multiple unions on this generation.
      // STRICT rule: only pull in sims whose union DIRECTLY involves this anchor.
      // Never absorb a sim just because they're in the same generation row.
      if (memberships.length > 1) {
        const memberIds = new Set<string>([id]);
        const clusterUnionIds = new Set<string>();
        for (const unionId of memberships) {
          const info = unionInfos.get(unionId);
          if (!info) continue;
          clusterUnionIds.add(unionId);
          for (const partnerId of info.partners) {
            if (partnerId === id) continue;
            // Partner must be in this generation AND must share this exact union with anchor.
            // Do NOT absorb sims who have their own separate exclusive union (e.g. Raff/Piper).
            if (!ids.includes(partnerId)) continue;
            const partnerMemberships = simToUnionIds.get(partnerId) ?? [];
            const sharedUnions = partnerMemberships.filter(uid => uid === unionId);
            if (sharedUnions.length === 0) continue; // no direct union with anchor
            // Only absorb as cluster member if this is their ONLY union, or their primary union is this one.
            // Sims with their own exclusive pair union elsewhere stay as separate groups.
            const hasOwnExclusivePair = partnerMemberships.some(uid =>
              uid !== unionId && (unionPartnersAll.get(uid)?.size ?? 0) === 2 &&
              !Array.from(unionPartnersAll.get(uid) ?? []).includes(id)
            );
            if (!hasOwnExclusivePair) {
              memberIds.add(partnerId);
            }
          }
        }
        const members = Array.from(memberIds);
        const anchorId = getPreferredClusterAnchor(members);
        members.forEach((m) => seen.add(m));
        groups.push({ id: `cluster:${anchorId}`, type: 'cluster', anchorId, memberIds: members, unionIds: Array.from(clusterUnionIds) });
        continue;
      }

      const explicitSpouse = Array.from(ids).find((other) => other !== id && !seen.has(other) && shareExclusivePairUnion(id, other));
      if (explicitSpouse) {
        seen.add(id);
        seen.add(explicitSpouse);
        const unionIds = (simToUnionIds.get(id) ?? []).filter((uid) => (unionInfos.get(uid)?.partners ?? []).includes(explicitSpouse));
        groups.push({ id: `couple:${id}:${explicitSpouse}`, type: 'couple', anchorId: id, memberIds: [id, explicitSpouse], unionIds });
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

  const getUnionSlotWidth = (unionId: string): number => {
    const info = unionInfos.get(unionId);
    if (!info) return NODE_W * 2 + GAP_COUPLE;
    const children = info.children ?? [];
    if (children.length === 0) return NODE_W * 2 + GAP_COUPLE;
    let totalChildW = 0;
    children.forEach((c, i) => {
      totalChildW += subtreeWidth.get(c) ?? NODE_W;
      if (i > 0) totalChildW += GAP_X;
    });
    return Math.max(NODE_W * 2 + GAP_COUPLE, totalChildW);
  };

  const getCompactUnionSlotWidth = (unionId: string): number => {
    // Visual partner strip width should stay compact even if descendants are wide.
    return Math.min(Math.max(NODE_W + GAP_COUPLE + 20, getUnionSlotWidth(unionId)), 220);
  };

  const getGapBetweenGroups = (leftGroup: LayoutGroup | undefined, rightGroup: LayoutGroup | undefined): number => {
    if (!leftGroup || !rightGroup) return GAP_X;
    // Always give a generous gap next to a multi-union cluster so neighboring
    // families don't get swallowed by it.
    if (leftGroup.type === 'cluster' || rightGroup.type === 'cluster') return GAP_X + 60;
    const leftChildren = getChildrenForLayoutGroup(leftGroup).length;
    const rightChildren = getChildrenForLayoutGroup(rightGroup).length;
    if (leftChildren === 0 || rightChildren === 0) return 56;
    return GAP_X;
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
            // Cluster width = compact visible strip ONLY.
            // Child bands live below and get their own horizontal space —
            // they must NOT inflate the cluster's top-row footprint or it
            // will swallow neighboring families.
            const stripWidth = NODE_W + group.unionIds.reduce((sum, _uid, idx) =>
              sum + NODE_W + GAP_COUPLE + (idx > 0 ? GAP_UNION_GROUP : 0), 0);
            return stripWidth + 24;
          })()
        : group.type === 'couple'
        ? NODE_W * 2 + GAP_COUPLE
        : NODE_W;

      // For clusters: width is fixed at strip width. Children get laid out
      // below independently — do NOT factor them into groupWidth.
      if (group.type === 'cluster') {
        groupWidth.set(group.id, minWidth);
      } else if (allChildren.length === 0) {
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

  const unionHeartX = new Map<string, number>();
  const unionSlots = new Map<string, UnionSlot>();
  const clusterBlockBounds = new Map<string, { left: number; right: number }>();

  // Now re-position all generations top-down using union-aware group widths.
  for (const g of genKeys) {
    const ids = sortedGens.get(g)!;
    const sorted = [...ids].sort((a, b) => (positioned.get(a)?.x ?? 0) - (positioned.get(b)?.x ?? 0));
    const groups = buildGroupsForGeneration(sorted);

    let totalGenWidth = 0;
    groups.forEach((group, i) => {
      totalGenWidth += groupWidth.get(group.id) ?? NODE_W;
      if (i > 0) totalGenWidth += getGapBetweenGroups(groups[i - 1], group);
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
        const sortedUnionIds = [...group.unionIds].sort((a, b) => (unionInfos.get(a)?.secondaryIndex ?? 0) - (unionInfos.get(b)?.secondaryIndex ?? 0));
        const unionLayouts = sortedUnionIds.map((uid) => ({
          unionId: uid,
          info: unionInfos.get(uid),
          width: getCompactUnionSlotWidth(uid),
        }));

        const clusterLeft = curX;
        // Anchor pinned flush-left inside the cluster block so wives extend rightward.
        // Never center the anchor — that pushes it into neighboring families on the right.
        const anchorX = clusterLeft;
        clusterBlockBounds.set(group.anchorId, { left: clusterLeft, right: curX + sw });

        // Sequential strip layout: anchor on the left, all wives/partners to the right.
        // This matches the visual target much better than radial/anchor-packing.
        positioned.set(anchorId, { x: anchorX, y });

        const clusterMembers = [{ id: anchorId, unionId: undefined as string | undefined, anchor: true }];
        let nextPartnerX = anchorX + NODE_W + GAP_COUPLE;

        for (const layout of unionLayouts) {
          const info = layout.info;
          if (!info) continue;
          const partnerId = info.partners.find((id) => id !== anchorId) ?? info.partners[0];
          if (!partnerId) continue;

          const partnerX = nextPartnerX;
          positioned.set(partnerId, { x: partnerX, y });
          clusterMembers.push({ id: partnerId, unionId: layout.unionId, anchor: false });
          nextPartnerX += NODE_W + GAP_UNION_GROUP;
        }

        // After strip placement, re-center each union's children under the actual final union midpoint.
        for (const member of clusterMembers) {
          if (member.anchor || !member.unionId) continue;
          const partnerPos = positioned.get(member.id);
          const anchorPos2 = positioned.get(anchorId);
          if (!partnerPos || !anchorPos2) continue;
          const unionInfo = unionInfos.get(member.unionId);
          const unionChildren = unionInfo?.children ?? [];
          if (unionChildren.length === 0) continue;

          const childrenSorted = [...unionChildren].sort((a, b) => {
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

          const unionMidX = (anchorPos2.x + partnerPos.x + NODE_W) / 2;
          let childX = unionMidX - totalChildW / 2;
          for (const c of childrenSorted) {
            const csw = subtreeWidth.get(c) ?? NODE_W;
            const childMidX = childX + csw / 2;
            const childY = 40 + ((genBySim.get(c) ?? 0)) * (NODE_H + GAP_Y);
            positioned.set(c, { x: childMidX - NODE_W / 2, y: childY });
            childX += csw + GAP_X;
          }
        }
      }

      const allChildren = group.type === 'cluster' ? [] : getChildrenForLayoutGroup(group);
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

      curX += sw + getGapBetweenGroups(group, groups[groups.indexOf(group) + 1]);
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
      const gap = shareExclusivePairUnion(ids[i - 1], ids[i]) ? GAP_COUPLE : GAP_X;
      const minX = prev.x + NODE_W + gap;
      if (cur.x < minX) positioned.set(ids[i], { x: minX, y: cur.y });
    }
  }

  // ── Top-down centering pass ─────────────────────────────────────────────
  // Re-center each non-cluster layout group under its own union/group midpoint.
  for (const g of genKeys) {
    const ids = sortedGens.get(g)!;
    const groups = buildGroupsForGeneration(ids);

    for (const group of groups) {
      if (group.type === 'cluster') continue; // cluster unions are handled later
      const memberPositions = group.memberIds.map((id) => positioned.get(id)).filter(Boolean) as { x: number; y: number }[];
      if (memberPositions.length === 0) continue;
      const allChildren = getChildrenForLayoutGroup(group);
      if (allChildren.length === 0) continue;

      const leftX = Math.min(...memberPositions.map((p) => p.x));
      const rightX = Math.max(...memberPositions.map((p) => p.x)) + NODE_W;
      const groupMidX = (leftX + rightX) / 2;

      const childPositions = allChildren.map((c) => positioned.get(c)).filter(Boolean) as { x: number; y: number }[];
      if (childPositions.length === 0) continue;
      const childLeft = Math.min(...childPositions.map((p) => p.x));
      const childRight = Math.max(...childPositions.map((p) => p.x)) + NODE_W;
      const childGroupMidX = (childLeft + childRight) / 2;

      const shift = groupMidX - childGroupMidX;
      if (Math.abs(shift) > 1) {
        for (const c of allChildren) {
          const pos = positioned.get(c);
          if (pos) positioned.set(c, { x: pos.x + shift, y: pos.y });
        }
      }
    }

    const sortedIds = [...ids].sort((a, b) => (positioned.get(a)?.x ?? 0) - (positioned.get(b)?.x ?? 0));
    for (let i = 1; i < sortedIds.length; i++) {
      const prev = positioned.get(sortedIds[i - 1]);
      const cur = positioned.get(sortedIds[i]);
      if (!prev || !cur) continue;
      const minX = prev.x + NODE_W + 18;
      if (cur.x < minX) positioned.set(sortedIds[i], { x: minX, y: cur.y });
    }
  }

  // Snap visible union partners to identical Y so marriage lines stay horizontal.
  for (const [, partnersSet] of unionPartnersAll) {
    const partnerIds = Array.from(partnersSet).filter((id) => positioned.has(id));
    if (partnerIds.length < 2) continue;
    const partnerPositions = partnerIds.map((id) => positioned.get(id)).filter(Boolean) as { x: number; y: number }[];
    if (partnerPositions.length < 2) continue;
    const sharedY = Math.min(...partnerPositions.map((p) => p.y));
    for (const id of partnerIds) {
      const pos = positioned.get(id);
      if (pos && pos.y !== sharedY) positioned.set(id, { ...pos, y: sharedY });
    }
  }

  // Final family centering pass: non-cluster groups only.
  const recenteredGroups = new Set<string>();
  for (const g of genKeys) {
    const groups = buildGroupsForGeneration(sortedGens.get(g) ?? []);
    for (const group of groups) {
      if (group.type === 'cluster') continue;
      if (recenteredGroups.has(group.id)) continue;
      recenteredGroups.add(group.id);

      const allChildren = getChildrenForLayoutGroup(group);
      if (allChildren.length === 0) continue;
      const memberPositions = group.memberIds.map((id) => positioned.get(id)).filter(Boolean) as { x: number; y: number }[];
      if (memberPositions.length === 0) continue;
      const groupLeft = Math.min(...memberPositions.map((p) => p.x));
      const groupRight = Math.max(...memberPositions.map((p) => p.x)) + NODE_W;
      const groupMidX = (groupLeft + groupRight) / 2;

      const childPositions = allChildren.map((childId) => positioned.get(childId)).filter(Boolean) as { x: number; y: number }[];
      if (childPositions.length === 0) continue;
      const childLeft = Math.min(...childPositions.map((p) => p.x));
      const childRight = Math.max(...childPositions.map((p) => p.x)) + NODE_W;
      const childGroupMidX = (childLeft + childRight) / 2;
      const shift = groupMidX - childGroupMidX;

      if (Math.abs(shift) > 0.5) {
        for (const childId of allChildren) {
          const childPos = positioned.get(childId);
          if (childPos) positioned.set(childId, { x: childPos.x + shift, y: childPos.y });
        }
      }
    }
  }

  type UnionSlot = {
    left: number;
    right: number;
    heartX: number;
    heartY: number;
    childLeft?: number;
    childRight?: number;
    childBarY?: number;
  };

  // Final multi-union normalization pass.
  // Hidden/dead spouses and old pair-centering logic can still leave the strip
  // visually backwards or mixed. Force shared-sim clusters into a clean strip:
  // anchor sim first, then visible partners to the right, then re-center each
  // union's children under the corrected midpoint.
  for (const [anchorId, unionIds] of simToUnionIds) {
    if (unionIds.length <= 1) continue;
    const anchorPos = positioned.get(anchorId);
    if (!anchorPos) continue;

    const unionStripLayouts = unionIds
      .map((uid) => ({ uid, info: unionInfos.get(uid) }))
      .filter((x) => x.info)
      .sort((a, b) => {
        const aPrimary = a.info?.primary ? 1 : 0;
        const bPrimary = b.info?.primary ? 1 : 0;
        if (aPrimary !== bPrimary) return bPrimary - aPrimary;
        return (a.info?.secondaryIndex ?? 0) - (b.info?.secondaryIndex ?? 0);
      });
    if (unionStripLayouts.length === 0) continue;

    const clusterMemberPositions = [anchorId, ...unionStripLayouts.flatMap((x) => x.info?.partners ?? [])]
      .filter((id, idx, arr) => arr.indexOf(id) === idx)
      .map((id) => positioned.get(id)?.x)
      .filter((x): x is number => x != null);
    if (clusterMemberPositions.length === 0) continue;

    const block = clusterBlockBounds.get(anchorId);
    const anchorX = Math.min(...clusterMemberPositions);
    const clampedAnchorX = block ? Math.max(block.left, Math.min(anchorX, block.right - NODE_W)) : anchorX;
    positioned.set(anchorId, { x: clampedAnchorX, y: anchorPos.y });

    let nextSlotStart = clampedAnchorX + NODE_W + GAP_COUPLE;
    let nextPartnerX = clampedAnchorX + NODE_W + GAP_COUPLE;
    const anchorCenter = clampedAnchorX + NODE_W / 2;
    const HEART_BIAS = 0.82;
    for (const layout of unionStripLayouts) {
      const info = layout.info;
      if (!info) continue;
      const partnerId = info.partners.find((id) => id !== anchorId && positioned.has(id));
      const unionSlotWidth = Math.max(NODE_W + GAP_COUPLE + 20, getUnionSlotWidth(layout.uid));

      // Keep the visible spouse strip compact. Descendant width should influence the
      // child band below, not blow the spouses apart on the top row.
      const partnerX = nextPartnerX;
      const partnerCenterX = partnerX + NODE_W / 2;
      const slotCenterX = anchorCenter + (partnerCenterX - anchorCenter) * HEART_BIAS;
      if (partnerId) {
        const partnerPos = positioned.get(partnerId);
        if (partnerPos) positioned.set(partnerId, { x: partnerX, y: anchorPos.y });
      }

      const unionChildren = info.children ?? [];
      const heartX = block ? Math.max(block.left + NODE_W / 2, Math.min(slotCenterX, block.right - NODE_W / 2)) : slotCenterX;
      const heartY = anchorPos.y + NODE_H + 20;
      // Keep union child bars on one cleaner shared level where possible.
      const childBarY = heartY + 42;
      unionHeartX.set(layout.uid, heartX);

      if (unionChildren.length > 0) {
        const childrenSorted = [...unionChildren].sort((a, b) => {
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

        const childBandWidth = Math.max(totalChildW, unionSlotWidth);
        const childBandLeft = nextSlotStart + (unionSlotWidth - childBandWidth) / 2;
        const childBandRight = childBandLeft + childBandWidth;
        unionSlots.set(layout.uid, {
          left: Math.min(anchorX, partnerX),
          right: Math.max(anchorX + NODE_W, partnerX + NODE_W),
          heartX,
          heartY,
          childLeft: childBandLeft,
          childRight: childBandRight,
          childBarY,
        });
        let childX = childBandLeft + Math.max(0, (childBandWidth - totalChildW) / 2);
        for (const c of childrenSorted) {
          const csw = subtreeWidth.get(c) ?? NODE_W;
          const childMidX = childX + csw / 2;
          const childY = 40 + ((genBySim.get(c) ?? 0)) * (NODE_H + GAP_Y);
          positioned.set(c, { x: childMidX - NODE_W / 2, y: childY });
          childX += csw + GAP_X;
        }
      } else {
        unionSlots.set(layout.uid, {
          left: Math.min(anchorX, partnerX),
          right: Math.max(anchorX + NODE_W, partnerX + NODE_W),
          heartX,
          heartY,
          childLeft: nextSlotStart,
          childRight: nextSlotStart + unionSlotWidth,
          childBarY,
        });
      }

      nextSlotStart += unionSlotWidth + GAP_UNION_GROUP;
    }
  }

  // Add a minimum gutter between neighboring union child bands in shared-parent strips.
  for (const [, unionIds] of simToUnionIds) {
    if (unionIds.length <= 1) continue;
    const laidOutSlots = unionIds
      .map((uid) => ({ uid, slot: unionSlots.get(uid) }))
      .filter((x): x is { uid: string; slot: NonNullable<typeof x.slot> } => !!x.slot && x.slot.childLeft != null && x.slot.childRight != null)
      .sort((a, b) => (a.slot.childLeft! - b.slot.childLeft!));

    const MIN_GUTTER = 24;
    for (let i = 1; i < laidOutSlots.length; i++) {
      const prev = laidOutSlots[i - 1].slot;
      const curEntry = laidOutSlots[i];
      const cur = curEntry.slot;
      const overlap = (prev.childRight ?? 0) + MIN_GUTTER - (cur.childLeft ?? 0);
      if (overlap > 0) {
        // Shift the entire union group together, not just the children underneath.
        cur.left += overlap;
        cur.right += overlap;
        cur.heartX += overlap;
        if (cur.childLeft != null) cur.childLeft += overlap;
        if (cur.childRight != null) cur.childRight += overlap;
        unionHeartX.set(curEntry.uid, cur.heartX);

        const unionInfo = unionInfos.get(curEntry.uid);
        const unionChildren = unionInfo?.children ?? [];
        for (const childId of unionChildren) {
          const pos = positioned.get(childId);
          if (pos) positioned.set(childId, { x: pos.x + overlap, y: pos.y });
        }

        // Also move the visible non-anchor partner card for this union so the top band
        // reflects the same spacing that the child band requires.
        const visiblePartnerIds = (unionInfo?.partners ?? []).filter((id) => positioned.has(id));
        const anchorId = getPreferredClusterAnchor(visiblePartnerIds);
        for (const pid of visiblePartnerIds) {
          if (pid === anchorId) continue;
          const pos = positioned.get(pid);
          if (pos) positioned.set(pid, { x: pos.x + overlap, y: pos.y });
        }
      }
    }
  }

  // Final collision cleanup per generation after all union-strip normalization.
  // Keep multi-union families in their own visible top-row block so unrelated
  // groups don't drift into their space.
  const shiftGroupWithChildren = (group: LayoutGroup, dx: number) => {
    const idsToShift = [...group.memberIds, ...getChildrenForLayoutGroup(group)];
    for (const id of idsToShift) {
      const pos = positioned.get(id);
      if (pos) positioned.set(id, { x: pos.x + dx, y: pos.y });
    }
    for (const unionId of group.unionIds) {
      const slot = unionSlots.get(unionId);
      if (!slot) continue;
      slot.left += dx;
      slot.right += dx;
      slot.heartX += dx;
      if (slot.childLeft != null) slot.childLeft += dx;
      if (slot.childRight != null) slot.childRight += dx;
      unionHeartX.set(unionId, slot.heartX);
    }
  };

  for (const g of genKeys) {
    const groups = buildGroupsForGeneration(sortedGens.get(g) ?? []).map((group) => {
      const memberPositions = group.memberIds.map((id) => positioned.get(id)).filter(Boolean) as { x: number; y: number }[];
      if (memberPositions.length === 0) return { group, left: 0, right: 0 };
      let left = Math.min(...memberPositions.map((p) => p.x));
      let right = Math.max(...memberPositions.map((p) => p.x + NODE_W));

      if (group.type === 'cluster') {
        // For clusters, bound only by the cluster's own member + child positions,
        // NOT by slot widths which can bleed into neighboring families' space.
        const clusterChildIds = group.unionIds.flatMap((uid) => Array.from(unionChildrenAll.get(uid) ?? []))
          .filter((id) => positioned.has(id));
        for (const cid of clusterChildIds) {
          const pos = positioned.get(cid)!;
          left = Math.min(left, pos.x);
          right = Math.max(right, pos.x + NODE_W);
        }
      }

      return { group, left, right };
    }).sort((a, b) => a.left - b.left);

    for (let i = 1; i < groups.length; i++) {
      const prev = groups[i - 1];
      const cur = groups[i];
      const minGap = getGapBetweenGroups(prev.group, cur.group);
      const minLeft = prev.right + minGap;
      if (cur.left < minLeft) {
        const dx = minLeft - cur.left;
        shiftGroupWithChildren(cur.group, dx);
        cur.left += dx;
        cur.right += dx;
      }
    }
  }

  // Build result
  const result: Node[] = nodes.map((n) => ({ ...n }));

  // Add visual cluster boundary nodes — sized from ACTUAL node positions only,
  // never from slot/subtree widths which can include unrelated families' space.
  for (const [anchorId, unionIds] of simToUnionIds) {
    if (unionIds.length <= 1) continue;

    // Collect only the sims that logically belong to this cluster:
    // anchor + direct union partners + their union-owned children.
    const clusterMemberIds = new Set<string>([anchorId]);
    const clusterChildIds = new Set<string>();
    for (const uid of unionIds) {
      for (const pid of unionPartnersAll.get(uid) ?? []) clusterMemberIds.add(pid);
      for (const cid of unionChildrenAll.get(uid) ?? []) clusterChildIds.add(cid);
    }

    const allClusterIds = [...clusterMemberIds, ...clusterChildIds].filter((id) => positioned.has(id));
    if (allClusterIds.length === 0) continue;

    // Left/right sized from MEMBERS ONLY (the partner strip) so the box stays
    // tight around the top row and doesn't swallow neighboring families whose
    // children happen to land in the same horizontal band.
    const memberPositions = [...clusterMemberIds].filter(id => positioned.has(id)).map(id => positioned.get(id)!);
    const childPositions = [...clusterChildIds].filter(id => positioned.has(id)).map(id => positioned.get(id)!);
    if (memberPositions.length === 0) continue;

    const PADDING = 20;
    const left = Math.min(...memberPositions.map((p) => p.x)) - PADDING;
    const right = Math.max(...memberPositions.map((p) => p.x + NODE_W)) + PADDING;
    const top = Math.min(...memberPositions.map((p) => p.y)) - PADDING;
    const memberBottom = Math.max(...memberPositions.map(p => p.y + NODE_H));
    const childBottom = childPositions.length > 0
      ? Math.max(...childPositions.map(id => id.y + NODE_H))
      : memberBottom;
    const bottom = Math.max(memberBottom, childBottom) + PADDING;

    result.push({
      id: `cluster:${anchorId}`,
      type: 'clusterBoundary',
      position: { x: left, y: top },
      draggable: false,
      selectable: false,
      data: { width: right - left, height: bottom - top, label: 'Relationship cluster' },
      zIndex: -10,
    } as Node);
  }

  // Also draw boxes around normal couple/family groups so overlaps are visible.
  const drawnBoundaryIds = new Set(Array.from(simToUnionIds.entries()).filter(([, uids]) => uids.length > 1).map(([id]) => id));
  for (const g of genKeys) {
    const groups = buildGroupsForGeneration(sortedGens.get(g) ?? []);
    for (const group of groups) {
      if (group.type === 'single') continue; // skip lone sims
      if (drawnBoundaryIds.has(group.anchorId)) continue; // already drew a multi-union box

      const memberIds = group.memberIds.filter((id) => positioned.has(id));
      const childIds = getChildrenForLayoutGroup(group).filter((id) => positioned.has(id));
      const allIds = [...memberIds, ...childIds];
      if (allIds.length === 0) continue;

      const allPos = allIds.map((id) => positioned.get(id)).filter(Boolean) as { x: number; y: number }[];
      const PADDING = 16;
      const left = Math.min(...allPos.map((p) => p.x)) - PADDING;
      const right = Math.max(...allPos.map((p) => p.x + NODE_W)) + PADDING;
      const top = Math.min(...allPos.map((p) => p.y)) - PADDING;
      const bottom = Math.max(...allPos.map((p) => p.y + NODE_H)) + PADDING;

      result.push({
        id: `family:${group.id}`,
        type: 'clusterBoundary',
        position: { x: left, y: top },
        draggable: false,
        selectable: false,
        data: { width: right - left, height: bottom - top, label: undefined, family: true },
        zIndex: -10,
      } as Node);
    }
  }

  for (const s of simNodes) {
    const pos = positioned.get(s.id as string) ?? { x: 40, y: 40 };
    const idx = result.findIndex((r) => r.id === s.id);
    if (idx !== -1) result[idx] = { ...result[idx], position: pos };
  }

  // Inject explicit heart/drop coordinates into edges so renderers don't have to guess.
  const updatedEdges = edges.map((e) => {
    const spouseData = (e.data as { kind?: string; unionId?: string; multiUnion?: boolean } | undefined);
    if (spouseData?.kind === 'spouse') {
      const srcPos = positioned.get(String(e.source));
      const tgtPos = positioned.get(String(e.target));
      if (!srcPos || !tgtPos) return e;
      const leftCenter = Math.min(srcPos.x, tgtPos.x) + NODE_W / 2;
      const rightCenter = Math.max(srcPos.x, tgtPos.x) + NODE_W / 2;
      const slot = unionSlots.get(spouseData.unionId ?? '');
      const heartX = slot?.heartX
        ?? unionHeartX.get(spouseData.unionId ?? '')
        ?? (spouseData.multiUnion ? leftCenter + (rightCenter - leftCenter) * 0.82 : (leftCenter + rightCenter) / 2);
      const heartY = slot?.heartY ?? (Math.max(srcPos.y + NODE_H, tgtPos.y + NODE_H) + 20);
      return { ...e, data: { ...e.data, heartX, heartY } };
    }

    const data = (e.data as { kind?: string; unionId?: string } | undefined);
    const kind = data?.kind;
    if (kind !== 'parent') return e;

    const srcPos = positioned.get(String(e.source));
    if (!srcPos) return e;

    // Prefer the exact union partners when available.
    if (data?.unionId) {
      const explicitSlot = unionSlots.get(data.unionId);
      const explicitHeartX = explicitSlot?.heartX ?? unionHeartX.get(data.unionId);
      if (explicitHeartX != null) {
        const heartY = explicitSlot?.heartY ?? (srcPos.y + NODE_H + 20);
        return { ...e, data: { ...e.data, midX: explicitHeartX, heartY, childLeft: explicitSlot?.childLeft, childRight: explicitSlot?.childRight, childBarY: explicitSlot?.childBarY } };
      }

      const partners = Array.from(unionPartners.get(data.unionId) ?? []);
      const partnerPositions = partners
        .map((id) => positioned.get(id))
        .filter(Boolean) as { x: number; y: number }[];
      if (partnerPositions.length >= 2) {
        const leftX = Math.min(...partnerPositions.map((p) => p.x));
        const rightX = Math.max(...partnerPositions.map((p) => p.x));
        const partnerCenterA = leftX + NODE_W / 2;
        const partnerCenterB = rightX + NODE_W / 2;
        const isMultiUnion = partners.length > 1 && Array.from(partners).some((id) => (simToUnionIds.get(id)?.length ?? 0) > 1);
        const midX = isMultiUnion
          ? partnerCenterA + (partnerCenterB - partnerCenterA) * 0.82
          : (leftX + rightX + NODE_W) / 2;
        const heartY = Math.max(...partnerPositions.map((p) => p.y + NODE_H)) + 20;
        return { ...e, data: { ...e.data, midX, heartY } };
      }
    }

    // Fallback: if we know both parents from childToParentSims, use their midpoint.
    const parentIds = Array.from(childToParentSims.get(String(e.target)) ?? []).filter((id) => positioned.has(id));
    if (parentIds.length >= 2) {
      const parentPositions = parentIds.map((id) => positioned.get(id)).filter(Boolean) as { x: number; y: number }[];
      const leftX = Math.min(...parentPositions.map((p) => p.x));
      const rightX = Math.max(...parentPositions.map((p) => p.x));
      const midX = (leftX + rightX + NODE_W) / 2;
      const heartY = Math.max(...parentPositions.map((p) => p.y + NODE_H)) + 20;
      return { ...e, data: { ...e.data, midX, heartY } };
    }

    // Last resort: single-parent center.
    return { ...e, data: { ...e.data, midX: srcPos.x + NODE_W / 2, heartY: srcPos.y + NODE_H + 20 } };
  });

  return { nodes: result, edges: updatedEdges };
}
