import { describe, expect, it } from "vitest";
import { appendEvent, appendRejectedSuggestionEvent, createEmptyLog, linkChangesToEvent, readEventLog } from "./eventLog.js";

describe("Ereignislog", () => {
  it("bleibt vollständig und in Reihenfolge", () => {
    let log = createEmptyLog();
    ({ log } = appendEvent(log, { id: "ev1", time: 0, participants: ["katze"], payload: {} }));
    ({ log } = appendEvent(log, { id: "ev2", time: 1, participants: ["pflanze"], payload: {} }));
    expect(log.events.map((e) => e.id)).toEqual(["ev1", "ev2"]);
    expect(log.events.map((e) => e.index)).toEqual([0, 1]);
  });

  it("verändert frühere Ereignisse nicht rückwirkend, nur verknüpfte Änderungen", () => {
    let log = createEmptyLog();
    const first = appendEvent(log, { id: "ev1", time: 0, participants: [], payload: null });
    log = first.log;
    log = linkChangesToEvent(log, "ev1", ["node:n1"]);
    expect(log.events[0].id).toBe("ev1");
    expect(log.events[0].resultingChangeIds).toEqual(["node:n1"]);
  });
});

describe("readEventLog — einzige erlaubte Kontextquelle für ein LLM, nie der Graph", () => {
  it("liefert nur Zeitstempel, Typ und Beteiligte, keine Kanten-/Graph-Felder", () => {
    let log = createEmptyLog();
    ({ log } = appendEvent(log, { id: "ev1", time: 10, participants: ["plant"], payload: { label: "Pflanze berührt" } }));
    const entries = readEventLog(log, 10);
    expect(entries).toEqual([{ time: 10, type: "Pflanze berührt", participants: ["plant"] }]);
    // Keine der bekannten Graph-/Kanten-Feldnamen darf im Eintrag auftauchen.
    const keys = Object.keys(entries[0]);
    expect(keys).not.toContain("strength");
    expect(keys).not.toContain("usage");
    expect(keys).not.toContain("edges");
  });

  it("beschränkt sich auf die letzten `limit` Ereignisse", () => {
    let log = createEmptyLog();
    for (let i = 0; i < 5; i += 1) {
      ({ log } = appendEvent(log, { id: `ev${i}`, time: i, participants: [`n${i}`], payload: {} }));
    }
    const entries = readEventLog(log, 2);
    expect(entries.map((e) => e.time)).toEqual([3, 4]);
  });

  it("ein Ereignis ohne Beteiligte (z.B. Ruhephase) wird als 'ruhe' typisiert, wenn kein label vorliegt", () => {
    let log = createEmptyLog();
    ({ log } = appendEvent(log, { id: "ev1", time: 0, participants: [], payload: null }));
    expect(readEventLog(log, 1)).toEqual([{ time: 0, type: "ruhe", participants: [] }]);
  });
});

describe("appendRejectedSuggestionEvent — abgelehnte Vorschläge bleiben im Log sichtbar, statt gelöscht zu werden", () => {
  it("schreibt einen 'rejected_suggestion'-Eintrag mit Vorschlagstext, den readEventLog mitliefert", () => {
    let log = createEmptyLog();
    log = appendRejectedSuggestionEvent(log, {
      id: "rej1",
      time: 5,
      suggestionText: "Vielleicht folgt die Katze.",
    });
    expect(readEventLog(log, 10)).toEqual([
      { time: 5, type: "rejected_suggestion", participants: [], detail: "Vielleicht folgt die Katze." },
    ]);
  });

  it("hängt eine optionale Begründung an den Vorschlagstext an", () => {
    let log = createEmptyLog();
    log = appendRejectedSuggestionEvent(log, {
      id: "rej1",
      time: 5,
      suggestionText: "Vielleicht folgt die Katze.",
      reason: "kein bekannter Ort in der Antwort",
    });
    const [entry] = readEventLog(log, 10);
    expect(entry.detail).toBe("Vielleicht folgt die Katze. (Grund: kein bekannter Ort in der Antwort)");
  });

  it("ein abgelehnter Vorschlag bleibt Teil der vollständigen Log-Historie (nicht gelöscht)", () => {
    let log = createEmptyLog();
    ({ log } = appendEvent(log, { id: "ev1", time: 0, participants: ["plant"], payload: { label: "Pflanze berührt" } }));
    log = appendRejectedSuggestionEvent(log, { id: "rej1", time: 1, suggestionText: "Idee X" });
    expect(log.events.map((e) => e.id)).toEqual(["ev1", "rej1"]);
    expect(readEventLog(log, 10).map((e) => e.type)).toEqual(["Pflanze berührt", "rejected_suggestion"]);
  });
});
