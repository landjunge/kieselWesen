import { describe, expect, it } from "vitest";
import { allRulesEnabled, demoEngineParams } from "./experimentEngine.js";
import { appendEvent, createEmptyLog } from "./eventLog.js";
import { createEmptyModel, createNode, ensureEdge, useEdge } from "./innerModel.js";
import type { RunState } from "./runSerialization.js";
import { normalizeNodePositions, toUiPayload } from "./uiAdapter.js";
import { seedInitialRoom } from "./worldObjects.js";

function seedRun(): RunState {
  let model = createEmptyModel();
  model = createNode(model, { id: "n1", at: 0, position: { x: 0, y: 0, z: 0 } });
  model = createNode(model, { id: "n2", at: 0, position: { x: 10, y: 4, z: 0 } });
  model = ensureEdge(model, { id: "e1", at: 0, nodeA: "n1", nodeB: "n2" });
  model = useEdge(model, 1, "n1", "n2", 3);

  let log = createEmptyLog();
  ({ log } = appendEvent(log, { id: "ev1", time: 0, participants: ["katze", "kieselwesen"], payload: { label: "Katze berührt" } }));

  return {
    runId: "run-a",
    seed: "seed-1",
    createdAt: 0,
    restActive: false,
    model,
    log,
    engineConfig: { params: demoEngineParams, rulesEnabled: allRulesEnabled },
  };
}

describe("normalizeNodePositions", () => {
  it("normiert auf [0,1] relativ zur Bounding Box", () => {
    const positions = normalizeNodePositions([
      { id: "a", createdAt: 0, position: { x: 0, y: 0, z: 0 }, activation: 0, sourceEventIds: [], positionHistory: [], activationHistory: [] },
      { id: "b", createdAt: 0, position: { x: 10, y: 4, z: 0 }, activation: 0, sourceEventIds: [], positionHistory: [], activationHistory: [] },
    ]);
    expect(positions.get("a")).toEqual({ x: 0, y: 0 });
    expect(positions.get("b")).toEqual({ x: 1, y: 1 });
  });

  it("setzt einzelnen Knoten mittig, wenn keine Ausdehnung vorhanden ist", () => {
    const positions = normalizeNodePositions([
      { id: "a", createdAt: 0, position: { x: 5, y: 5, z: 5 }, activation: 0, sourceEventIds: [], positionHistory: [], activationHistory: [] },
    ]);
    expect(positions.get("a")).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe("toUiPayload", () => {
  it("erzeugt exakt das von KieselWesenUI.update erwartete Format", () => {
    const payload = toUiPayload(seedRun());
    expect(payload.nodes).toHaveLength(2);
    for (const node of payload.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(1);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(1);
      expect(node.activation).toBeGreaterThanOrEqual(0);
      expect(node.activation).toBeLessThanOrEqual(1);
    }
    expect(payload.edges).toEqual([{ source: "n1", target: "n2", weight: 1 }]);
    expect(payload.event).toBe("Katze berührt");
    expect(payload.history).toEqual([{ label: "Katze berührt" }]);
    expect(payload.status).toBe("aktiv");
  });

  it("normiert Knotenaktivierung getrennt von Kantenstärke", () => {
    let model = createEmptyModel();
    model = createNode(model, { id: "n1", at: 0, position: { x: 0, y: 0, z: 0 }, activation: 0.4 });
    model = createNode(model, { id: "n2", at: 0, position: { x: 1, y: 0, z: 0 }, activation: 0.8 });
    const run: RunState = { ...seedRun(), model, log: createEmptyLog() };
    const payload = toUiPayload(run);
    const n1 = payload.nodes.find((n) => n.id === "n1");
    const n2 = payload.nodes.find((n) => n.id === "n2");
    expect(n1?.activation).toBeCloseTo(0.5);
    expect(n2?.activation).toBeCloseTo(1);
  });

  it("liefert Position nur, wenn ein KieselWesen-Weltobjekt existiert", () => {
    const withoutWorld = toUiPayload(seedRun());
    expect(withoutWorld.position).toBeUndefined();

    const world = seedInitialRoom();
    const withWorld = toUiPayload(seedRun(), world);
    expect(withWorld.position).toEqual(world.objects.get("kieselwesen")?.position);
    expect(Number.isInteger(withWorld.position!.x)).toBe(true);
    expect(withWorld.position!.x).toBeGreaterThanOrEqual(0);
    expect(withWorld.position!.x).toBeLessThan(64);
  });

  it("meldet Ruhephase über status, keine erfundenen Werte", () => {
    const run = { ...seedRun(), restActive: true };
    const payload = toUiPayload(run);
    expect(payload.status).toBe("ruhephase");
  });
});
