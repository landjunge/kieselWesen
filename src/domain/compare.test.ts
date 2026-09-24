import { describe, expect, it } from "vitest";
import {
  applyAction,
  compareRuns,
  createInstances,
  replaySequence,
  type RunAction,
} from "./compare.js";
import { allRulesEnabled, demoEngineParams } from "./experimentEngine.js";
import { createEmptyLog } from "./eventLog.js";
import { createEmptyModel } from "./innerModel.js";
import type { RunState } from "./runSerialization.js";

function seedRun(runId: string): RunState {
  return {
    runId,
    seed: "seed-fix",
    createdAt: 0,
    restActive: false,
    model: createEmptyModel(),
    log: createEmptyLog(),
    engineConfig: { params: demoEngineParams, rulesEnabled: allRulesEnabled },
  };
}

const sequence: RunAction[] = [
  { kind: "single", nodeId: "katze" },
  { kind: "single", nodeId: "pflanze" },
  { kind: "pair", nodeA: "katze", nodeB: "pflanze" },
];

describe("Mehrfach-Kiesel-Vergleich", () => {
  it("zwei identische deterministische Läufe liefern denselben Endzustand", () => {
    const [instanceA, instanceB] = createInstances(seedRun("quelle"), ["run-a", "run-b"], 0);
    const finalA = replaySequence(instanceA, sequence, 10);
    const finalB = replaySequence(instanceB, sequence, 10);

    const comparison = compareRuns(finalA, finalB);
    expect(comparison.identical).toBe(true);
    expect(comparison.nodeDiffs).toHaveLength(0);
    expect(comparison.edgeDiffs).toHaveLength(0);
  });

  it("ein gezielt veränderter Input ist im Vergleich sichtbar", () => {
    const [instanceA, instanceB] = createInstances(seedRun("quelle"), ["run-a", "run-b"], 0);
    const finalA = replaySequence(instanceA, sequence, 10);
    // Abweichung: B bekommt eine zusätzliche Berührung von "katze".
    const finalB = applyAction(
      replaySequence(instanceB, sequence, 10),
      { kind: "single", nodeId: "katze" },
      99,
      "extra-touch",
    );

    const comparison = compareRuns(finalA, finalB);
    expect(comparison.identical).toBe(false);
    const katzeDiff = comparison.nodeDiffs.find((d) => d.nodeId === "katze");
    expect(katzeDiff?.delta).toBeCloseTo(demoEngineParams.activationBoostOnUse);
  });

  it("createInstances erzeugt unabhängige Kopien mit eigener runId und Branch-Herkunft", () => {
    const source = seedRun("quelle");
    const [instanceA, instanceB] = createInstances(source, ["run-a", "run-b"], 5);
    expect(instanceA.runId).toBe("run-a");
    expect(instanceB.runId).toBe("run-b");
    expect(instanceA.branchedFromRunId).toBe("quelle");
    expect(instanceA.seed).toBe(source.seed);
  });
});
