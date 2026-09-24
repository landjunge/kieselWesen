import type { Edge, InnerModelState, InnerNode, Vec3 } from "./types.js";

export function createEmptyModel(): InnerModelState {
  return { nodes: new Map(), edges: new Map() };
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

export function createNode(
  state: InnerModelState,
  input: { id: string; at: number; position: Vec3; activation?: number; sourceEventId?: string },
): InnerModelState {
  const activation = input.activation ?? 0;
  const node: InnerNode = {
    id: input.id,
    createdAt: input.at,
    position: input.position,
    activation,
    sourceEventIds: input.sourceEventId ? [input.sourceEventId] : [],
    positionHistory: [{ at: input.at, position: input.position }],
    activationHistory: [{ at: input.at, activation }],
  };
  const nodes = new Map(state.nodes);
  nodes.set(node.id, node);
  return { ...state, nodes };
}

/**
 * Bewegt einen Knoten räumlich. Verändert bewusst keine Kanten-Nutzung —
 * Distanz und Nutzung sind getrennte Größen.
 */
export function moveNode(
  state: InnerModelState,
  nodeId: string,
  at: number,
  position: Vec3,
): InnerModelState {
  const node = state.nodes.get(nodeId);
  if (!node) throw new Error(`unknown node: ${nodeId}`);
  const updated: InnerNode = {
    ...node,
    position,
    positionHistory: [...node.positionHistory, { at, position }],
  };
  const nodes = new Map(state.nodes);
  nodes.set(nodeId, updated);
  return { ...state, nodes };
}

/**
 * Aktivierung ist eine eigene Größe, unabhängig von Distanz und Nutzung.
 */
export function setActivation(
  state: InnerModelState,
  nodeId: string,
  at: number,
  activation: number,
): InnerModelState {
  const node = state.nodes.get(nodeId);
  if (!node) throw new Error(`unknown node: ${nodeId}`);
  const updated: InnerNode = {
    ...node,
    activation,
    activationHistory: [...node.activationHistory, { at, activation }],
  };
  const nodes = new Map(state.nodes);
  nodes.set(nodeId, updated);
  return { ...state, nodes };
}

export function ensureEdge(
  state: InnerModelState,
  input: { id: string; at: number; nodeA: string; nodeB: string },
): InnerModelState {
  const key = edgeKey(input.nodeA, input.nodeB);
  if (state.edges.has(key)) return state;
  const edge: Edge = {
    id: input.id,
    nodeA: input.nodeA,
    nodeB: input.nodeB,
    usage: 0,
    strength: 0,
    usageHistory: [{ at: input.at, usage: 0 }],
    strengthHistory: [{ at: input.at, strength: 0 }],
  };
  const edges = new Map(state.edges);
  edges.set(key, edge);
  return { ...state, edges };
}

/**
 * Nutzung erhöht Nutzungswert und Stärke, verändert aber nie eine
 * Knotenposition oder Distanz.
 */
export function useEdge(
  state: InnerModelState,
  at: number,
  nodeA: string,
  nodeB: string,
  strengthDelta = 1,
): InnerModelState {
  const key = edgeKey(nodeA, nodeB);
  const edge = state.edges.get(key);
  if (!edge) throw new Error(`unknown edge between ${nodeA} and ${nodeB}`);
  const usage = edge.usage + 1;
  const strength = edge.strength + strengthDelta;
  const updated: Edge = {
    ...edge,
    usage,
    strength,
    usageHistory: [...edge.usageHistory, { at, usage }],
    strengthHistory: [...edge.strengthHistory, { at, strength }],
  };
  const edges = new Map(state.edges);
  edges.set(key, updated);
  return { ...state, edges };
}

/**
 * Verblassen bedeutet schwächer werden, nicht Löschen. Stärke hat eine
 * untere Grenze bei 0, die Kante selbst bleibt bestehen.
 */
export function fadeEdge(
  state: InnerModelState,
  at: number,
  nodeA: string,
  nodeB: string,
  amount: number,
): InnerModelState {
  const key = edgeKey(nodeA, nodeB);
  const edge = state.edges.get(key);
  if (!edge) throw new Error(`unknown edge between ${nodeA} and ${nodeB}`);
  const strength = Math.max(0, edge.strength - amount);
  const updated: Edge = {
    ...edge,
    strength,
    strengthHistory: [...edge.strengthHistory, { at, strength }],
  };
  const edges = new Map(state.edges);
  edges.set(key, updated);
  return { ...state, edges };
}

/**
 * Geometrische Distanz, abgeleitet aus den aktuellen Knotenpositionen.
 * Keine gespeicherte Größe — wird bei Bedarf berechnet.
 */
export function distanceBetween(state: InnerModelState, nodeA: string, nodeB: string): number {
  const a = state.nodes.get(nodeA);
  const b = state.nodes.get(nodeB);
  if (!a || !b) throw new Error(`unknown node pair: ${nodeA}, ${nodeB}`);
  const dx = a.position.x - b.position.x;
  const dy = a.position.y - b.position.y;
  const dz = a.position.z - b.position.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Erreichbarkeit sinkt mit steigender Distanz, wird aber nie 0 —
 * ein Knoten ist nie durch reine Länge "nicht existent".
 */
export function reachability(state: InnerModelState, nodeA: string, nodeB: string): number {
  const distance = distanceBetween(state, nodeA, nodeB);
  return 1 / (1 + distance);
}
