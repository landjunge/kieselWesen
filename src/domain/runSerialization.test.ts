import { describe, expect, it } from "vitest";
import { allRulesEnabled, demoEngineParams } from "./experimentEngine.js";
import { appendEvent, createEmptyLog } from "./eventLog.js";
import { createEmptyModel, createNode, ensureEdge, useEdge } from "./innerModel.js";
import { createEmptyLearner, learnTransition, predictNext } from "./miniLearner.js";
import {
  branchFromSnapshot,
  deserializeRun,
  exportRunAsJson,
  getLearner,
  serializeRun,
  type RunState,
} from "./runSerialization.js";

function seedRun(runId: string): RunState {
  let model = createEmptyModel();
  model = createNode(model, { id: "n1", at: 0, position: { x: 0, y: 0, z: 0 } });
  model = createNode(model, { id: "n2", at: 0, position: { x: 1, y: 0, z: 0 } });
  model = ensureEdge(model, { id: "e1", at: 0, nodeA: "n1", nodeB: "n2" });
  model = useEdge(model, 1, "n1", "n2", 1);
  const { log } = appendEvent(createEmptyLog(), {
    id: "ev1",
    time: 1,
    participants: ["n1", "n2"],
    payload: { label: "Test berührt" },
  });
  return {
    runId,
    seed: "seed-123",
    createdAt: 0,
    restActive: false,
    model,
    log,
    engineConfig: { params: demoEngineParams, rulesEnabled: allRulesEnabled },
  };
}

describe("Lauf-Serialisierung — Export in ein lesbares/prüfbares Format (Phase 9)", () => {
  it("serializeRun/deserializeRun sind reine Umkehrfunktionen ohne Datenverlust", () => {
    const run = seedRun("run-a");
    const restored = deserializeRun(serializeRun(run));
    expect(restored.runId).toBe(run.runId);
    expect(restored.seed).toBe(run.seed);
    expect(restored.model.nodes.get("n1")).toEqual(run.model.nodes.get("n1"));
    expect(restored.model.edges.get("n1::n2")).toEqual(run.model.edges.get("n1::n2"));
    expect(restored.log).toEqual(run.log);
    expect(restored.engineConfig).toEqual(run.engineConfig);
  });

  it("exportRunAsJson liefert gültiges, formatiertes JSON", () => {
    const run = seedRun("run-a");
    const json = exportRunAsJson(run);
    expect(() => JSON.parse(json)).not.toThrow();
    // Lesbar formatiert (Einrückung), nicht einzeilig minifiziert.
    expect(json).toContain("\n");
  });

  it("Export enthält genug Informationen, um Lauf und Parameter später nachzuvollziehen", () => {
    const run = seedRun("run-a");
    const parsed = JSON.parse(exportRunAsJson(run));
    expect(parsed.runId).toBe("run-a");
    expect(parsed.seed).toBe("seed-123");
    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.edges).toHaveLength(1);
    expect(parsed.edges[0].strength).toBe(1);
    expect(parsed.log.events).toHaveLength(1);
    expect(parsed.engineConfig.params).toEqual(demoEngineParams);
    expect(parsed.engineConfig.rulesEnabled).toEqual(allRulesEnabled);
  });

  it("ein aus dem Export wiederhergestellter Lauf ist mit dem Original identisch", () => {
    const run = seedRun("run-a");
    const restored = deserializeRun(JSON.parse(exportRunAsJson(run)));
    expect(restored.model.nodes.get("n1")).toEqual(run.model.nodes.get("n1"));
    expect(restored.model.edges.get("n1::n2")).toEqual(run.model.edges.get("n1::n2"));
    expect(restored.log).toEqual(run.log);
  });

  it("branchFromSnapshot erzeugt eine neue Abzweigung, keine Überschreibung der Herkunft", () => {
    const snapshot = seedRun("run-a");
    const branch = branchFromSnapshot(snapshot, "run-b", 42);
    expect(branch.runId).toBe("run-b");
    expect(branch.branchedFromRunId).toBe("run-a");
    expect(branch.createdAt).toBe(42);
    expect(branch.model.nodes.size).toBe(2);
    // Ursprung bleibt unverändert.
    expect(snapshot.runId).toBe("run-a");
    expect(snapshot.branchedFromRunId).toBeUndefined();
  });

  it("branchFromSnapshot kann optional einen neuen Seed setzen, sonst bleibt der alte erhalten", () => {
    const snapshot = seedRun("run-a");
    const withSameSeed = branchFromSnapshot(snapshot, "run-b", 1);
    expect(withSameSeed.seed).toBe("seed-123");
    const withNewSeed = branchFromSnapshot(snapshot, "run-c", 1, "seed-456");
    expect(withNewSeed.seed).toBe("seed-456");
  });
});

describe("Lauf-Serialisierung — Mini-Lerner bleibt erhalten", () => {
  it("getLearner liefert einen leeren Lerner, wenn keiner gesetzt ist", () => {
    const run = seedRun("run-a");
    expect(getLearner(run)).toEqual(createEmptyLearner());
  });

  it("ein gesetzter Lerner übersteht Serialisierung/Export unverändert", () => {
    let run = seedRun("run-a");
    run = { ...run, learner: learnTransition(createEmptyLearner(), "n1", "n2") };

    const restored = deserializeRun(serializeRun(run));
    expect(predictNext(getLearner(restored), "n1")).toEqual(predictNext(getLearner(run), "n1"));

    const restoredFromExport = deserializeRun(JSON.parse(exportRunAsJson(run)));
    expect(predictNext(getLearner(restoredFromExport), "n1")).toEqual(predictNext(getLearner(run), "n1"));
  });
});
