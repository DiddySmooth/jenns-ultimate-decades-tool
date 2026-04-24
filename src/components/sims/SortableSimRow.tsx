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
  relationshipLabels?: string[];
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
  relationshipLabels,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <button
            ref={setActivatorNodeRef}
            className="btn-icon drag-handle"
            {...attributes}
            {...listeners}
            title="Drag to reorder"
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.45, flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect y="1" width="14" height="2" rx="1"/><rect y="6" width="14" height="2" rx="1"/><rect y="11" width="14" height="2" rx="1"/></svg>
          </button>

          <button className="btn-icon expand-toggle" onClick={onToggleExpanded} title={expanded ? 'Collapse' : 'Expand'} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, flexShrink: 0 }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">{expanded ? <path d="M1 7l4-4 4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/> : <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>}</svg>
          </button>

          <button className="btn-icon" onClick={onEdit} title="Edit sim" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 1.5l2 2L4 11H2v-2L9.5 1.5z"/></svg>
          </button>
        </div>

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
        {sheetConfig.showTraits && (
          <div className="sim-cell traits-cell" title={(sim.traits ?? []).join(', ')}>
            {sim.traits && sim.traits.length > 0 ? (
              sim.traits.map((t) => (
                <span key={t} className="cell-tag">
                  <span className="cell-tag-text">{t}</span>
                </span>
              ))
            ) : (
              <span className="cell-placeholder">—</span>
            )}
          </div>
        )}

        <div className="sim-actions">
          <button className="btn-icon" onClick={onDelete} title="Remove sim" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, flexShrink: 0, color: 'inherit' }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,3 11,3"/><path d="M4.5 3V2a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1"/><path d="M3 3l.7 8h6.6L11 3"/></svg>
          </button>
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

            {relationshipLabels && relationshipLabels.length > 0 && (
              <div className="detail detail-full"><strong>Marriage / Partnership History:</strong> <div className="detail-chip-list">{relationshipLabels.map((label) => (
                <span key={label} className="cell-tag">
                  <span className="cell-tag-text">{label}</span>
                </span>
              ))}</div></div>
            )}

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
