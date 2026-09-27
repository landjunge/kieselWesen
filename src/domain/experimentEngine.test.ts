import { describe, expect, it } from "vitest";
import { createEmptyModel, createNode, ensureEdge, useEdge } from "./innerModel.js";
import {
  allRulesEnabled,
  applyEventEdgeFade,
  applyEventToPair,
  applyEventToSingleNode,
  demoEngineParams,
  runRestStep,
  type EngineConfig,
} from "./experimentEngine.js";

function seedState() {
  let state = createEmptyModel();
  state = createNode(state, { id: "n1", at: 0, position: { x: 0, y: 0, z: 0 } });
  state = createNode(state, { id: "n2", at: 0, position: { x: 1, y: 0, z: 0 } });
  state = ensureEdge(state, { id: "e1", at: 0, nodeA: "n1", nodeB: "n2" });
  return state;
}

const config: EngineConfig = { params: demoEngineParams, rulesEnabled: allRulesEnabled };

describe("Versuchsmotor — Einzelknoten-Ereignis", () => {
  it("erhöht nur die Aktivierung des berührten Knotens, keine Kante", () => {
    const state = seedState();
    const result = applyEventToSingleNode(state, config, 1, "ev1", "n1");
    expect(result.state.nodes.get("n1")?.activation).toBeCloseTo(demoEngineParams.activationBoostOnUse);
    expect(result.state.edges.get("n1::n2")?.strength).toBe(0);
    expect(result.changes).toEqual([{ at: 1, rule: "activationOnUse", targetKind: "node", targetId: "n1", eventId: "ev1" }]);
  });

  it("wirkt nicht auf unbekannte Knoten oder bei ausgeschalteter Regel", () => {
    const state = seedState();
    expect(applyEventToSingleNode(state, config, 1, "ev1", "unbekannt").changes).toHaveLength(0);
    const off: EngineConfig = { params: demoEngineParams, rulesEnabled: { ...allRulesEnabled, activationOnUse: false } };
    expect(applyEventToSingleNode(state, off, 1, "ev1", "n1").changes).toHaveLength(0);
  });
});

describe("Versuchsmotor — Ereigniswirkung", () => {
  it("erhöht Aktivierung und Kantenstärke, verknüpft Änderung mit Event-ID", () => {
    const state = seedState();
    const result = applyEventToPair(state, config, 1, "ev1", "n1", "n2");
    expect(result.state.nodes.get("n1")?.activation).toBeCloseTo(demoEngineParams.activationBoostOnUse);
    expect(result.state.edges.get("n1::n2")?.strength).toBe(demoEngineParams.edgeStrengthGainOnUse);
    expect(result.changes.every((c) => c.eventId === "ev1")).toBe(true);
  });

  it("wirkt nicht, wenn die jeweilige Regel deaktiviert ist", () => {
    const state = seedState();
    const off: EngineConfig = {
      params: demoEngineParams,
      rulesEnabled: { activationOnUse: false, edgeStrengthOnUse: false, restDecay: false, edgeFadeOnEvent: false },
    };
    const result = applyEventToPair(state, off, 1, "ev1", "n1", "n2");
    expect(result.state.nodes.get("n1")?.activation).toBe(0);
    expect(result.state.edges.get("n1::n2")?.strength).toBe(0);
    expect(result.changes).toHaveLength(0);
  });
});

describe("Versuchsmotor — Ruheschritt", () => {
  it("löscht bei Ruhe nie Knoten oder Verbindungen, nur Werte sinken", () => {
    let state = seedState();
    state = applyEventToPair(state, config, 1, "ev1", "n1", "n2").state;
    const result = runRestStep(state, config, 2);
    expect(result.state.nodes.size).toBe(2);
    expect(result.state.edges.size).toBe(1);
    expect(result.state.nodes.get("n1")!.activation).toBeLessThan(state.nodes.get("n1")!.activation);
  });

  it("verändert bei ausgeschalteter Regel die Struktur nicht heimlich", () => {
    const state = seedState();
    const off: EngineConfig = { params: demoEngineParams, rulesEnabled: { ...allRulesEnabled, restDecay: false } };
    const result = runRestStep(state, off, 2);
    expect(result.state).toBe(state);
    expect(result.changes).toHaveLength(0);
  });
});

