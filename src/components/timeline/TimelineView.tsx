import { memo, useState } from 'react';
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

const COL_DAY_OF_WEEK = 56;
const COL_DAY_NUM = 60;
const COL_YEAR = 64;
const COL_EVENTS = 180;
const COL_DEATHS = 120;
const COL_BIRTHS = 120;
const COL_LIFESTAGE = 110;
const ROW_HEIGHT = 34;

// Each cell manages its own local state — never causes sibling or parent re-renders
const EditableCell = memo(function EditableCell({ initialValue, width, onCommit }: {
  initialValue: string; width: number; onCommit: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [shown, setShown] = useState(initialValue);

  if (editing) {
    return (
      <div className="vt-cell editing" style={{ width, minWidth: width }}>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { setEditing(false); setShown(draft); onCommit(draft); }
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={() => { setEditing(false); setShown(draft); onCommit(draft); }}
        />
      </div>
    );
  }
  return (
    <div className={`vt-cell${shown ? ' has-value' : ''}`} style={{ width, minWidth: width }}
      onClick={() => { setDraft(shown); setEditing(true); }}>
      {shown || <span className="cell-placeholder">—</span>}
    </div>
  );
});

// Row is memoized — only re-renders if its day object reference changes
const TimelineRow = memo(function TimelineRow({ day, isCurrent, lifeStageCols, onMarkDay, onUpdateCell, onAddEvent }: {
  day: TimelineDay;
  isCurrent: boolean;
  lifeStageCols: { id: string; label: string }[];
  onMarkDay: () => void;
  onUpdateCell: (field: string, value: string) => void;
  onAddEvent: (event: TimelineEvent) => void;
}) {
  const [addingEvent, setAddingEvent] = useState(false);
  const [eventDraft, setEventDraft] = useState('');

  const submitEvent = () => {
    if (eventDraft.trim()) onAddEvent({ id: nanoid(), dayNumber: day.dayNumber, type: 'custom', description: eventDraft.trim() });
    setAddingEvent(false);
    setEventDraft('');
  };

  const isPast = day.marked;
  return (
    <div className={`vt-row${isPast ? ' past' : ''}${isCurrent ? ' current' : ''}`} style={{ height: ROW_HEIGHT }}>
      <div className="vt-cell vt-sticky" style={{ width: COL_DAY_OF_WEEK, minWidth: COL_DAY_OF_WEEK }}>
        {isCurrent && <span className="current-marker" />}
        {day.dayOfWeek.slice(0, 3)}
      </div>
      <div className="vt-cell vt-daynum" style={{ width: COL_DAY_NUM, minWidth: COL_DAY_NUM }}
        onClick={() => !isPast && onMarkDay()}>
        {day.dayNumber}
      </div>
      <div className="vt-cell" style={{ width: COL_YEAR, minWidth: COL_YEAR }}>{day.year}</div>
      <div className="vt-cell vt-events" style={{ width: COL_EVENTS, minWidth: COL_EVENTS }}>
        {day.events.map((ev) => <span key={ev.id} className="cell-tag">{ev.description}</span>)}
        {addingEvent
          ? <input autoFocus className="event-input" placeholder="Event…" value={eventDraft}
              onChange={(e) => setEventDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitEvent(); if (e.key === 'Escape') setAddingEvent(false); }}
              onBlur={submitEvent} />
          : <button className="cell-add-btn" onClick={() => setAddingEvent(true)}>+</button>}
      </div>
      <EditableCell width={COL_DEATHS} initialValue={day.deaths || ''} onCommit={(v) => onUpdateCell('deaths', v)} />
      <EditableCell width={COL_BIRTHS} initialValue={day.births || ''} onCommit={(v) => onUpdateCell('births', v)} />
      {lifeStageCols.map((col) => (
        <EditableCell key={col.id} width={COL_LIFESTAGE} initialValue={day.lifeStageCells?.[col.id] || ''} onCommit={(v) => onUpdateCell(col.id, v)} />
      ))}
    </div>
  );
});

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

  const totalWidth = COL_DAY_OF_WEEK + COL_DAY_NUM + COL_YEAR + COL_EVENTS + COL_DEATHS + COL_BIRTHS + lifeStageCols.length * COL_LIFESTAGE;

  return (
    <div className="timeline-view">
      <div className="timeline-toolbar">
        <span className="timeline-hint">Click any cell to edit · Click Day # to mark passed</span>
        <button className="btn-secondary btn-sm" onClick={() => setAddColMode(true)}>+ Add Column</button>
      </div>

      {addColMode && (
        <div className="add-col-bar">
          <input autoFocus type="text" placeholder="Column name" value={newColLabel}
            onChange={(e) => setNewColLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitNewCol(); if (e.key === 'Escape') setAddColMode(false); }} />
          <button className="btn-primary btn-sm" onClick={submitNewCol}>Add</button>
          <button className="btn-ghost btn-sm" onClick={() => setAddColMode(false)}>Cancel</button>
        </div>
      )}

      <div className="vt-wrapper">
        {/* Sticky header */}
        <div className="vt-header" style={{ minWidth: totalWidth }}>
          <div className="vt-head-cell" style={{ width: COL_DAY_OF_WEEK }}>Day</div>
          <div className="vt-head-cell" style={{ width: COL_DAY_NUM }}>Day #</div>
          <div className="vt-head-cell" style={{ width: COL_YEAR }}>Year</div>
          <div className="vt-head-cell" style={{ width: COL_EVENTS }}>Events</div>
          <div className="vt-head-cell" style={{ width: COL_DEATHS }}>Deaths</div>
          <div className="vt-head-cell" style={{ width: COL_BIRTHS }}>Births</div>
          {lifeStageCols.map((col) => (
            <div key={col.id} className="vt-head-cell" style={{ width: COL_LIFESTAGE }}>{col.label}</div>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="vt-body">
          <div style={{ minWidth: totalWidth }}>
            {timeline.map((day) => (
              <TimelineRow
                key={day.dayNumber}
                day={day}
                isCurrent={day.dayNumber === currentDay}
                lifeStageCols={lifeStageCols}
                onMarkDay={() => onMarkDay(day.dayNumber)}
                onUpdateCell={(field, value) => onUpdateCell(day.dayNumber, field, value)}
                onAddEvent={(event) => onAddEvent(day.dayNumber, event)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
