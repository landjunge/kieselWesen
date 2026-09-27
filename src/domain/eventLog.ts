import type { EventLog, WorldEvent } from "./types.js";

/**
 * Ein einzelner Log-Eintrag, wie er nach außen (z.B. an ein LLM) gegeben
 * wird: Zeitstempel, ein grober Ereignistyp und die beteiligten Objekte —
 * absichtlich NICHT die Kanten/Stärken/den Graphen. Wer nur das hier sieht,
 * kann nichts über Kantenstärke oder Aktivierung wissen.
 */
export interface EventLogEntry {
  time: number;
  type: string;
  participants: readonly string[];
  /** Freitext-Zusatz, z.B. der abgelehnte Vorschlagstext bei "rejected_suggestion". */
  detail?: string;
}

function payloadField(payload: unknown, field: string): string | undefined {
  if (payload && typeof payload === "object" && field in payload) {
    const value = (payload as Record<string, unknown>)[field];
    if (typeof value === "string") return value;
  }
  return undefined;
}

function eventType(event: WorldEvent): string {
  return payloadField(event.payload, "type") ?? payloadField(event.payload, "label") ?? (event.participants.length === 0 ? "ruhe" : "berührung");
}

function toEntry(event: WorldEvent): EventLogEntry {
  const detail = payloadField(event.payload, "detail");
  return {
    time: event.time,
    type: eventType(event),
    participants: event.participants,
    ...(detail !== undefined ? { detail } : {}),
  };
}

export interface ReadEventLogOptions {
  /** Auch bereits verdichtete Originalereignisse mitliefern (Default: nein). */
  includeCompacted?: boolean;
}

/**
 * Liefert die letzten `limit` Ereignisse aus dem Log, reine Ereignisdaten
 * ohne jeden Zugriff auf Kanten, Stärken oder den inneren Graphen. Das ist
 * bewusst die einzige Schnittstelle, über die ein LLM Kontext bekommen darf
 * (siehe llmSuggestions.ts) — der Graph bleibt davon komplett getrennt.
 * Enthält auch "rejected_suggestion"-Einträge (siehe appendRejectedSuggestionEvent)
 * — so sieht ein LLM, was es schon versucht hat, statt dieselbe Idee erneut
 * vorzuschlagen. Sortiert immer nach Zeitstempel. Standardmäßig werden
 * bereits verdichtete Originalereignisse (siehe compactEventLog)
 * ausgeblendet — ihre Summary-Ereignisse bleiben aber immer sichtbar.
 */
export function readEventLog(log: EventLog, limit: number, options: ReadEventLogOptions = {}): EventLogEntry[] {
  const relevant = options.includeCompacted ? log.events : log.events.filter((event) => !event.compacted);
  const sorted = [...relevant].sort((a, b) => a.time - b.time);
  return sorted.slice(-limit).map(toEntry);
}

/**
 * Liefert alle (nicht verdichteten) Ereignisse in einem Zeitraum
 * [start, end], nach Zeitstempel sortiert. Jedes Ereignis trägt seinen
 * Zeitstempel bereits beim Schreiben (appendEvent verlangt `time`) — diese
 * Funktion garantiert nur zusätzlich die sortierte Auswahl über einen
 * Zeitraum, unabhängig von der Reihenfolge, in der Ereignisse geschrieben
 * wurden.
 */
export function getEventsBetween(log: EventLog, start: number, end: number): EventLogEntry[] {
  return log.events
    .filter((event) => !event.compacted && event.time >= start && event.time <= end)
    .sort((a, b) => a.time - b.time)
    .map(toEntry);
}

function isSummaryEvent(event: WorldEvent): boolean {
  return payloadField(event.payload, "type") === "event_summary";
}

/**
 * Verdichtung des Ereignisprotokolls (Punkt 3): alle nicht bereits
 * verdichteten, nicht selbst schon Summary-Ereignisse mit `time < olderThan`
 * werden zu EINEM neuen "event_summary"-Ereignis zusammengefasst, das die
 * wichtigsten Fakten als Freitext trägt (beteiligte Objekte, Ereignistypen,
 * Zeitraum). Die Originalereignisse werden dabei NICHT gelöscht — sie
 * bleiben im Log, bekommen aber `compacted: true`. Ohne betroffene
 * Ereignisse ist dies ein No-op (dasselbe Log wird zurückgegeben).
 */
export function compactEventLog(
  log: EventLog,
  input: { id: string; olderThan: number; at: number },
): EventLog {
  const toCompact = log.events.filter((event) => !event.compacted && !isSummaryEvent(event) && event.time < input.olderThan);
  if (toCompact.length === 0) return log;

  const participants = [...new Set(toCompact.flatMap((event) => event.participants))];
  const eventTypes = [...new Set(toCompact.map((event) => eventType(event)))];
  const times = toCompact.map((event) => event.time);
  const rangeStart = Math.min(...times);
  const rangeEnd = Math.max(...times);
  const detail =
    `${toCompact.length} Ereignis(se) zwischen ${rangeStart} und ${rangeEnd}; ` +
    `Typen: ${eventTypes.join(", ") || "keine"}; Beteiligte: ${participants.join(", ") || "keine"}`;

  const compactedIds = new Set(toCompact.map((event) => event.id));
  const events = log.events.map((event) => (compactedIds.has(event.id) ? { ...event, compacted: true } : event));

  return appendEvent(
    { events },
    { id: input.id, time: input.at, participants, payload: { type: "event_summary", detail } },
  ).log;
}

/**
 * Ein abgelehnter/verworfener LLM-Vorschlag wird nicht gelöscht, sondern als
 * eigene Ereignisart ("rejected_suggestion") ins Log geschrieben — mit
 * Zeitstempel, Vorschlagstext und optionaler Begründung. So bleibt er über
 * readEventLog sichtbar, und ein späterer LLM-Durchlauf kann sehen, was
 * schon abgelehnt wurde, statt dieselbe Idee zu wiederholen.
 */
export function appendRejectedSuggestionEvent(
  log: EventLog,
  input: { id: string; time: number; suggestionText: string; reason?: string },
): EventLog {
  const detail = input.reason ? `${input.suggestionText} (Grund: ${input.reason})` : input.suggestionText;
  return appendEvent(log, {
    id: input.id,
    time: input.time,
    participants: [],
    payload: { type: "rejected_suggestion", detail },
  }).log;
}

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