describe("Versuchsmotor — Kanten-Verblassen ist an Ereignisse gekoppelt, nicht an feste Zeit", () => {
  function seedTwoEdges() {
    let state = createEmptyModel();
    state = createNode(state, { id: "n1", at: 0, position: { x: 0, y: 0, z: 0 } });
    state = createNode(state, { id: "n2", at: 0, position: { x: 1, y: 0, z: 0 } });
    state = createNode(state, { id: "n3", at: 0, position: { x: 2, y: 0, z: 0 } });
    state = ensureEdge(state, { id: "e1", at: 0, nodeA: "n1", nodeB: "n2" });
    state = useEdge(state, 0, "n1", "n2", 5);
    state = ensureEdge(state, { id: "e2", at: 0, nodeA: "n2", nodeB: "n3" });
    state = useEdge(state, 0, "n2", "n3", 5);
    return state;
  }

  it("eine von einem Ereignis berührte Kante verblasst; eine unberührte Kante bleibt stabil", () => {
    const state = seedTwoEdges();
    // Ereignis betrifft n1 und n2 — Kante n1::n2 ist berührt (ein Endpunkt
    // reicht schon), Kante n2::n3 ist ebenfalls berührt (Endpunkt n2), aber
    // eine völlig unbeteiligte Kante bliebe unverändert.
    const result = applyEventEdgeFade(state, config, 1, "ev1", ["n1", "n2"]);
    expect(result.state.edges.get("n1::n2")!.strength).toBe(5 - demoEngineParams.edgeFadeOnEvent);
    // n2::n3 teilt sich Knoten n2 mit dem Ereignis und ist damit "berührt".
    expect(result.state.edges.get("n2::n3")!.strength).toBe(5 - demoEngineParams.edgeFadeOnEvent);
  });

  it("eine Kante ohne gemeinsamen Knoten mit dem Ereignis bleibt exakt stabil", () => {
    let state = seedTwoEdges();
    state = createNode(state, { id: "n4", at: 0, position: { x: 3, y: 0, z: 0 } });
    state = createNode(state, { id: "n5", at: 0, position: { x: 4, y: 0, z: 0 } });
    state = ensureEdge(state, { id: "e3", at: 0, nodeA: "n4", nodeB: "n5" });
    state = useEdge(state, 0, "n4", "n5", 5);

    const result = applyEventEdgeFade(state, config, 1, "ev1", ["n1", "n2"]);
    expect(result.state.edges.get("n4::n5")!.strength).toBe(5);
    expect(result.changes.some((c) => c.targetId === "n4::n5")).toBe(false);
  });

  it("wirkt nicht, wenn die Regel deaktiviert ist", () => {
    const state = seedTwoEdges();
    const off: EngineConfig = { params: demoEngineParams, rulesEnabled: { ...allRulesEnabled, edgeFadeOnEvent: false } };
    const result = applyEventEdgeFade(state, off, 1, "ev1", ["n1", "n2"]);
    expect(result.state).toBe(state);
    expect(result.changes).toHaveLength(0);
  });

  it("Ruheschritte allein lassen Kanten unverändert — kein zeitbasiertes Verblassen mehr", () => {
    const state = seedTwoEdges();
    const afterRest = runRestStep(state, config, 5);
    expect(afterRest.state.edges.get("n1::n2")!.strength).toBe(5);
    expect(afterRest.state.edges.get("n2::n3")!.strength).toBe(5);
  });
});

describe("Versuchsmotor — Determinismus", () => {
  it("gleicher Start + gleiche Ereignisfolge + gleiche Parameter erzeugen dasselbe Ergebnis", () => {
    function runSequence() {
      let state = seedState();
      state = applyEventToPair(state, config, 1, "ev1", "n1", "n2").state;
      state = runRestStep(state, config, 2).state;
      state = applyEventToPair(state, config, 3, "ev2", "n1", "n2").state;
      return state;
    }
    const a = runSequence();
    const b = runSequence();
    expect(a.nodes.get("n1")).toEqual(b.nodes.get("n1"));
    expect(a.edges.get("n1::n2")).toEqual(b.edges.get("n1::n2"));
  });
});
