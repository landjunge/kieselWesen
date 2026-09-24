import {
  fadeEdge,
  setActivation,
  useEdge,
} from "./innerModel.js";
import type { InnerModelState } from "./types.js";

/**
 * Alle Zahlen, die das Verhalten steuern, liegen hier zentral — nicht
 * verteilt im Welt- oder UI-Code. "Demo"-Werte sind ausdrücklich als
 * Testparameter markiert, keine festgeschriebene Wahrheit des Systems.
 */
export interface EngineParams {
  /** Aktivierungszuwachs, wenn ein Knoten durch ein Ereignis genutzt wird. */
  activationBoostOnUse: number;
  /** Stärkezuwachs einer Verbindung bei Nutzung. */
  edgeStrengthGainOnUse: number;
  /** Aktivierungsabklingen pro Ruheschritt. */
  activationDecayPerRestStep: number;
  /** Verblassen der Verbindungsstärke pro Ruheschritt. */
  edgeFadePerRestStep: number;
}

/**
 * Beispielhafte Testparameter für lokale Entwicklung/Demos.
 * Keine Kernregel — jederzeit austauschbar, nicht wissenschaftlich hergeleitet.
 */
export const demoEngineParams: EngineParams = {
  activationBoostOnUse: 0.2,
  edgeStrengthGainOnUse: 1,
  activationDecayPerRestStep: 0.05,
  edgeFadePerRestStep: 0.1,
};

export interface EngineRulesEnabled {
  activationOnUse: boolean;
  edgeStrengthOnUse: boolean;
  restDecay: boolean;
}

export const allRulesEnabled: EngineRulesEnabled = {
  activationOnUse: true,
  edgeStrengthOnUse: true,
  restDecay: true,
};

export interface EngineConfig {
  params: EngineParams;
  rulesEnabled: EngineRulesEnabled;
}

export interface EngineChangeLogEntry {
  at: number;
  rule: keyof EngineRulesEnabled;
  targetKind: "node" | "edge";
  targetId: string;
  eventId?: string;
}

export interface EngineRunResult {
  state: InnerModelState;
  changes: EngineChangeLogEntry[];
}

/**
 * Verarbeitet die Wirkung eines einzelnen Ereignisses auf zwei beteiligte
 * Knoten: Aktivierung und Kantenstärke steigen nur, wenn die jeweilige
 * Regel aktiv ist. Jede Änderung wird mit der auslösenden Event-ID
 * protokolliert, damit sie später zurückverfolgt werden kann.
 */
export function applyEventToPair(
  state: InnerModelState,
  config: EngineConfig,
  at: number,
  eventId: string,
  nodeA: string,
  nodeB: string,
): EngineRunResult {
  let next = state;
  const changes: EngineChangeLogEntry[] = [];

  if (config.rulesEnabled.activationOnUse) {
    for (const nodeId of [nodeA, nodeB]) {
      const node = next.nodes.get(nodeId);
      if (!node) continue;
      const activation = node.activation + config.params.activationBoostOnUse;
      next = setActivation(next, nodeId, at, activation);
      changes.push({ at, rule: "activationOnUse", targetKind: "node", targetId: nodeId, eventId });
    }
  }

  if (config.rulesEnabled.edgeStrengthOnUse && next.nodes.has(nodeA) && next.nodes.has(nodeB)) {
    next = useEdge(next, at, nodeA, nodeB, config.params.edgeStrengthGainOnUse);
    changes.push({ at, rule: "edgeStrengthOnUse", targetKind: "edge", targetId: `${nodeA}::${nodeB}`, eventId });
  }

  return { state: next, changes };
}

/**
 * Ein deterministischer Ruheschritt: lässt Aktivierung und Kantenstärke
 * abklingen, löscht dabei aber nie einen Knoten oder eine Verbindung.
 * Ohne aktivierte restDecay-Regel verändert Ruhe die Struktur nicht.
 */
export function runRestStep(
  state: InnerModelState,
  config: EngineConfig,
  at: number,
): EngineRunResult {
  let next = state;
  const changes: EngineChangeLogEntry[] = [];

  if (!config.rulesEnabled.restDecay) {
    return { state: next, changes };
  }

  for (const node of next.nodes.values()) {
    const activation = Math.max(0, node.activation - config.params.activationDecayPerRestStep);
    if (activation !== node.activation) {
      next = setActivation(next, node.id, at, activation);
      changes.push({ at, rule: "restDecay", targetKind: "node", targetId: node.id });
    }
  }

  for (const edge of next.edges.values()) {
    if (edge.strength <= 0) continue;
    next = fadeEdge(next, at, edge.nodeA, edge.nodeB, config.params.edgeFadePerRestStep);
    changes.push({ at, rule: "restDecay", targetKind: "edge", targetId: `${edge.nodeA}::${edge.nodeB}` });
  }

  return { state: next, changes };
}
