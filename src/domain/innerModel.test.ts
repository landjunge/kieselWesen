import { describe, expect, it } from "vitest";
import {
  createEmptyModel,
  createNode,
  distanceBetween,
  ensureEdge,
  fadeEdge,
  moveNode,
  reachability,
  setActivation,
  useEdge,
} from "./innerModel.js";

function seedTwoNodes() {
  let state = createEmptyModel();
  state = createNode(state, { id: "n1", at: 0, position: { x: 0, y: 0, z: 0 } });
  state = createNode(state, { id: "n2", at: 0, position: { x: 3, y: 0, z: 0 } });
  state = ensureEdge(state, { id: "e1", at: 0, nodeA: "n1", nodeB: "n2" });
  return state;
}

describe("Knoten", () => {
  it("bleibt nach Bewegung erhalten (kein Löschen)", () => {
    let state = seedTwoNodes();
    state = moveNode(state, "n1", 1, { x: 5, y: 5, z: 5 });
    expect(state.nodes.size).toBe(2);
    expect(state.nodes.get("n1")?.position).toEqual({ x: 5, y: 5, z: 5 });
  });

  it("Aktivierung ist unabhängig von Distanz und Nutzung", () => {
    let state = seedTwoNodes();
    state = setActivation(state, "n1", 1, 0.8);
    const distanceBefore = distanceBetween(state, "n1", "n2");
    state = useEdge(state, 2, "n1", "n2");
    state = moveNode(state, "n2", 3, { x: 9, y: 0, z: 0 });
    expect(state.nodes.get("n1")?.activation).toBe(0.8);
    expect(distanceBefore).toBe(3);
  });
});

describe("Verbindungen", () => {
  it("wird durch Distanzänderung nicht genutzt/verstärkt", () => {
    let state = seedTwoNodes();
    const usageBefore = state.edges.get("n1::n2")?.usage;
    state = moveNode(state, "n2", 1, { x: 100, y: 0, z: 0 });
    expect(state.edges.get("n1::n2")?.usage).toBe(usageBefore);
  });

  it("wird durch Verblassen nie gelöscht, nur schwächer bis minimal 0", () => {
    let state = seedTwoNodes();
    state = useEdge(state, 1, "n1", "n2", 5);
    state = fadeEdge(state, 2, "n1", "n2", 100);
    expect(state.edges.has("n1::n2")).toBe(true);
    expect(state.edges.get("n1::n2")?.strength).toBe(0);
  });

  it("Nutzung verändert nicht die Distanz ohne explizite Bewegungsregel", () => {
    let state = seedTwoNodes();
    const before = distanceBetween(state, "n1", "n2");
    state = useEdge(state, 1, "n1", "n2");
    state = useEdge(state, 2, "n1", "n2");
    expect(distanceBetween(state, "n1", "n2")).toBe(before);
  });
});

describe("Unbegrenzter Innenraum", () => {
  it("akzeptiert beliebig große und negative Positionen ohne künstliche Würfel-/Randbegrenzung", () => {
    let state = createEmptyModel();
    state = createNode(state, { id: "weit-weg", at: 0, position: { x: 1_000_000, y: -1_000_000, z: 999_999 } });
    state = moveNode(state, "weit-weg", 1, { x: -5_000_000, y: 5_000_000, z: -5_000_000 });
    expect(state.nodes.get("weit-weg")?.position).toEqual({ x: -5_000_000, y: 5_000_000, z: -5_000_000 });
  });
});

describe("Erreichbarkeit", () => {
  it("sinkt mit Distanz, wird aber nie 0", () => {
    let state = seedTwoNodes();
    const near = reachability(state, "n1", "n2");
    state = moveNode(state, "n2", 1, { x: 1000, y: 0, z: 0 });
    const far = reachability(state, "n1", "n2");
    expect(far).toBeLessThan(near);
    expect(far).toBeGreaterThan(0);
  });
});
