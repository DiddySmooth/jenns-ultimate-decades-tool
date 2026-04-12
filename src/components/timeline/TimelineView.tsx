import { useState } from 'react';
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

// Build column definitions from config
function buildColumns(config: TrackerConfig) {
  const cols: { id: string; label: string; group?: string }[] = [];

  // Human life stages
  for (const ls of config.humanAging.lifeStages) {
    cols.push({ id: ls.id, label: ls.name, group: 'Human' });
  }

  // Pet life stages
  for (const pet of config.pets) {
    for (const ls of pet.lifeStages) {
      cols.push({ id: ls.id, label: ls.name, group: pet.label });
    }
  }

  // Custom columns (occult overflows etc)
  for (const col of config.customColumns) {
    cols.push({ id: col.id, label: col.label, group: 'Custom' });
  }

  return cols;
}

interface EditingCell {
  dayNumber: number;
  field: string; // 'events' | 'deaths' | 'births' | lifestage id | custom col id
}

export default function TimelineView({ timeline, config, currentDay, onMarkDay, onUpdateCell, onAddEvent, onAddCustomColumn }: Props) {
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [cellDraft, setCellDraft] = useState('');
  const [addingEvent, setAddingEvent] = useState<number | null>(null);
  const [eventDraft, setEventDraft] = useState('');
  const [addColMode, setAddColMode] = useState(false);
  const [newColLabel, setNewColLabel] = useState('');

  const lifeStageCols = buildColumns(config);

  const startEdit = (dayNumber: number, field: string, current: string) => {
    setEditing({ dayNumber, field });
    setCellDraft(current);
  };

  const commitEdit = () => {
    if (!editing) return;
    onUpdateCell(editing.dayNumber, editing.field, cellDraft);
    setEditing(null);
  };

  const submitEvent = (dayNumber: number) => {
    if (!eventDraft.trim()) return;
    onAddEvent(dayNumber, {
      id: nanoid(),
      dayNumber,
      type: 'custom',
      description: eventDraft.trim(),
    });
    setAddingEvent(null);
    setEventDraft('');
  };

  const submitNewCol = () => {
    if (!newColLabel.trim()) return;
    onAddCustomColumn(newColLabel.trim());
    setNewColLabel('');
    setAddColMode(false);
  };

  return (
    <div className="timeline-view">
      <div className="timeline-toolbar">
        <span className="timeline-hint">Click any cell to edit. Click day # to mark as passed.</span>
        <button className="btn-secondary btn-sm" onClick={() => setAddColMode(true)}>
          + Add Column
        </button>
      </div>

      {addColMode && (
        <div className="add-col-bar">
          <input
            autoFocus
            type="text"
            placeholder="Column name (e.g. Vampire Fledgling)"
            value={newColLabel}
            onChange={(e) => setNewColLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNewCol();
              if (e.key === 'Escape') setAddColMode(false);
            }}
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
                <th key={col.id} className="col-lifestage" title={col.group}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeline.map((day) => {
              const isPast = day.marked;
              const isCurrent = day.dayNumber === currentDay;
              const rowClass = `timeline-row${isPast ? ' past' : ''}${isCurrent ? ' current' : ''}`;

              return (
                <tr key={day.dayNumber} className={rowClass}>
                  {/* Day of Week — sticky */}
                  <td className="sticky-col col-day-of-week">
                    {isCurrent && <span className="current-marker" />}
                    {day.dayOfWeek.slice(0, 3)}
                  </td>

                  {/* Day # — click to mark */}
                  <td
                    className="col-day-num clickable"
                    title={isPast ? 'Already passed' : 'Click to mark as passed'}
                    onClick={() => !isPast && onMarkDay(day.dayNumber)}
                  >
                    {day.dayNumber}
                  </td>

                  {/* Year */}
                  <td className="col-year">{day.year}</td>

                  {/* Events */}
                  <td className="col-events">
                    {day.events.length > 0 && (
                      <div className="cell-tags">
                        {day.events.map((ev) => (
                          <span key={ev.id} className="cell-tag">{ev.description}</span>
                        ))}
                      </div>
                    )}
                    {addingEvent === day.dayNumber ? (
                      <div className="inline-edit">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Describe event…"
                          value={eventDraft}
                          onChange={(e) => setEventDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitEvent(day.dayNumber);
                            if (e.key === 'Escape') setAddingEvent(null);
                          }}
                          onBlur={() => submitEvent(day.dayNumber)}
                        />
                      </div>
                    ) : (
                      <button
                        className="cell-add-btn"
                        onClick={() => setAddingEvent(day.dayNumber)}
                        title="Add event"
                      >+</button>
                    )}
                  </td>

                  {/* Deaths */}
                  <EditableCell
                    value={day.deaths || ''}
                    isEditing={editing?.dayNumber === day.dayNumber && editing?.field === 'deaths'}
                    draft={editing?.dayNumber === day.dayNumber && editing?.field === 'deaths' ? cellDraft : ''}
                    onStartEdit={() => startEdit(day.dayNumber, 'deaths', day.deaths || '')}
                    onDraftChange={setCellDraft}
                    onCommit={commitEdit}
                    onCancel={() => setEditing(null)}
                    placeholder="Name…"
                  />

                  {/* Births */}
                  <EditableCell
                    value={day.births || ''}
                    isEditing={editing?.dayNumber === day.dayNumber && editing?.field === 'births'}
                    draft={editing?.dayNumber === day.dayNumber && editing?.field === 'births' ? cellDraft : ''}
                    onStartEdit={() => startEdit(day.dayNumber, 'births', day.births || '')}
                    onDraftChange={setCellDraft}
                    onCommit={commitEdit}
                    onCancel={() => setEditing(null)}
                    placeholder="Name…"
                  />

                  {/* Life stage columns */}
                  {lifeStageCols.map((col) => (
                    <EditableCell
                      key={col.id}
                      value={day.lifeStageCells?.[col.id] || ''}
                      isEditing={editing?.dayNumber === day.dayNumber && editing?.field === col.id}
                      draft={editing?.dayNumber === day.dayNumber && editing?.field === col.id ? cellDraft : ''}
                      onStartEdit={() => startEdit(day.dayNumber, col.id, day.lifeStageCells?.[col.id] || '')}
                      onDraftChange={setCellDraft}
                      onCommit={commitEdit}
                      onCancel={() => setEditing(null)}
                      placeholder="Name…"
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface EditableCellProps {
  value: string;
  isEditing: boolean;
  draft: string;
  onStartEdit: () => void;
  onDraftChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  placeholder?: string;
}

function EditableCell({ value, isEditing, draft, onStartEdit, onDraftChange, onCommit, onCancel, placeholder }: EditableCellProps) {
  if (isEditing) {
    return (
      <td className="editable-cell editing">
        <input
          autoFocus
          type="text"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommit();
            if (e.key === 'Escape') onCancel();
          }}
          onBlur={onCommit}
        />
      </td>
    );
  }
  return (
    <td
      className={`editable-cell${value ? ' has-value' : ''}`}
      onClick={onStartEdit}
      title="Click to edit"
    >
      {value || <span className="cell-placeholder">—</span>}
    </td>
  );
}
