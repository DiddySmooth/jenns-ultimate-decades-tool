import { memo, useCallback, useState } from 'react';
import type { TimelineDay, TimelineEvent, TrackerConfig } from '../../types/tracker';
import { nanoid } from 'nanoid';

interface Props {
  timeline: TimelineDay[];
  config: TrackerConfig;
  currentDay: number;
  onMarkDay: (dayNumber: number) => void;
  onAddEvent: (dayNumber: number, event: TimelineEvent) => void;
  onUpdateCell: (dayNumber: number, field: string, value: string) => void;
  onAddCustomColumn: (label: string) => void;
}

function buildColumns(config: TrackerConfig) {
  const cols: { id: string; label: string }[] = [];
  for (const ls of config.humanAging.lifeStages) cols.push({ id: ls.id, label: ls.name });
  for (const pet of config.pets) for (const ls of pet.lifeStages) cols.push({ id: ls.id, label: ls.name });
  for (const col of config.customColumns ?? []) cols.push({ id: col.id, label: col.label });
  return cols;
}

// ── Editable cell — owns its own display value locally ──
// Writes to parent only on commit, shows value instantly without parent re-render
interface CellProps {
  initialValue: string;
  onCommit: (value: string) => void;
}

const EditableCell = memo(function EditableCell({ initialValue, onCommit }: CellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [displayed, setDisplayed] = useState(initialValue);

  const startEdit = () => {
    setDraft(displayed);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    setDisplayed(draft);
    onCommit(draft);
  };

  const cancel = () => {
    setEditing(false);
    setDraft('');
  };

  if (editing) {
    return (
      <td className="editable-cell editing">
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
          onBlur={commit}
        />
      </td>
    );
  }

  return (
    <td className={`editable-cell${displayed ? ' has-value' : ''}`} onClick={startEdit}>
      {displayed || <span className="cell-placeholder">—</span>}
    </td>
  );
});

// ── Memoized row ──
interface RowProps {
  day: TimelineDay;
  isCurrent: boolean;
  lifeStageCols: { id: string; label: string }[];
  onUpdateCell: (dayNumber: number, field: string, value: string) => void;
  onMarkDay: () => void;
  onAddEvent: (dayNumber: number, event: TimelineEvent) => void;
}

const TimelineRow = memo(function TimelineRow({ day, isCurrent, lifeStageCols, onUpdateCell, onMarkDay, onAddEvent }: RowProps) {
  const [addingEvent, setAddingEvent] = useState(false);
  const [eventDraft, setEventDraft] = useState('');

  const submitEvent = () => {
    if (!eventDraft.trim()) { setAddingEvent(false); return; }
    onAddEvent(day.dayNumber, { id: nanoid(), dayNumber: day.dayNumber, type: 'custom', description: eventDraft.trim() });
    setAddingEvent(false);
    setEventDraft('');
  };

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
              autoFocus type="text"
              placeholder="Describe event…"
              value={eventDraft}
              onChange={(e) => setEventDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitEvent(); if (e.key === 'Escape') setAddingEvent(false); }}
              onBlur={submitEvent}
            />
          </div>
        ) : (
          <button className="cell-add-btn" onClick={() => setAddingEvent(true)}>+</button>
        )}
      </td>

      <EditableCell
        initialValue={day.deaths || ''}
        onCommit={(v) => onUpdateCell(day.dayNumber, 'deaths', v)}
      />
      <EditableCell
        initialValue={day.births || ''}
        onCommit={(v) => onUpdateCell(day.dayNumber, 'births', v)}
      />
      {lifeStageCols.map((col) => (
        <EditableCell
          key={col.id}
          initialValue={day.lifeStageCells?.[col.id] || ''}
          onCommit={(v) => onUpdateCell(day.dayNumber, col.id, v)}
        />
      ))}
    </tr>
  );
});

// ── Main component ──
export default function TimelineView({ timeline, config, currentDay, onMarkDay, onAddEvent, onUpdateCell, onAddCustomColumn }: Props) {
  const [addColMode, setAddColMode] = useState(false);
  const [newColLabel, setNewColLabel] = useState('');
  const lifeStageCols = buildColumns(config);

  const submitNewCol = () => {
    if (!newColLabel.trim()) return;
    onAddCustomColumn(newColLabel.trim());
    setNewColLabel('');
    setAddColMode(false);
  };

  const handleAddEvent = useCallback((dayNumber: number, event: TimelineEvent) => {
    onAddEvent(dayNumber, event);
  }, [onAddEvent]);

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
                <th key={col.id} className="col-lifestage">{col.label}</th>
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
                onUpdateCell={onUpdateCell}
                onMarkDay={() => onMarkDay(day.dayNumber)}
                onAddEvent={handleAddEvent}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
