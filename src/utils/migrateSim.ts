import type { SimEntry, SimSex } from '../types/tracker';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrateSimEntry(sim: any): SimEntry {
  const firstName = (sim.firstName ?? '').toString();
  const lastName = (sim.lastName ?? '').toString();

  // Back-compat: split legacy name into first/last if missing
  let fn = firstName;
  let ln = lastName;
  if ((!fn || !ln) && sim.name) {
    const parts = String(sim.name).trim().split(/\s+/);
    if (!fn) fn = parts[0] ?? '';
    if (!ln) ln = parts.slice(1).join(' ') ?? '';
  }

  const sex: SimSex | undefined = sim.sex as SimSex | undefined;

  const cropRaw = sim.avatarCrop as { x?: unknown; y?: unknown; zoom?: unknown } | undefined;
  const avatarCrop = cropRaw && typeof cropRaw === 'object'
    ? {
        x: Number.isFinite(Number(cropRaw.x)) ? Number(cropRaw.x) : 50,
        y: Number.isFinite(Number(cropRaw.y)) ? Number(cropRaw.y) : 50,
        zoom: Number.isFinite(Number(cropRaw.zoom)) ? Math.min(3, Math.max(1, Number(cropRaw.zoom))) : 1,
      }
    : undefined;

  return {
    id: String(sim.id ?? ''),
    traits: Array.isArray(sim.traits) ? sim.traits.map((t: unknown) => String(t)).filter(Boolean) : undefined,
    firstName: fn,
    lastName: ln,
    maidenName: sim.maidenName as string | undefined,
    showMaidenName: sim.showMaidenName as boolean | undefined,
    name: sim.name,
    sex,
    fatherId: sim.fatherId as string | undefined,
    motherId: sim.motherId as string | undefined,
    spouseId: sim.spouseId as string | undefined,
    birthYear: sim.birthYear as number | undefined,
    birthDayOfYear: sim.birthDayOfYear as number | undefined,
    deathYear: sim.deathYear as number | undefined,
    deathDayOfYear: sim.deathDayOfYear as number | undefined,
    marriageYear: sim.marriageYear as number | undefined,
    birthDayNumber: sim.birthDayNumber as number | undefined,
    deathDayNumber: sim.deathDayNumber as number | undefined,
    marriageDayNumber: sim.marriageDayNumber as number | undefined,
    dateOfBirth: sim.dateOfBirth as string | undefined,
    dateOfDeath: sim.dateOfDeath as string | undefined,
    placeOfBirth: sim.placeOfBirth as string | undefined,
    causeOfDeath: sim.causeOfDeath as string | undefined,
    avatarUrl: sim.avatarUrl as string | undefined,
    avatarBlobKey: sim.avatarBlobKey as string | undefined,
    avatarCrop,
    currentLifeStage: sim.currentLifeStage as string | undefined,
    generation: Number(sim.generation ?? 1),
    notes: sim.notes as string | undefined,
    married: sim.married as boolean | undefined,
    pregnancyAttempts: sim.pregnancyAttempts as number | undefined,
    pregnancyAttemptsUsed: sim.pregnancyAttemptsUsed as number | undefined,
  };
}
