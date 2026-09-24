import type { EngineConfig } from "./experimentEngine.js";
import type { Edge, EventLog, InnerModelState, InnerNode } from "./types.js";

/**
 * Ein Lauf bündelt alles, was einen KieselWesen-Zustand vollständig
 * reproduzierbar macht: Weltzustand, Ereignisse, Versuchsmotor-Parameter,
 * Ruhe-/Aktivstatus und der Startseed. Reine Datenstruktur, keine
 * Speicherlogik — funktioniert gleichermaßen in Node und im Browser.
 */
export interface RunState {
  runId: string;
  seed: string;
  createdAt: number;
  /** Lauf, aus dem dieser hier als Abzweigung/Kopie gestartet wurde, falls vorhanden. */
  branchedFromRunId?: string;
  restActive: boolean;
  model: InnerModelState;
  log: EventLog;
  engineConfig: EngineConfig;
}

export interface SerializedRun {
  runId: string;
  seed: string;
  createdAt: number;
  branchedFromRunId?: string;
  restActive: boolean;
  nodes: InnerNode[];
  edges: Edge[];
  log: EventLog;
  engineConfig: EngineConfig;
}

export function serializeRun(run: RunState): SerializedRun {
  return {
    runId: run.runId,
    seed: run.seed,
    createdAt: run.createdAt,
    branchedFromRunId: run.branchedFromRunId,
    restActive: run.restActive,
    nodes: [...run.model.nodes.values()],
    edges: [...run.model.edges.values()],
    log: run.log,
    engineConfig: run.engineConfig,
  };
}

function edgeMapKey(edge: Edge): string {
  return edge.nodeA < edge.nodeB ? `${edge.nodeA}::${edge.nodeB}` : `${edge.nodeB}::${edge.nodeA}`;
}

export function deserializeRun(data: SerializedRun): RunState {
  const nodes = new Map(data.nodes.map((node) => [node.id, node] as const));
  const edges = new Map(data.edges.map((edge) => [edgeMapKey(edge), edge] as const));
  return {
    runId: data.runId,
    seed: data.seed,
    createdAt: data.createdAt,
    branchedFromRunId: data.branchedFromRunId,
    restActive: data.restActive,
    model: { nodes, edges },
    log: data.log,
    engineConfig: data.engineConfig,
  };
}

/**
 * Startet einen neuen Lauf als Abzweigung/Kopie eines Snapshots, statt die
 * bestehende Historie umzuschreiben. Der neue Lauf bekommt eine eigene
 * runId und referenziert den Ursprung nur als Herkunftsangabe.
 */
export function branchFromSnapshot(snapshot: RunState, newRunId: string, at: number, newSeed?: string): RunState {
  return {
    ...snapshot,
    runId: newRunId,
    seed: newSeed ?? snapshot.seed,
    createdAt: at,
    branchedFromRunId: snapshot.runId,
  };
}

/** Export in ein lesbares, prüfbares Format (formatiertes JSON). */
export function exportRunAsJson(run: RunState): string {
  return JSON.stringify(serializeRun(run), null, 2);
}
