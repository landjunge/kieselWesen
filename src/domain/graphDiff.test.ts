import { describe, expect, it } from "vitest";
import { diffGraphEdges } from "./graphDiff.js";
import { createEmptyModel, createNode, ensureEdge, useEdge } from "./innerModel.js";

function seedGraphA() {
  let state = createEmptyModel();
  state = createNode(state, { id: "n1", at: 0, position: { x: 0, y: 0, z: 0 } });
  state = createNode(state, { id: "n2", at: 0, position: { x: 1, y: 0, z: 0 } });
  state = createNode(state, { id: "n3", at: 0, position: { x: 2, y: 0, z: 0 } });
  state = ensureEdge(state, { id: "e1", at: 0, nodeA: "n1", nodeB: "n2" });
  state = useEdge(state, 0, "n1", "n2", 3);
  state = ensureEdge(state, { id: "e2", at: 0, nodeA: "n1", nodeB: "n3" });
  state = useEdge(state, 0, "n1", "n3", 2);
  return state;
}

function seedGraphB() {
  let state = createEmptyModel();
  state = createNode(state, { id: "n1", at: 0, position: { x: 0, y: 0, z: 0 } });
  state = createNode(state, { id: "n2", at: 0, position: { x: 1, y: 0, z: 0 } });
  state = createNode(state, { id: "n4", at: 0, position: { x: 3, y: 0, z: 0 } });
  // n1::n2 existiert in beiden, mit anderer Stärke.
  state = ensureEdge(state, { id: "e1", at: 0, nodeA: "n1", nodeB: "n2" });
  state = useEdge(state, 0, "n1", "n2", 7);
  // n1::n4 existiert nur in B.
  state = ensureEdge(state, { id: "e3", at: 0, nodeA: "n1", nodeB: "n4" });
  state = useEdge(state, 0, "n1", "n4", 4);
  return state;
}

describe("diffGraphEdges — zwei künstliche Graphen, Kanten nur in A / nur in B / in beiden", () => {
  it("klassifiziert Kanten korrekt in die drei Gruppen", () => {
    const diff = diffGraphEdges(seedGraphA(), seedGraphB());

    expect(diff.onlyInA).toEqual([{ edgeKey: "n1::n3", nodeA: "n1", nodeB: "n3", strength: 2 }]);
    expect(diff.onlyInB).toEqual([{ edgeKey: "n1::n4", nodeA: "n1", nodeB: "n4", strength: 4 }]);
    expect(diff.inBoth).toEqual([
      { edgeKey: "n1::n2", nodeA: "n1", nodeB: "n2", strengthA: 3, strengthB: 7, strengthDelta: 4 },
    ]);
  });

  it("zwei identische Graphen liefern keine onlyInA/onlyInB und delta 0", () => {
    const diff = diffGraphEdges(seedGraphA(), seedGraphA());
    expect(diff.onlyInA).toEqual([]);
    expect(diff.onlyInB).toEqual([]);
    expect(diff.inBoth.every((d) => d.strengthDelta === 0)).toBe(true);
  });

  it("zwei völlig getrennte Graphen liefern alle Kanten in onlyInA/onlyInB, nichts in inBoth", () => {
    let b = createEmptyModel();
    b = createNode(b, { id: "x", at: 0, position: { x: 0, y: 0, z: 0 } });
    b = createNode(b, { id: "y", at: 0, position: { x: 1, y: 0, z: 0 } });
    b = ensureEdge(b, { id: "e1", at: 0, nodeA: "x", nodeB: "y" });
    b = useEdge(b, 0, "x", "y", 1);

    const diff = diffGraphEdges(seedGraphA(), b);
    expect(diff.onlyInA.map((e) => e.edgeKey).sort()).toEqual(["n1::n2", "n1::n3"]);
    expect(diff.onlyInB.map((e) => e.edgeKey)).toEqual(["x::y"]);
    expect(diff.inBoth).toEqual([]);
  });
});
