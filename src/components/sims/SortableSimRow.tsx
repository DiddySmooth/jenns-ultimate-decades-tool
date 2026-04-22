import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import type { SimEntry, TrackerConfig, SimsSheetConfig } from '../../types/tracker';
import { computeLifeStage, getFullName } from '../../utils/lifeStage';
import { computeAgeYears, formatYear, getBirthYear, getDeathYear } from '../../utils/simDates';

interface Props {
  sim: SimEntry;
  config: TrackerConfig;
  sheetConfig: SimsSheetConfig;
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
  sheetConfig,
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
  const ageYears = computeAgeYears(sim, config, currentDay);

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
        {sheetConfig.showAge && <div className="sim-cell age" title={ageYears != null ? `${ageYears}` : ''}>{ageYears != null ? `${ageYears}y` : '—'}</div>}
        {sheetConfig.showSex && <div className="sim-cell sex" title={sim.sex ?? 'Unknown'}>{sim.sex ?? 'Unknown'}</div>}
        {sheetConfig.showGeneration && <div className="sim-cell gen" title={`Gen ${sim.generation}`}>G{sim.generation}</div>}

        <div className="sim-cell born" title={formatYear(birthYear)}>{formatYear(birthYear)}</div>
        {sheetConfig.showBirthplace && <div className="sim-cell pob" title={sim.placeOfBirth ?? ''}>{short(sim.placeOfBirth)}</div>}

        {sheetConfig.showParents && <div className="sim-cell father" title={resolveName(sim.fatherId)}>{resolveName(sim.fatherId)}</div>}
        {sheetConfig.showParents && <div className="sim-cell mother" title={resolveName(sim.motherId)}>{resolveName(sim.motherId)}</div>}
        {sheetConfig.showPartners && <div className="sim-cell spouse" title={resolveName(sim.spouseId)}>{resolveName(sim.spouseId)}</div>}

        {sheetConfig.showPartners && (
          <div className="sim-cell married" title={sim.marriageYear ? `Year ${sim.marriageYear}` : '—'}>
            {sim.marriageYear ? `Year ${sim.marriageYear}` : '—'}
          </div>
        )}

        <div className="sim-cell died" title={formatYear(deathYear)}>{formatYear(deathYear)}</div>
        {sheetConfig.showCauseOfDeath && <div className="sim-cell cod" title={sim.causeOfDeath ?? ''}>{short(sim.causeOfDeath)}</div>}
        {sheetConfig.showTraits && <div className="sim-cell traits" title={(sim.traits ?? []).join(', ')}>{sim.traits && sim.traits.length ? sim.traits.join(', ') : '—'}</div>}

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
            {sheetConfig.showAge && <div className="detail"><strong>Age:</strong> {ageYears != null ? `${ageYears} years` : '—'}</div>}
            {sheetConfig.showSex && <div className="detail"><strong>Sex:</strong> {sim.sex ?? 'Unknown'}</div>}
            {sheetConfig.showGeneration && <div className="detail"><strong>Generation:</strong> {sim.generation}</div>}

            <div className="detail"><strong>Born:</strong> {formatYear(birthYear)}</div>
            {sheetConfig.showBirthplace && <div className="detail"><strong>Place of Birth:</strong> {short(sim.placeOfBirth)}</div>}

            {sheetConfig.showParents && <div className="detail"><strong>Father:</strong> {resolveName(sim.fatherId)}</div>}
            {sheetConfig.showParents && <div className="detail"><strong>Mother:</strong> {resolveName(sim.motherId)}</div>}
            {sheetConfig.showPartners && <div className="detail"><strong>Spouse:</strong> {resolveName(sim.spouseId)}</div>}
            {sheetConfig.showPartners && <div className="detail"><strong>Marriage Year:</strong> {sim.marriageYear ? `Year ${sim.marriageYear}` : '—'}</div>}

            <div className="detail"><strong>Died:</strong> {formatYear(deathYear)}</div>
            {sheetConfig.showCauseOfDeath && <div className="detail"><strong>Cause of Death:</strong> {short(sim.causeOfDeath)}</div>}

            {sheetConfig.showNotes && <div className="detail detail-full"><strong>Notes:</strong> {short(sim.notes)}</div>}

            <div className="detail detail-full"><strong>Traits:</strong> {sim.traits && sim.traits.length > 0 ? (
              sim.traits.map((t) => (
                <span key={t} className="cell-tag" style={{ marginRight: '0.25rem' }}>
                  <span className="cell-tag-text">{t}</span>
                </span>
              ))
            ) : '—'}</div>

          </div>
        </div>
      )}
    </div>
  );
}
