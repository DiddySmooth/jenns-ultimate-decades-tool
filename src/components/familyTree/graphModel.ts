export type PersonNode = {
  id: string;
  simId: string;
  fatherId?: string | null;
  motherId?: string | null;
  birthYear?: number | null;
  birthUnionId?: string | null;
  // keep original sim payload if needed by later phases
  raw?: any;
};

export type Union = {
  id: string;
  partnerAId?: string | null;
  partnerBId?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  startDayOfYear?: number | null;
  endReason?: string | null;
};

export type RelationshipGraph = {
  people: Map<string, PersonNode>; // key = sim.id
  unions: Map<string, Union>;
  childrenByUnion: Map<string, string[]>; // unionId -> [childSimId]
  unionsByParents: Map<string, string[]>; // sorted parent pair key -> [unionId]
  childrenByParent: Map<string, string[]>; // parentSimId -> [childSimId]
};

export function buildRelationshipGraph(sims: any[], unionsArr: any[]): RelationshipGraph {
  const people = new Map<string, PersonNode>();
  const unions = new Map<string, Union>();
  const childrenByUnion = new Map<string, string[]>();
  const unionsByParents = new Map<string, string[]>();
  const childrenByParent = new Map<string, string[]>();

  for (const s of sims) {
    people.set(s.id, {
      id: `sim:${s.id}`,
      simId: s.id,
      fatherId: s.fatherId ?? null,
      motherId: s.motherId ?? null,
      birthYear: s.birthYear ?? null,
      birthUnionId: s.birthUnionId ?? null,
      raw: s,
    });

    if (s.fatherId) childrenByParent.set(s.fatherId, [...(childrenByParent.get(s.fatherId) ?? []), s.id]);
    if (s.motherId) childrenByParent.set(s.motherId, [...(childrenByParent.get(s.motherId) ?? []), s.id]);
  }

  for (const u of unionsArr) {
    unions.set(String(u.id), {
      id: String(u.id),
      partnerAId: u.partnerAId ?? null,
      partnerBId: u.partnerBId ?? null,
      startYear: u.startYear ?? null,
      endYear: u.endYear ?? null,
      startDayOfYear: u.startDayOfYear ?? null,
      endReason: u.endReason ?? null,
    });

    const a = u.partnerAId;
    const b = u.partnerBId;
    if (a && b) {
      const key = [a, b].sort().join('|');
      unionsByParents.set(key, [...(unionsByParents.get(key) ?? []), String(u.id)]);
    }
  }

  // populate childrenByUnion using explicit birthUnionId
  for (const p of sims) {
    if (p.birthUnionId) {
      const arr = childrenByUnion.get(String(p.birthUnionId)) ?? [];
      arr.push(p.id);
      childrenByUnion.set(String(p.birthUnionId), arr);
    }
  }

  return { people, unions, childrenByUnion, unionsByParents, childrenByParent };
}
