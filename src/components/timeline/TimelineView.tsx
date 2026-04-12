import { memo, useCallback, useState } from 'react';
import type { TimelineDay, TimelineEvent, TrackerConfig } from '../../types/tracker';
import { nanoid } from 'nanoid';

interface Props {
  timeline: TimelineDay[];
  config: TrackerConfig;
  currentDay: number;
  onMarkDay: (dayNumber: number) => void;
  onAddEvent: (dayNumber: number, event: TimelineEvent) => void;
  onUpdateCell: (dayNumber: number, field: 'deaths' | 'births' | string, value: string) => void;
  onAddCustomColumn: (label: string) => void;
}

function buildColumns(config: TrackerConfig) {
  const cols: { id: string; label: string; group?: string }[] = [];
  for (const ls of config.humanAging.lifeStages) cols.push({ id: ls.id, label: ls.name, group: 'Human' });
  for (const pet of config.pets) for (const ls of pet.lifeStages) cols.push({ id: ls.id, label: ls.name, group: pet.label });
  for (const col of config.customColumns ?? []) cols.push({ id: col.id, label: col.label, group: 'Custom' });
  return cols;
}

// ── Memoized row — only re-renders when its own day data changes ──
interface RowProps {
  day: TimelineDay;
  isCurrent: boolean;
  lifeStageCols: { id: string; label: string }[];
  editingField: string | null; // "deaths" | "births" | col.id
  cellDraft: string;
  onStartEdit: (field: string, current: string) => void;
  onDraftChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onMarkDay: () => void;
  addingEvent: boolean;
  eventDraft: string;
  onStartEvent: () => void;
  onEventDraftChange: (v: string) => void;
  onSubmitEvent: () => void;
  onCancelEvent: () => void;
}

const TimelineRow = memo(function TimelineRow({
  day, isCurrent, lifeStageCols,
  editingField, cellDraft,
  onStartEdit, onDraftChange, onCommit, onCancel,
  onMarkDay, addingEvent, eventDraft,
  onStartEvent, onEventDraftChange, onSubmitEvent, onCancelEvent,
}: RowProps) {
  const isPast = day.marked;
  const rowClass = `timeline-row${isPast ? ' past' : ''}${isCurrent ? ' current' : ''}`;

  return (
    <tr className={rowClass}>
      <td className="sticky-col col-day-of-week">
        {isCurrent && <span className="current-marker" />}
        {day.dayOfWeek.slice(0, 3)}
      </td>
      <td className="col-day-num clickable" onClick={onMarkDay} title={isPast ? 'Already passed' : 'Mark as passed'}>
        {day.dayNumber}
      </td>
      <td className="col-year">{day.year}</td>

      {/* Events */}
      <td className="col-events">
        {day.events.length > 0 && (
          <div className="cell-tags">
            {day.events.map((ev) => <span key={ev.id} className="cell-tag">{ev.description}</span>)}
          </div>
        )}
        {addingEvent ? (
          <div className="inline-edit">
            <input
              autoFocus
              type="text"
              placeholder="Describe event…"
              value={eventDraft}
              onChange={(e) => onEventDraftChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSubmitEvent(); if (e.key === 'Escape') onCancelEvent(); }}
              onBlur={onSubmitEvent}
            />
          </div>
        ) : (
          <button className="cell-add-btn" onClick={onStartEvent} title="Add event">+</button>
        )}
      </td>

      {/* Deaths */}
      <EditableCell
        value={day.deaths || ''}
        isEditing={editingField === 'deaths'}
        draft={editingField === 'deaths' ? cellDraft : ''}
        onStartEdit={() => onStartEdit('deaths', day.deaths || '')}
        onDraftChange={onDraftChange}
        onCommit={onCommit}
        onCancel={onCancel}
      />

      {/* Births */}
      <EditableCell
        value={day.births || ''}
        isEditing={editingField === 'births'}
        draft={editingField === 'births' ? cellDraft : ''}
        onStartEdit={() => onStartEdit('births', day.births || '')}
        onDraftChange={onDraftChange}
        onCommit={onCommit}
        onCancel={onCancel}
      />

      {/* Life stage columns */}
      {lifeStageCols.map((col) => (
        <EditableCell
          key={col.id}
          value={day.lifeStageCells?.[col.id] || ''}
          isEditing={editingField === col.id}
          draft={editingField === col.id ? cellDraft : ''}
          onStartEdit={() => onStartEdit(col.id, day.lifeStageCells?.[col.id] || '')}
          onDraftChange={onDraftChange}
          onCommit={onCommit}
          onCancel={onCancel}
        />
      ))}
    </tr>
  );
});

