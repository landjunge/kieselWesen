import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EngineConfig } from "./experimentEngine.js";
import type { Edge, EventLog, InnerModelState, InnerNode } from "./types.js";

/**
 * Ein Lauf bündelt alles, was einen KieselWesen-Zustand vollständig
 * reproduzierbar macht: Weltzustand, Ereignisse, Versuchsmotor-Parameter,
 * Ruhe-/Aktivstatus und der Startseed.
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

interface SerializedRun {
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

function runFilePath(dir: string, runId: string): string {
  return path.join(dir, `${runId}.json`);
}

function snapshotFilePath(dir: string, runId: string, snapshotId: string): string {
  return path.join(dir, "snapshots", runId, `${snapshotId}.json`);
}

/**
 * Speichert den aktuellen Lauf als eigene Datei. Überschreibt bewusst nur
 * die "aktuelle Kante" des Laufs — bereits angelegte Snapshots bleiben
 * unverändert erhalten und werden nie mitüberschrieben.
 */
export async function saveRun(dir: string, run: RunState): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(runFilePath(dir, run.runId), JSON.stringify(serializeRun(run), null, 2), "utf-8");
}

export async function loadRun(dir: string, runId: string): Promise<RunState> {
  const raw = await readFile(runFilePath(dir, runId), "utf-8");
  return deserializeRun(JSON.parse(raw) as SerializedRun);
}

export async function listRunIds(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name.replace(/\.json$/, ""));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

/**
 * Legt einen unveränderlichen Snapshot des aktuellen Laufs an. Snapshots
 * werden nie überschrieben — ein zweiter Snapshot mit derselber ID ist
 * ein Fehler, keine stille Ersetzung.
 */
export async function createSnapshot(dir: string, run: RunState, snapshotId: string): Promise<void> {
  const file = snapshotFilePath(dir, run.runId, snapshotId);
  await mkdir(path.dirname(file), { recursive: true });
  try {
    await readFile(file, "utf-8");
    throw new Error(`snapshot already exists: ${run.runId}/${snapshotId}`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  await writeFile(file, JSON.stringify(serializeRun(run), null, 2), "utf-8");
}

export async function loadSnapshot(dir: string, runId: string, snapshotId: string): Promise<RunState> {
  const raw = await readFile(snapshotFilePath(dir, runId, snapshotId), "utf-8");
  return deserializeRun(JSON.parse(raw) as SerializedRun);
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
