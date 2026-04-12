import type { SimEntry, SimSex } from '../types/tracker';

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

  const sex: SimSex | undefined = sim.sex;

  return {
    id: String(sim.id ?? ''),
    firstName: fn,
    lastName: ln,
    name: sim.name,
    sex,
    fatherId: sim.fatherId,
    motherId: sim.motherId,
    spouseId: sim.spouseId,
    birthYear: sim.birthYear,
    deathYear: sim.deathYear,
    marriageYear: sim.marriageYear,
    birthDayNumber: sim.birthDayNumber,
    deathDayNumber: sim.deathDayNumber,
    marriageDayNumber: sim.marriageDayNumber,
    dateOfBirth: sim.dateOfBirth,
    dateOfDeath: sim.dateOfDeath,
    placeOfBirth: sim.placeOfBirth,
    causeOfDeath: sim.causeOfDeath,
    currentLifeStage: sim.currentLifeStage,
    generation: Number(sim.generation ?? 1),
    notes: sim.notes,
    married: sim.married,
    pregnancyAttempts: sim.pregnancyAttempts,
    pregnancyAttemptsUsed: sim.pregnancyAttemptsUsed,
  };
}
