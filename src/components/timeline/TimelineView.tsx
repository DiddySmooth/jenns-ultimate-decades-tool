import { memo, useState } from 'react';
import type { TimelineDay, TimelineEvent, TrackerConfig } from '../../types/tracker';
import { nanoid } from 'nanoid';

interface Props {
  timeline: TimelineDay[];
  config: TrackerConfig;
  currentDay: number;
  onMarkDay: (dayNumber: number) => void;
  onNextDay: () => void;
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
const COL_EVENTS = 240;
const COL_DEATHS = 160;
// Births column removed (tracked via Newborn/Baby life stage column)
// const COL_BIRTHS = 120;
const COL_LIFESTAGE = 140;
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
const TimelineRow = memo(function TimelineRow({ day, isCurrent, isActive, yearSpan, isYearStart, lifeStageCols, onMarkDay, onUpdateCell, onAddEvent, onActivate }: {
  day: TimelineDay;
  isCurrent: boolean;
  isActive: boolean;
  yearSpan: number;
  isYearStart: boolean;
  lifeStageCols: { id: string; label: string }[];
  onMarkDay: () => void;
  onUpdateCell: (field: string, value: string) => void;
  onAddEvent: (event: TimelineEvent) => void;
  onActivate: () => void;
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
    <div
      className={`vt-row${isPast ? ' past' : ''}${isCurrent ? ' current' : ''}${isActive ? ' active' : ''}`}
      style={{ height: ROW_HEIGHT }}
      onMouseDown={onActivate}
    >
      <div className="vt-cell vt-sticky-day" style={{ width: COL_DAY_OF_WEEK, minWidth: COL_DAY_OF_WEEK }}>
        {isCurrent && <span className="current-marker" />}
        {day.dayOfWeek.slice(0, 3)}
      </div>
      <div
        className="vt-cell vt-sticky-daynum"
        style={{ width: COL_DAY_NUM, minWidth: COL_DAY_NUM }}
        onClick={onMarkDay}
        title={isPast ? 'Click to undo to this day' : 'Click to mark passed up to this day'}
      >
        {day.dayNumber}
      </div>
      <div
        className={`vt-cell vt-sticky-year vt-year-cell${isYearStart ? ' vt-year-start' : ' vt-year-placeholder'}`}
        style={{ width: COL_YEAR, minWidth: COL_YEAR }}
      >
        {isYearStart && (
          <div className="vt-year-merged" style={{ height: yearSpan * ROW_HEIGHT }}>
            <span>{day.year}</span>
          </div>
        )}
      </div>
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
      {lifeStageCols.map((col) => (
        <EditableCell key={col.id} width={COL_LIFESTAGE} initialValue={day.lifeStageCells?.[col.id] || ''} onCommit={(v) => onUpdateCell(col.id, v)} />
      ))}
    </div>
  );
});

export default function TimelineView({ timeline, config, currentDay, onMarkDay, onNextDay, onAddEvent, onUpdateCell, onAddCustomColumn }: Props) {
  const [addColMode, setAddColMode] = useState(false);
  const [newColLabel, setNewColLabel] = useState('');
  const [activeRow, setActiveRow] = useState<number | null>(null);
  const lifeStageCols = buildColumns(config);

  const submitNewCol = () => {
    if (!newColLabel.trim()) return;
    onAddCustomColumn(newColLabel.trim());
    setNewColLabel('');
    setAddColMode(false);
  };

  const totalWidth = COL_DAY_OF_WEEK + COL_DAY_NUM + COL_YEAR + COL_EVENTS + COL_DEATHS + lifeStageCols.length * COL_LIFESTAGE;

  // Precompute year block spans for merged year cell
  const yearSpans: number[] = new Array(timeline.length).fill(1);
  const yearStarts: boolean[] = new Array(timeline.length).fill(false);
  let i = 0;
  while (i < timeline.length) {
    const y = timeline[i]?.year;
    let j = i;
    while (j < timeline.length && timeline[j]?.year === y) j++;
    const span = j - i;
    yearStarts[i] = true;
    yearSpans[i] = span;
    // Other rows in the block get placeholder
    for (let k = i + 1; k < j; k++) {
      yearStarts[k] = false;
      yearSpans[k] = 0;
    }
    i = j;
  }

  return (
    <div className="timeline-view">
      <div className="timeline-toolbar">
        <span className="timeline-hint">Click any cell to edit · Click Day # to change current day</span>
        <div className="timeline-actions">
          <button className="btn-secondary btn-sm" onClick={onNextDay} title="Complete current day and advance">
            Next Day →
          </button>
          <button className="btn-secondary btn-sm" onClick={() => setAddColMode(true)}>+ Add Column</button>
        </div>
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

      <div className="vt-wrapper vt-hscroll">
        <div className="vt-inner" style={{ width: totalWidth }}>
          {/* Sticky header */}
          <div className="vt-header">
            <div className="vt-head-cell vt-head-sticky-day" style={{ width: COL_DAY_OF_WEEK }}>Day</div>
            <div className="vt-head-cell vt-head-sticky-daynum" style={{ width: COL_DAY_NUM }}>Day #</div>
            <div className="vt-head-cell vt-head-sticky-year" style={{ width: COL_YEAR }}>Year</div>
            <div className="vt-head-cell" style={{ width: COL_EVENTS }}>Events</div>
            <div className="vt-head-cell" style={{ width: COL_DEATHS }}>Deaths</div>
            {lifeStageCols.map((col) => (
              <div key={col.id} className="vt-head-cell" style={{ width: COL_LIFESTAGE }}>{col.label}</div>
            ))}
          </div>

          {/* Scrollable body */}
          <div className="vt-body">
            {timeline.map((day, idx) => (
              <TimelineRow
                key={day.dayNumber}
                day={day}
                isCurrent={day.dayNumber === currentDay}
                isActive={activeRow === day.dayNumber}
                yearSpan={yearSpans[idx]}
                isYearStart={yearStarts[idx]}
                lifeStageCols={lifeStageCols}
                onMarkDay={() => onMarkDay(day.dayNumber)}
                onUpdateCell={(field, value) => onUpdateCell(day.dayNumber, field, value)}
                onAddEvent={(event) => onAddEvent(day.dayNumber, event)}
                onActivate={() => setActiveRow(day.dayNumber)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
