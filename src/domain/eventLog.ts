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

/**
 * Liefert die letzten `limit` Ereignisse aus dem Log, reine Ereignisdaten
 * ohne jeden Zugriff auf Kanten, Stärken oder den inneren Graphen. Das ist
 * bewusst die einzige Schnittstelle, über die ein LLM Kontext bekommen darf
 * (siehe llmSuggestions.ts) — der Graph bleibt davon komplett getrennt.
 * Enthält auch "rejected_suggestion"-Einträge (siehe appendRejectedSuggestionEvent)
 * — so sieht ein LLM, was es schon versucht hat, statt dieselbe Idee erneut
 * vorzuschlagen.
 */
export function readEventLog(log: EventLog, limit: number): EventLogEntry[] {
  return log.events.slice(-limit).map((event) => {
    const detail = payloadField(event.payload, "detail");
    return {
      time: event.time,
      type: eventType(event),
      participants: event.participants,
      ...(detail !== undefined ? { detail } : {}),
    };
  });
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
