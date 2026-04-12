import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import type { SimEntry, TrackerConfig } from '../../types/tracker';
import { computeLifeStage, getFullName } from '../../utils/lifeStage';
import { formatYear, getBirthYear, getDeathYear } from '../../utils/simDates';

interface Props {
  sim: SimEntry;
  index: number;
  config: TrackerConfig;
  currentDay: number;
  resolveName: (id?: string) => string;
  onEdit: () => void;
  onDelete: () => void;
}

export default function SortableSimCard({ sim, config, currentDay, resolveName, onEdit, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sim.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  const stage = computeLifeStage(sim, config, currentDay);
  const fullName = getFullName(sim);
  const birthYear = getBirthYear(sim, config);
  const deathYear = getDeathYear(sim, config);

  return (
    <div ref={setNodeRef} style={style} className={`sim-card${deathYear ? ' deceased' : ''}`}>
      <div className="sim-card-header">
        <strong>{fullName}</strong>
        <span className="sim-stage">{stage || sim.currentLifeStage || ''}</span>
      </div>

      <div className="sim-card-meta stacked">
        <span><strong>Sex:</strong> {sim.sex ?? 'Unknown'}</span>
        <span><strong>Generation:</strong> {sim.generation}</span>
        <span><strong>Born:</strong> {formatYear(birthYear)} {sim.placeOfBirth ? `(${sim.placeOfBirth})` : ''}</span>
        <span><strong>Father:</strong> {resolveName(sim.fatherId)}</span>
        <span><strong>Mother:</strong> {resolveName(sim.motherId)}</span>
        <span><strong>Spouse:</strong> {resolveName(sim.spouseId)}</span>
        <span><strong>Married:</strong> {sim.marriageYear ? `Year ${sim.marriageYear}` : '—'}</span>
        <span><strong>Died:</strong> {formatYear(deathYear)}{sim.causeOfDeath ? ` (${sim.causeOfDeath})` : ''}</span>
        {sim.notes ? <span><strong>Notes:</strong> {sim.notes}</span> : null}
      </div>

      <div className="sim-card-actions">
        <button className="btn-icon drag-handle" {...attributes} {...listeners} title="Drag to reorder">≡</button>
        <button className="btn-ghost btn-sm" onClick={onEdit}>Edit</button>
        <button className="btn-ghost btn-sm btn-danger" onClick={onDelete}>Remove</button>
      </div>
    </div>
  );
}
