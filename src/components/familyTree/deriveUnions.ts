import { nanoid } from 'nanoid';
import type { SimEntry, UnionNode } from '../../types/tracker';

function pairKey(a?: string, b?: string): string | null {
  if (!a || !b) return null;
  return [a, b].sort().join('|');
}

export function deriveUnionsFromSims(sims: SimEntry[], existing: UnionNode[]): { unions: UnionNode[]; sims: SimEntry[] } {
  const unions = [...(existing ?? [])];
  const simsNext = sims.map((s) => ({ ...s }));

  const unionByPair = new Map<string, UnionNode[]>();
  for (const u of unions) {
    const k = pairKey(u.partnerAId, u.partnerBId);
    if (!k) continue;
    unionByPair.set(k, [...(unionByPair.get(k) ?? []), u]);
  }

  const ensureUnion = (a: string, b: string, startYear?: number) => {
    const k = pairKey(a, b)!;
    const existingList = unionByPair.get(k) ?? [];

    // If we already have a union with same partners, reuse the most recent (by startYear)
    if (existingList.length > 0) {
      existingList.sort((x, y) => (y.startYear ?? 0) - (x.startYear ?? 0));
      return existingList[0];
    }

    const u: UnionNode = {
      id: nanoid(),
      partnerAId: a,
      partnerBId: b,
      startYear,
    };
    unions.push(u);
    unionByPair.set(k, [u]);
    return u;
  };

  // 1) Spouse-based unions
  // If sim has spouseId, create a union for that pair.
  for (const s of simsNext) {
    if (!s.spouseId) continue;
    const a = s.id;
    const b = s.spouseId;
    const startYear = s.marriageYear;
    ensureUnion(a, b, startYear);
  }

  // 2) Parent-pair unions (if child has both parents)
  // If there is no union for the parent pair, create one.
  // Try to infer startYear from earliest child birthYear.
  const earliestChildByPair = new Map<string, number>();
  for (const c of simsNext) {
    const k = pairKey(c.fatherId, c.motherId);
    if (!k) continue;
    const by = c.birthYear;
    if (!by) continue;
    const prev = earliestChildByPair.get(k);
    if (prev == null || by < prev) earliestChildByPair.set(k, by);
  }

  for (const [k, earliest] of earliestChildByPair.entries()) {
    const [p1, p2] = k.split('|');
    const inferredStart = earliest ? earliest - 1 : undefined;
    ensureUnion(p1, p2, inferredStart);
  }

  // 3) If a child has exactly one union candidate for its parents, auto-assign birthUnionId
  const unionsByParents = new Map<string, UnionNode[]>();
  for (const u of unions) {
    const k = pairKey(u.partnerAId, u.partnerBId);
    if (!k) continue;
    unionsByParents.set(k, [...(unionsByParents.get(k) ?? []), u]);
  }

  for (const c of simsNext) {
    if (c.birthUnionId) continue;
    const k = pairKey(c.fatherId, c.motherId);
    if (!k) continue;
    const candidates = unionsByParents.get(k) ?? [];

    // Narrow by birth year if possible
    const by = c.birthYear;
    const narrowed = by
      ? candidates.filter((u) => (u.startYear ?? -Infinity) <= by && (u.endYear ?? Infinity) >= by)
      : candidates;

    if (narrowed.length === 1) {
      c.birthUnionId = narrowed[0].id;
    }
  }

  return { unions, sims: simsNext };
}
