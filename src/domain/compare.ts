import { appendEvent } from "./eventLog.js";
import { applyEventToPair, applyEventToSingleNode } from "./experimentEngine.js";
import { createNode, ensureEdge } from "./innerModel.js";
import type { RunState } from "./persistence.js";
import { branchFromSnapshot } from "./persistence.js";

/**
 * Eine einzelne, deterministisch wiederholbare Interaktion: entweder ein
 * einzelner berührter Knoten oder zwei kurz nacheinander berührte Knoten
 * (siehe app.js). Dient dazu, für mehrere Instanzen exakt dieselbe
 * Ereignisfolge abzuspielen.
 */
export type RunAction =
  | { kind: "single"; nodeId: string }
  | { kind: "pair"; nodeA: string; nodeB: string };

function ensureNode(run: RunState, nodeId: string, at: number): RunState {
  if (run.model.nodes.has(nodeId)) return run;
  const index = run.model.nodes.size;
  const model = createNode(run.model, { id: nodeId, at, position: { x: index * 2, y: 0, z: 0 } });
  return { ...run, model };
}

/**
 * Wendet eine einzelne Aktion auf einen Lauf an: legt fehlende Knoten an,
 * loggt ein echtes Ereignis und lässt den Versuchsmotor mit dessen
 * Parametern wirken. Reine Funktion — kein Date.now(), keine
 * Zufallszahlen, damit dieselbe Aktion bei zwei Läufen dasselbe Ergebnis
 * erzeugt.
 */
export function applyAction(run: RunState, action: RunAction, at: number, eventId: string): RunState {
  let next = run;
  if (action.kind === "single") {
    next = ensureNode(next, action.nodeId, at);
    const { log, event } = appendEvent(next.log, {
      id: eventId,
      time: at,
      participants: [action.nodeId],
      payload: { label: `${action.nodeId} berührt` },
    });
    const engineResult = applyEventToSingleNode(next.model, next.engineConfig, at, event.id, action.nodeId);
    return { ...next, log, model: engineResult.state };
  }

  next = ensureNode(next, action.nodeA, at);
  next = ensureNode(next, action.nodeB, at);
  const { log, event } = appendEvent(next.log, {
    id: eventId,
    time: at,
    participants: [action.nodeA, action.nodeB],
    payload: { label: `${action.nodeA} + ${action.nodeB} berührt` },
  });
  let model = ensureEdge(next.model, { id: eventId, at, nodeA: action.nodeA, nodeB: action.nodeB });
  const engineResult = applyEventToPair(model, next.engineConfig, at, event.id, action.nodeA, action.nodeB);
  model = engineResult.state;
  return { ...next, log, model };
}

/**
 * Spielt eine geordnete Ereignisfolge deterministisch auf einen Lauf ab.
 * `startAt` und der Aktionsindex bestimmen die Zeitstempel, nie die
 * Systemzeit — sonst wären zwei "identische" Läufe nicht mehr identisch.
 */
export function replaySequence(run: RunState, actions: RunAction[], startAt: number): RunState {
  let next = run;
  actions.forEach((action, index) => {
    const at = startAt + index;
    next = applyAction(next, action, at, `replay-${index}`);
  });
  return next;
}

/**
 * Erstellt mehrere unabhängige Instanzen aus demselben Ausgangslauf
 * (Snapshot oder aktueller Zustand), mit eigener runId aber sonst
 * identischem Start — für den Mehrfach-Kiesel-Vergleich.
 */
export function createInstances(source: RunState, newRunIds: string[], at: number): RunState[] {
  return newRunIds.map((runId) => branchFromSnapshot(source, runId, at));
}

export interface NodeDiff {
  nodeId: string;
  activationA: number | null;
  activationB: number | null;
  delta: number | null;
}

export interface EdgeDiff {
  edgeId: string;
  strengthA: number | null;
  strengthB: number | null;
  delta: number | null;
}

export interface RunComparison {
  identical: boolean;
  nodeDiffs: NodeDiff[];
  edgeDiffs: EdgeDiff[];
}

/**
 * Vergleicht zwei Läufe rein faktisch: welche Knoten/Kanten existieren,
 * wie groß die Differenz in Aktivierung/Stärke ist. Keine Interpretation
 * über Bewusstsein, Persönlichkeit oder "Eigenentwicklung" — nur Zahlen.
 */
export function compareRuns(a: RunState, b: RunState): RunComparison {
  const nodeIds = new Set([...a.model.nodes.keys(), ...b.model.nodes.keys()]);
  const nodeDiffs: NodeDiff[] = [];
  for (const nodeId of nodeIds) {
    const nodeA = a.model.nodes.get(nodeId);
    const nodeB = b.model.nodes.get(nodeId);
    const activationA = nodeA?.activation ?? null;
    const activationB = nodeB?.activation ?? null;
    const delta = activationA !== null && activationB !== null ? activationB - activationA : null;
    if (!nodeA || !nodeB || delta !== 0) {
      nodeDiffs.push({ nodeId, activationA, activationB, delta });
    }
  }

  const edgeKeys = new Set([...a.model.edges.keys(), ...b.model.edges.keys()]);
  const edgeDiffs: EdgeDiff[] = [];
  for (const edgeKey of edgeKeys) {
    const edgeA = a.model.edges.get(edgeKey);
    const edgeB = b.model.edges.get(edgeKey);
    const strengthA = edgeA?.strength ?? null;
    const strengthB = edgeB?.strength ?? null;
    const delta = strengthA !== null && strengthB !== null ? strengthB - strengthA : null;
    if (!edgeA || !edgeB || delta !== 0) {
      edgeDiffs.push({ edgeId: edgeKey, strengthA, strengthB, delta });
    }
  }

  return { identical: nodeDiffs.length === 0 && edgeDiffs.length === 0, nodeDiffs, edgeDiffs };
}
