import { describe, expect, it } from "vitest";
import { exportGraph, importGraph } from "./graphExport.js";
import { createEmptyModel, createNode, ensureEdge, useEdge } from "./innerModel.js";

function seedGraph() {
  let state = createEmptyModel();
  state = createNode(state, { id: "plant", at: 0, position: { x: 0, y: 0, z: 0 } });
  state = createNode(state, { id: "cat", at: 0, position: { x: 1, y: 0, z: 0 } });
  state = createNode(state, { id: "bed", at: 0, position: { x: 2, y: 0, z: 0 } });
  state = ensureEdge(state, { id: "e1", at: 0, nodeA: "plant", nodeB: "cat" });
  state = useEdge(state, 0, "plant", "cat", 3.5);
  state = ensureEdge(state, { id: "e2", at: 0, nodeA: "cat", nodeB: "bed" });
  state = useEdge(state, 0, "cat", "bed", 1);
  return state;
}

function edgesSummary(model: ReturnType<typeof seedGraph>) {
  return [...model.edges.entries()]
    .map(([key, edge]) => ({ key, nodeA: edge.nodeA, nodeB: edge.nodeB, strength: edge.strength }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

describe("exportGraph/importGraph — ein exportierter Graph ergibt beim Wiedereinlesen denselben Graphen", () => {
  it("JSON: gleiche Knoten und Kanten (mit Stärke und Herkunft) nach Export + Import", () => {
    const original = seedGraph();
    const json = exportGraph(original, "json");
    expect(() => JSON.parse(json)).not.toThrow();

    const restored = importGraph(json, "json");
    expect([...restored.nodes.keys()].sort()).toEqual([...original.nodes.keys()].sort());
    expect(edgesSummary(restored)).toEqual(edgesSummary(original));
  });

  it("GraphML: gleiche Knoten und Kanten (mit Stärke und Herkunft) nach Export + Import", () => {
    const original = seedGraph();
    const graphml = exportGraph(original, "graphml");
    expect(graphml).toContain("<graphml>");
    expect(graphml).toContain('source="plant"');

    const restored = importGraph(graphml, "graphml");
    expect([...restored.nodes.keys()].sort()).toEqual([...original.nodes.keys()].sort());
    expect(edgesSummary(restored)).toEqual(edgesSummary(original));
  });

  it("JSON-Export enthält für jede Kante Stärke und Herkunftsangaben (verbundene Knoten)", () => {
    const graph = JSON.parse(exportGraph(seedGraph(), "json"));
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nodeA: "plant", nodeB: "cat", strength: 3.5 }),
        expect.objectContaining({ nodeA: "cat", nodeB: "bed", strength: 1 }),
      ]),
    );
  });

  it("Knoten- und Kanten-IDs mit XML-Sonderzeichen überstehen den GraphML-Roundtrip", () => {
    let state = createEmptyModel();
    state = createNode(state, { id: 'a"b<c>d&e', at: 0, position: { x: 0, y: 0, z: 0 } });
    state = createNode(state, { id: "n2", at: 0, position: { x: 1, y: 0, z: 0 } });
    state = ensureEdge(state, { id: "e1", at: 0, nodeA: 'a"b<c>d&e', nodeB: "n2" });
    state = useEdge(state, 0, 'a"b<c>d&e', "n2", 2);

    const restored = importGraph(exportGraph(state, "graphml"), "graphml");
    expect([...restored.nodes.keys()].sort()).toEqual(['a"b<c>d&e', "n2"].sort());
    expect(edgesSummary(restored)).toEqual(edgesSummary(state));
  });
});
