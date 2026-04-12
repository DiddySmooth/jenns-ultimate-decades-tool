import type { TimelineDay, TimelineEvent, TimelineEventType } from '../../types/tracker';
import { nanoid } from 'nanoid';
import { useState } from 'react';

interface Props {
  timeline: TimelineDay[];
  currentDay: number;
  onMarkDay: (dayNumber: number) => void;
  onAddEvent: (dayNumber: number, event: TimelineEvent) => void;
}

const EVENT_TYPE_LABELS: Record<TimelineEventType, string> = {
  birthday: '🎂',
  death: '✝',
  wedding: '💍',
  event: '📌',
  custom: '•',
};

export default function TimelineView({ timeline, currentDay, onMarkDay, onAddEvent }: Props) {
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [newEventType, setNewEventType] = useState<TimelineEventType>('event');
  const [newEventDesc, setNewEventDesc] = useState('');

  const submitEvent = (dayNumber: number) => {
    if (!newEventDesc.trim()) return;
    onAddEvent(dayNumber, {
      id: nanoid(),
      dayNumber,
      type: newEventType,
      description: newEventDesc.trim(),
    });
    setAddingTo(null);
    setNewEventDesc('');
  };

  // Group by year available for future use
  // const years = Array.from(new Set(timeline.map((d) => d.year)));

  return (
    <div className="timeline-view">
      <div className="timeline-scroll-wrapper">
        <table className="timeline-table">
          <thead>
            <tr>
              <th className="sticky-col">Day</th>
              <th>Day of Week</th>
              <th>Year</th>
              <th>Events</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {timeline.map((day) => {
              const isPast = day.marked;
              const isCurrent = day.dayNumber === currentDay;
              return (
                <tr
                  key={day.dayNumber}
                  className={`timeline-row${isPast ? ' past' : ''}${isCurrent ? ' current' : ''}`}
                >
                  <td className="sticky-col day-num">
                    {isCurrent && <span className="current-marker" />}
                    {day.dayNumber}
                  </td>
                  <td>{day.dayOfWeek}</td>
                  <td>{day.year}</td>
                  <td className="events-cell">
                    {day.events.map((ev) => (
                      <span key={ev.id} className={`event-badge event-${ev.type}`} title={ev.description}>
                        {EVENT_TYPE_LABELS[ev.type]} {ev.description}
                      </span>
                    ))}
                    {addingTo === day.dayNumber && (
                      <div className="add-event-inline">
                        <select
                          value={newEventType}
                          onChange={(e) => setNewEventType(e.target.value as TimelineEventType)}
                        >
                          {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v} {k}</option>
                          ))}
                        </select>
                        <input
                          autoFocus
                          type="text"
                          placeholder="Description…"
                          value={newEventDesc}
                          onChange={(e) => setNewEventDesc(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitEvent(day.dayNumber);
                            if (e.key === 'Escape') setAddingTo(null);
                          }}
                        />
                        <button className="btn-primary btn-sm" onClick={() => submitEvent(day.dayNumber)}>Add</button>
                        <button className="btn-ghost btn-sm" onClick={() => setAddingTo(null)}>Cancel</button>
                      </div>
                    )}
                  </td>
                  <td className="actions-cell">
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => setAddingTo(day.dayNumber === addingTo ? null : day.dayNumber)}
                      title="Add event"
                    >+</button>
                    {!isPast && (
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => onMarkDay(day.dayNumber)}
                        title="Mark as passed"
                      >✓</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
