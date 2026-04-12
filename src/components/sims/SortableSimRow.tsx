import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import type { SimEntry, TrackerConfig } from '../../types/tracker';
import { computeLifeStage, getFullName } from '../../utils/lifeStage';
import { formatYear, getBirthYear, getDeathYear } from '../../utils/simDates';

interface Props {
  sim: SimEntry;
  config: TrackerConfig;
  currentDay: number;
  resolveName: (id?: string) => string;
  expanded: boolean;
  onToggleExpanded: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function short(value: string | undefined, fallback = '—') {
  const v = (value ?? '').trim();
  return v || fallback;
}

export default function SortableSimRow({
  sim,
  config,
  currentDay,
  resolveName,
  expanded,
  onToggleExpanded,
  onEdit,
  onDelete,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sim.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  const fullName = getFullName(sim);
  const stage = computeLifeStage(sim, config, currentDay);
  const birthYear = getBirthYear(sim, config);
  const deathYear = getDeathYear(sim, config);

  return (
    <div ref={setNodeRef} style={style} className={`sim-row${expanded ? ' expanded' : ''}${deathYear ? ' deceased' : ''}`}>
      <div className="sim-row-main">
        <button
          ref={setActivatorNodeRef}
          className="btn-icon drag-handle"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
        >
          ≡
        </button>

        <button className="btn-icon expand-toggle" onClick={onToggleExpanded} title={expanded ? 'Collapse' : 'Expand'}>
          {expanded ? '▾' : '▸'}
        </button>

        <div className="sim-cell name" title={fullName}>{fullName}</div>
        <div className="sim-cell stage" title={stage}>{stage || '—'}</div>
        <div className="sim-cell sex" title={sim.sex ?? 'Unknown'}>{sim.sex ?? 'Unknown'}</div>
        <div className="sim-cell gen" title={`Gen ${sim.generation}`}>G{sim.generation}</div>

        <div className="sim-cell born" title={formatYear(birthYear)}>{formatYear(birthYear)}</div>
        <div className="sim-cell pob" title={sim.placeOfBirth ?? ''}>{short(sim.placeOfBirth)}</div>

        <div className="sim-cell father" title={resolveName(sim.fatherId)}>{resolveName(sim.fatherId)}</div>
        <div className="sim-cell mother" title={resolveName(sim.motherId)}>{resolveName(sim.motherId)}</div>
        <div className="sim-cell spouse" title={resolveName(sim.spouseId)}>{resolveName(sim.spouseId)}</div>

        <div className="sim-cell married" title={sim.marriageYear ? `Year ${sim.marriageYear}` : '—'}>
          {sim.marriageYear ? `Year ${sim.marriageYear}` : '—'}
        </div>

        <div className="sim-cell died" title={formatYear(deathYear)}>{formatYear(deathYear)}</div>
        <div className="sim-cell cod" title={sim.causeOfDeath ?? ''}>{short(sim.causeOfDeath)}</div>

        <div className="sim-actions">
          <button className="btn-ghost btn-sm" onClick={onEdit}>Edit</button>
          <button className="btn-ghost btn-sm btn-danger" onClick={onDelete}>Remove</button>
        </div>
      </div>

      {expanded && (
        <div className="sim-row-details">
          <div className="details-grid">
            <div className="detail"><strong>Name:</strong> {fullName}</div>
            <div className="detail"><strong>Life Stage:</strong> {stage || '—'}</div>
            <div className="detail"><strong>Sex:</strong> {sim.sex ?? 'Unknown'}</div>
            <div className="detail"><strong>Generation:</strong> {sim.generation}</div>

            <div className="detail"><strong>Born:</strong> {formatYear(birthYear)}</div>
            <div className="detail"><strong>Place of Birth:</strong> {short(sim.placeOfBirth)}</div>

            <div className="detail"><strong>Father:</strong> {resolveName(sim.fatherId)}</div>
            <div className="detail"><strong>Mother:</strong> {resolveName(sim.motherId)}</div>
            <div className="detail"><strong>Spouse:</strong> {resolveName(sim.spouseId)}</div>
            <div className="detail"><strong>Marriage Year:</strong> {sim.marriageYear ? `Year ${sim.marriageYear}` : '—'}</div>

            <div className="detail"><strong>Died:</strong> {formatYear(deathYear)}</div>
            <div className="detail"><strong>Cause of Death:</strong> {short(sim.causeOfDeath)}</div>

            <div className="detail detail-full"><strong>Notes:</strong> {short(sim.notes)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
