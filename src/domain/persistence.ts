import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { deserializeRun, serializeRun, type RunState, type SerializedRun } from "./runSerialization.js";

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