interface EditableCellProps {
  value: string;
  isEditing: boolean;
  draft: string;
  onStartEdit: () => void;
  onDraftChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

function EditableCell({ value, isEditing, draft, onStartEdit, onDraftChange, onCommit, onCancel }: EditableCellProps) {
  if (isEditing) {
    return (
      <td className="editable-cell editing">
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel(); }}
          onBlur={onCommit}
        />
      </td>
    );
  }
  return (
    <td className={`editable-cell${value ? ' has-value' : ''}`} onClick={onStartEdit}>
      {value || <span className="cell-placeholder">—</span>}
    </td>
  );
}

// ── Main component — manages editing state only, rows are memoized ──
export default function TimelineView({ timeline, config, currentDay, onMarkDay, onAddEvent, onUpdateCell, onAddCustomColumn }: Props) {
  // Only ONE cell can be editing at a time — stored here, not per-row
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [cellDraft, setCellDraft] = useState('');
  const [addingEventDay, setAddingEventDay] = useState<number | null>(null);
  const [eventDraft, setEventDraft] = useState('');
  const [addColMode, setAddColMode] = useState(false);
  const [newColLabel, setNewColLabel] = useState('');

  const lifeStageCols = buildColumns(config);

  const startEdit = useCallback((dayNumber: number, field: string, current: string) => {
    setEditingDay(dayNumber);
    setEditingField(field);
    setCellDraft(current);
  }, []);

  const commit = useCallback(() => {
    if (editingDay == null || editingField == null) return;
    onUpdateCell(editingDay, editingField, cellDraft);
    setEditingDay(null);
    setEditingField(null);
  }, [editingDay, editingField, cellDraft, onUpdateCell]);

  const cancel = useCallback(() => { setEditingDay(null); setEditingField(null); }, []);

  const submitEvent = useCallback((dayNumber: number) => {
    if (!eventDraft.trim()) { setAddingEventDay(null); return; }
    onAddEvent(dayNumber, { id: nanoid(), dayNumber, type: 'custom', description: eventDraft.trim() });
    setAddingEventDay(null);
    setEventDraft('');
  }, [eventDraft, onAddEvent]);

  const submitNewCol = () => {
    if (!newColLabel.trim()) return;
    onAddCustomColumn(newColLabel.trim());
    setNewColLabel('');
    setAddColMode(false);
  };

  return (
    <div className="timeline-view">
      <div className="timeline-toolbar">
        <span className="timeline-hint">Click any cell to edit · Click Day # to mark passed</span>
        <button className="btn-secondary btn-sm" onClick={() => setAddColMode(true)}>+ Add Column</button>
      </div>

      {addColMode && (
        <div className="add-col-bar">
          <input
            autoFocus type="text"
            placeholder="Column name (e.g. Vampire Fledgling)"
            value={newColLabel}
            onChange={(e) => setNewColLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitNewCol(); if (e.key === 'Escape') setAddColMode(false); }}
          />
          <button className="btn-primary btn-sm" onClick={submitNewCol}>Add</button>
          <button className="btn-ghost btn-sm" onClick={() => setAddColMode(false)}>Cancel</button>
        </div>
      )}

      <div className="timeline-scroll-wrapper">
        <table className="timeline-table">
          <thead>
            <tr>
              <th className="sticky-col col-day-of-week">Day</th>
              <th className="col-day-num">Day #</th>
              <th className="col-year">Year</th>
              <th className="col-events">Events</th>
              <th className="col-deaths">Deaths</th>
              <th className="col-births">Births</th>
              {lifeStageCols.map((col) => (
                <th key={col.id} className="col-lifestage" title={col.group}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeline.map((day) => (
              <TimelineRow
                key={day.dayNumber}
                day={day}
                isCurrent={day.dayNumber === currentDay}
                lifeStageCols={lifeStageCols}
                editingField={editingDay === day.dayNumber ? editingField : null}
                cellDraft={cellDraft}
                onStartEdit={(field, current) => startEdit(day.dayNumber, field, current)}
                onDraftChange={setCellDraft}
                onCommit={commit}
                onCancel={cancel}
                onMarkDay={() => onMarkDay(day.dayNumber)}
                addingEvent={addingEventDay === day.dayNumber}
                eventDraft={eventDraft}
                onStartEvent={() => setAddingEventDay(day.dayNumber)}
                onEventDraftChange={setEventDraft}
                onSubmitEvent={() => submitEvent(day.dayNumber)}
                onCancelEvent={() => setAddingEventDay(null)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
