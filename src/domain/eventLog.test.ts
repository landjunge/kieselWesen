import { describe, expect, it } from "vitest";
import { appendEvent, createEmptyLog, linkChangesToEvent } from "./eventLog.js";

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
