import type { RunState } from "./persistence.js";
import type { Edge, InnerNode } from "./types.js";
import type { WorldState } from "./worldObjects.js";

/**
 * Exakt das Format, das die UI-Schnittstelle aus PR #2 erwartet:
 * window.KieselWesenUI.update({status, event, state, nodes, edges, history, position})
 * nodes: [{id, label, x, y}], x/y in [0, 1]; edges: [{source, target, weight}]
 * position: {x, y}, ganzzahlige Raumkoordinaten in [0, 63].
 */
export interface UiPayload {
  status: string;
  event: string;
  state: Record<string, string>;
  nodes: { id: string; label: string; x: number; y: number }[];
  edges: { source: string; target: string; weight: number }[];
  history: { label: string }[];
  position?: { x: number; y: number };
}

/**
 * Normiert Knotenpositionen aus dem unbegrenzten inneren Raum auf [0, 1],
 * relativ zur aktuellen Bounding Box. Reine Darstellungshilfe für die
 * UI — verändert keine gespeicherten Positionen.
 */
export function normalizeNodePositions(nodes: InnerNode[]): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return result;

  const xs = nodes.map((n) => n.position.x);
  const ys = nodes.map((n) => n.position.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;

  for (const node of nodes) {
    const x = spanX === 0 ? 0.5 : (node.position.x - minX) / spanX;
    const y = spanY === 0 ? 0.5 : (node.position.y - minY) / spanY;
    result.set(node.id, { x, y });
  }
  return result;
}

function normalizeEdgeWeights(edges: Edge[]): Map<string, number> {
  const result = new Map<string, number>();
  if (edges.length === 0) return result;
  const maxStrength = Math.max(...edges.map((e) => e.strength), 0);
  for (const edge of edges) {
    result.set(edge.id, maxStrength === 0 ? 0 : edge.strength / maxStrength);
  }
  return result;
}

function describeEvent(payload: unknown, participants: string[]): string {
  if (payload && typeof payload === "object" && "label" in payload) {
    return String((payload as { label: unknown }).label);
  }
  if (participants.length > 0) return participants.join(", ");
  return "Ereignis";
}

/**
 * Baut den vollständigen UI-Payload aus einem Lauf. Gibt nur tatsächlich
 * vorhandene Werte aus — keine erfundenen Platzhalter.
 */
export function toUiPayload(run: RunState, world?: WorldState, kieselWesenObjectId = "kieselwesen"): UiPayload {
  const nodes = [...run.model.nodes.values()];
  const edges = [...run.model.edges.values()];
  const positions = normalizeNodePositions(nodes);
  const weights = normalizeEdgeWeights(edges);
  const events = run.log.events;
  const lastEvent = events[events.length - 1];

  const payload: UiPayload = {
    status: run.restActive ? "ruhephase" : "aktiv",
    event: lastEvent ? describeEvent(lastEvent.payload, lastEvent.participants) : "Noch kein Ereignis.",
    state: {
      lauf: run.runId,
      seed: run.seed,
    },
    nodes: nodes.map((node) => ({
      id: node.id,
      label: node.id,
      ...(positions.get(node.id) ?? { x: 0.5, y: 0.5 }),
    })),
    edges: edges.map((edge) => ({
      source: edge.nodeA,
      target: edge.nodeB,
      weight: weights.get(edge.id) ?? 0,
    })),
    history: events.map((event) => ({ label: describeEvent(event.payload, event.participants) })),
  };

  const kieselWesen = world?.objects.get(kieselWesenObjectId);
  if (kieselWesen) {
    payload.position = { x: kieselWesen.position.x, y: kieselWesen.position.y };
  }

  return payload;
}
