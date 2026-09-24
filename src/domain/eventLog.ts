import type { EventLog, WorldEvent } from "./types.js";

export function createEmptyLog(): EventLog {
  return { events: [] };
}

/**
 * Append-only: returns a new log, never mutates the given one.
 * Ereignisse werden nicht nachträglich gelöscht oder umgeschrieben.
 */
export function appendEvent(
  log: EventLog,
  input: { id: string; time: number; participants: string[]; payload: unknown },
): { log: EventLog; event: WorldEvent } {
  const event: WorldEvent = {
    id: input.id,
    index: log.events.length,
    time: input.time,
    participants: input.participants,
    payload: input.payload,
    resultingChangeIds: [],
  };
  return { log: { events: [...log.events, event] }, event };
}

/**
 * Verknüpft nachträglich entstandene innere Veränderungen mit einem
 * bereits geloggten Ereignis, ohne das Ereignis selbst zu überschreiben.
 */
export function linkChangesToEvent(
  log: EventLog,
  eventId: string,
  changeIds: string[],
): EventLog {
  return {
    events: log.events.map((event) =>
      event.id === eventId
        ? { ...event, resultingChangeIds: [...event.resultingChangeIds, ...changeIds] }
        : event,
    ),
  };
}
