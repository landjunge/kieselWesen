import { createEmptyModel, createNode, ensureEdge, useEdge } from "./innerModel.js";
import type { InnerModelState } from "./types.js";

/**
 * Export/Import des aktuellen Graphen in ein austauschbares Format (Punkt
 * 5) — getrennt von runSerialization.ts (das die vollständige interne
 * Historie für spätere Wiederherstellung in KieselWesen selbst sichert).
 * Dieser Export ist bewusst schlanker: nur Knoten und Kanten mit Stärke
 * und Herkunftsangaben (welche zwei Knoten eine Kante verbindet) —
 * geeignet, um den Graphen in einem anderen Werkzeug zu betrachten oder
 * ihn hier wieder einzulesen.
 */

export type GraphExportFormat = "json" | "graphml";

interface ExportedNode {
  id: string;
}

interface ExportedEdge {
  id: string;
  nodeA: string;
  nodeB: string;
  strength: number;
}

interface ExportedGraph {
  nodes: ExportedNode[];
  edges: ExportedEdge[];
}

function toExportedGraph(model: InnerModelState): ExportedGraph {
  return {
    nodes: [...model.nodes.keys()].map((id) => ({ id })),
    edges: [...model.edges.values()].map((edge) => ({ id: edge.id, nodeA: edge.nodeA, nodeB: edge.nodeB, strength: edge.strength })),
  };
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function unescapeXml(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
}

function toGraphml(graph: ExportedGraph): string {
  const nodesXml = graph.nodes.map((node) => `    <node id="${escapeXml(node.id)}"/>`).join("\n");
  const edgesXml = graph.edges
    .map(
      (edge) =>
        `    <edge id="${escapeXml(edge.id)}" source="${escapeXml(edge.nodeA)}" target="${escapeXml(edge.nodeB)}">\n` +
        `      <data key="strength">${edge.strength}</data>\n` +
        `    </edge>`,
    )
    .join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<graphml>\n` +
    `  <graph id="kieselwesen" edgedefault="undirected">\n` +
    `${nodesXml}\n${edgesXml}\n` +
    `  </graph>\n` +
    `</graphml>\n`
  );
}

function fromGraphml(text: string): ExportedGraph {
  const nodes = [...text.matchAll(/<node id="([^"]*)"\s*\/>/g)].map((match) => ({ id: unescapeXml(match[1]) }));
  const edges = [...text.matchAll(/<edge id="([^"]*)" source="([^"]*)" target="([^"]*)">([\s\S]*?)<\/edge>/g)].map((match) => {
    const [, id, source, target, body] = match;
    const strengthMatch = body.match(/<data key="strength">([^<]*)<\/data>/);
    return {
      id: unescapeXml(id),
      nodeA: unescapeXml(source),
      nodeB: unescapeXml(target),
      strength: strengthMatch ? Number(strengthMatch[1]) : 0,
    };
  });
  return { nodes, edges };
}

/**
 * Exportiert den aktuellen Graphen. Unterstützt JSON und GraphML — beide
 * enthalten alle Kanten mit ihrer Stärke und ihren Herkunftsangaben
 * (welche zwei Knoten sie verbindet).
 */
export function exportGraph(model: InnerModelState, format: GraphExportFormat): string {
  const graph = toExportedGraph(model);
  if (format === "json") return JSON.stringify(graph, null, 2);
  return toGraphml(graph);
}

/**
 * Liest einen zuvor mit exportGraph erzeugten Graphen wieder ein. Ergibt
 * denselben Graphen (gleiche Knoten, gleiche Kanten mit gleicher Stärke) —
 * nicht notwendigerweise dieselbe interne Historie/Nutzungszählung, die
 * gehört zu runSerialization.ts, nicht zu diesem schlanken Austauschformat.
 */
export function importGraph(text: string, format: GraphExportFormat): InnerModelState {
  const graph: ExportedGraph = format === "json" ? (JSON.parse(text) as ExportedGraph) : fromGraphml(text);

  let state = createEmptyModel();
  for (const node of graph.nodes) {
    state = createNode(state, { id: node.id, at: 0, position: { x: 0, y: 0, z: 0 } });
  }
  for (const edge of graph.edges) {
    state = ensureEdge(state, { id: edge.id, at: 0, nodeA: edge.nodeA, nodeB: edge.nodeB });
    if (edge.strength !== 0) {
      state = useEdge(state, 0, edge.nodeA, edge.nodeB, edge.strength);
    }
  }
  return state;
}
