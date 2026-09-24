import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { allRulesEnabled, demoEngineParams } from "./experimentEngine.js";
import { createEmptyLog } from "./eventLog.js";
import { createEmptyModel, createNode, ensureEdge } from "./innerModel.js";
import {
  createSnapshot,
  listRunIds,
  loadRun,
  loadSnapshot,
  saveRun,
} from "./persistence.js";
import { branchFromSnapshot, type RunState } from "./runSerialization.js";

function seedRun(runId: string): RunState {
  let model = createEmptyModel();
  model = createNode(model, { id: "n1", at: 0, position: { x: 0, y: 0, z: 0 } });
  model = createNode(model, { id: "n2", at: 0, position: { x: 1, y: 0, z: 0 } });
  model = ensureEdge(model, { id: "e1", at: 0, nodeA: "n1", nodeB: "n2" });
  return {
    runId,
    seed: "seed-123",
    createdAt: 0,
    restActive: false,
    model,
    log: createEmptyLog(),
    engineConfig: { params: demoEngineParams, rulesEnabled: allRulesEnabled },
  };
}

describe("Persistenz", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "kieselwesen-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("App-Neustart verliert nichts: speichern und laden liefert denselben Zustand", async () => {
    const run = seedRun("run-a");
    await saveRun(dir, run);
    const loaded = await loadRun(dir, "run-a");
    expect(loaded.model.nodes.get("n1")).toEqual(run.model.nodes.get("n1"));
    expect(loaded.model.edges.get("n1::n2")).toEqual(run.model.edges.get("n1::n2"));
    expect(loaded.seed).toBe("seed-123");
  });

  it("listet vorhandene Läufe auf, leeres Verzeichnis liefert leere Liste", async () => {
    expect(await listRunIds(dir)).toEqual([]);
    await saveRun(dir, seedRun("run-a"));
    await saveRun(dir, seedRun("run-b"));
    expect((await listRunIds(dir)).sort()).toEqual(["run-a", "run-b"]);
  });

  it("Snapshot ist reproduzierbar und wird nicht stillschweigend überschrieben", async () => {
    const run = seedRun("run-a");
    await createSnapshot(dir, run, "s1");
    const loaded = await loadSnapshot(dir, "run-a", "s1");
    expect(loaded.model.nodes.size).toBe(2);
    await expect(createSnapshot(dir, run, "s1")).rejects.toThrow(/already exists/);
  });

  it("Branch aus Snapshot ist eine neue Abzweigung, nicht das Überschreiben der Historie", async () => {
    const run = seedRun("run-a");
    await createSnapshot(dir, run, "s1");
    const snapshot = await loadSnapshot(dir, "run-a", "s1");
    const branch = branchFromSnapshot(snapshot, "run-b", 5);
    expect(branch.runId).toBe("run-b");
    expect(branch.branchedFromRunId).toBe("run-a");
    expect(branch.model.nodes.size).toBe(2);

    await saveRun(dir, run);
    await saveRun(dir, branch);
    expect((await listRunIds(dir)).sort()).toEqual(["run-a", "run-b"]);
    const originalReloaded = await loadRun(dir, "run-a");
    expect(originalReloaded.model.nodes.size).toBe(2);
  });
});
