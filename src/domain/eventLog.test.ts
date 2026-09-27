import { describe, expect, it } from "vitest";
import {
  appendEvent,
  appendRejectedSuggestionEvent,
  compactEventLog,
  createEmptyLog,
  getEventsBetween,
  linkChangesToEvent,
  readEventLog,
} from "./eventLog.js";

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

describe("Zeitstempel — readEventLog sortiert immer nach Zeit, getEventsBetween liefert einen Zeitraum", () => {
  it("readEventLog liefert Ereignisse in zeitlicher Reihenfolge, auch wenn sie unsortiert geschrieben wurden", () => {
    let log = createEmptyLog();
    ({ log } = appendEvent(log, { id: "spät", time: 20, participants: ["a"], payload: {} }));
    ({ log } = appendEvent(log, { id: "früh", time: 5, participants: ["b"], payload: {} }));
    const entries = readEventLog(log, 10);
    expect(entries.map((e) => e.time)).toEqual([5, 20]);
  });

  it("zwei Ereignisse mit bekanntem Abstand werden in der richtigen Reihenfolge zurückgegeben", () => {
    let log = createEmptyLog();
    ({ log } = appendEvent(log, { id: "ev2", time: 100, participants: ["b"], payload: { label: "zweites" } }));
    ({ log } = appendEvent(log, { id: "ev1", time: 10, participants: ["a"], payload: { label: "erstes" } }));
    const entries = getEventsBetween(log, 0, 1000);
    expect(entries.map((e) => e.type)).toEqual(["erstes", "zweites"]);
    expect(entries[1].time - entries[0].time).toBe(90);
  });

  it("getEventsBetween grenzt auf den angegebenen Zeitraum ein (inklusive Rändern)", () => {
    let log = createEmptyLog();
    ({ log } = appendEvent(log, { id: "ev1", time: 5, participants: [], payload: {} }));
    ({ log } = appendEvent(log, { id: "ev2", time: 10, participants: [], payload: {} }));
    ({ log } = appendEvent(log, { id: "ev3", time: 15, participants: [], payload: {} }));
    expect(getEventsBetween(log, 5, 10).map((e) => e.time)).toEqual([5, 10]);
    expect(getEventsBetween(log, 6, 14).map((e) => e.time)).toEqual([10]);
    expect(getEventsBetween(log, 100, 200).map((e) => e.time)).toEqual([]);
  });
});

describe("compactEventLog — Verdichtung ohne Datenverlust", () => {
  function seedOldAndNewEvents() {
    let log = createEmptyLog();
    ({ log } = appendEvent(log, { id: "old1", time: 1, participants: ["plant"], payload: { label: "Pflanze berührt" } }));
    ({ log } = appendEvent(log, { id: "old2", time: 2, participants: ["cat"], payload: { label: "Katze berührt" } }));
    ({ log } = appendEvent(log, { id: "new1", time: 100, participants: ["bed"], payload: { label: "Bett berührt" } }));
    return log;
  }

  it("fasst alte Ereignisse zu einem Summary zusammen, ohne die Originale zu löschen", () => {
    let log = seedOldAndNewEvents();
    log = compactEventLog(log, { id: "sum1", olderThan: 50, at: 200 });

    // Originalereignisse bleiben vollständig im Log — nur markiert.
    expect(log.events.map((e) => e.id)).toEqual(["old1", "old2", "new1", "sum1"]);
    expect(log.events.find((e) => e.id === "old1")?.compacted).toBe(true);
    expect(log.events.find((e) => e.id === "old2")?.compacted).toBe(true);
    expect(log.events.find((e) => e.id === "new1")?.compacted).toBeFalsy();
  });

  it("die Originalereignisse sind über includeCompacted weiterhin lesbar", () => {
    let log = seedOldAndNewEvents();
    log = compactEventLog(log, { id: "sum1", olderThan: 50, at: 200 });
    const withCompacted = readEventLog(log, 10, { includeCompacted: true });
    expect(withCompacted.map((e) => e.type)).toEqual(["Pflanze berührt", "Katze berührt", "Bett berührt", "event_summary"]);
  });

  it("die Summary enthält die richtigen Fakten: beteiligte Objekte, Ereignistypen, Zeitraum", () => {
    let log = seedOldAndNewEvents();
    log = compactEventLog(log, { id: "sum1", olderThan: 50, at: 200 });
    const summary = readEventLog(log, 10).find((e) => e.type === "event_summary");
    expect(summary).toBeDefined();
    expect(summary!.participants).toEqual(["plant", "cat"]);
    expect(summary!.detail).toContain("2 Ereignis(se)");
    expect(summary!.detail).toContain("zwischen 1 und 2");
    expect(summary!.detail).toContain("Pflanze berührt");
    expect(summary!.detail).toContain("Katze berührt");
  });

  it("readEventLog liefert standardmäßig nur nicht-verdichtete Ereignisse plus Summaries", () => {
    let log = seedOldAndNewEvents();
    log = compactEventLog(log, { id: "sum1", olderThan: 50, at: 200 });
    const entries = readEventLog(log, 10);
    expect(entries.map((e) => e.type)).toEqual(["Bett berührt", "event_summary"]);
  });

  it("ohne betroffene Ereignisse ist die Verdichtung ein No-op", () => {
    const log = seedOldAndNewEvents();
    const result = compactEventLog(log, { id: "sum1", olderThan: 0, at: 200 });
    expect(result).toBe(log);
  });

  it("bereits verdichtete Ereignisse werden bei einem zweiten Durchlauf nicht erneut verdichtet", () => {
    let log = seedOldAndNewEvents();
    log = compactEventLog(log, { id: "sum1", olderThan: 50, at: 200 });
    const secondPass = compactEventLog(log, { id: "sum2", olderThan: 50, at: 300 });
    expect(secondPass).toBe(log);
  });
});
