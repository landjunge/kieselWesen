// Verbindet den Code-Unterbau (src/domain) mit der UI aus main.js.
// Keine erfundenen Simulationswerte: jeder Zustand kommt aus echten
// Ereignissen (Objektberührung im Raum) über den getesteten Versuchsmotor.
import {
  allRulesEnabled,
  appendEvent,
  applyEventToPair,
  applyEventToSingleNode,
  branchFromSnapshot,
  compareRuns,
  createEmptyLog,
  createEmptyModel,
  createInstances,
  createNode,
  demoEngineParams,
  deserializeRun,
  ensureEdge,
  exportRunAsJson,
  replaySequence,
  runRestStep,
  seedInitialRoom,
  serializeRun,
  toUiPayload,
} from "./dist-browser/domain/browser.js";

// Weltobjekt-ID (aus worldObjects.ts) je Raumobjekt-Klasse im UI-Markup.
const OBJECT_ID_BY_CLASS = {
  bed: "bed",
  plant: "plant",
  crate: "clutter",
  cat: "cat",
  kiesel: "kieselwesen",
};

const DEFAULT_RUN_ID = "lokal-vorschau";
const LEGACY_STORAGE_KEY = "kieselwesen:lokal-vorschau";
const RUN_STORAGE_PREFIX = "kieselwesen:run:";
const ACTIVE_RUN_STORAGE_KEY = "kieselwesen:active-run-id";
const SNAPSHOT_STORAGE_PREFIX = "kieselwesen:snapshot:";

function runStorageKey(runId) {
  return RUN_STORAGE_PREFIX + runId;
}

/**
 * Jeder bekannte Lauf (Ursprung wie Abzweigung) liegt unter einem eigenen
 * Schlüssel. So bleibt der Ursprungslauf beim Anlegen/Aktivieren einer
 * Abzweigung unangetastet erreichbar, statt von ihr überschrieben zu werden.
 */
function loadRunById(runId) {
  try {
    const raw = localStorage.getItem(runStorageKey(runId));
    if (raw) return deserializeRun(JSON.parse(raw));
    // Migration: Läufe aus früheren Versionen lagen unter einem festen
    // Einzelschlüssel statt pro Lauf-ID.
    if (runId === DEFAULT_RUN_ID) {
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) return deserializeRun(JSON.parse(legacyRaw));
    }
    return null;
  } catch {
    // Privater Modus, defekte Daten o.ä. — startet dann einfach frisch.
    return null;
  }
}

function saveRunToStorage(currentRun) {
  try {
    localStorage.setItem(runStorageKey(currentRun.runId), JSON.stringify(serializeRun(currentRun)));
    localStorage.setItem(ACTIVE_RUN_STORAGE_KEY, currentRun.runId);
  } catch {
    // Speicher voll/blockiert — Zustand bleibt dann nur für diese Sitzung erhalten.
  }
}

function listKnownRunIds() {
  const ids = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(RUN_STORAGE_PREFIX)) ids.push(key.slice(RUN_STORAGE_PREFIX.length));
  }
  if (ids.length === 0 && localStorage.getItem(LEGACY_STORAGE_KEY)) ids.push(DEFAULT_RUN_ID);
  return ids.sort();
}

function listKnownSnapshotIds() {
  const ids = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(SNAPSHOT_STORAGE_PREFIX)) ids.push(key.slice(SNAPSHOT_STORAGE_PREFIX.length));
  }
  return ids.sort();
}

function createFreshRun(runId) {
  return {
    runId,
    seed: "lokal",
    createdAt: Date.now(),
    restActive: false,
    model: createEmptyModel(),
    log: createEmptyLog(),
    engineConfig: { params: demoEngineParams, rulesEnabled: allRulesEnabled },
  };
}

let world = seedInitialRoom();
const activeRunIdAtStart = localStorage.getItem(ACTIVE_RUN_STORAGE_KEY) ?? DEFAULT_RUN_ID;
let run = loadRunById(activeRunIdAtStart) ?? createFreshRun(activeRunIdAtStart);
let eventCounter = run.log.events.length;
let lastTouchedNodeId = run.log.events.at(-1)?.participants.at(-1) ?? null;
saveRunToStorage(run);

/**
 * Wechselt den aktiven Lauf (Ursprung oder eine Abzweigung) auf einen
 * bereits gespeicherten Lauf. Der bisher aktive Lauf bleibt unter seiner
 * eigenen runId unverändert erreichbar.
 */
function activateRun(runId) {
  const loaded = loadRunById(runId);
  if (!loaded) return false;
  run = loaded;
  eventCounter = run.log.events.length;
  lastTouchedNodeId = run.log.events.at(-1)?.participants.at(-1) ?? null;
  localStorage.setItem(ACTIVE_RUN_STORAGE_KEY, run.runId);
  updateRestControls();
  refreshRunSelect();
  render();
  return true;
}

function render() {
  window.KieselWesenUI.update(toUiPayload(run, world));
}

/**
 * Ein einzelnes berührtes Weltobjekt erzeugt/aktiviert genau einen inneren
 * Knoten mit derselben stabilen ID. Zwei kurz nacheinander berührte
 * Objekte bekommen zusätzlich eine Verbindung — reine Verdrahtung zum
 * Testen des Datenflusses, keine festgelegte Kernregel.
 */
function touchObject(objectId, label) {
  eventCounter += 1;
  const eventId = `ev${eventCounter}`;
  const at = Date.now();

  if (!run.model.nodes.has(objectId)) {
    const index = run.model.nodes.size;
    run.model = createNode(run.model, { id: objectId, at, position: { x: index * 2, y: 0, z: 0 } });
  }

  const { log } = appendEvent(run.log, { id: eventId, time: at, participants: [objectId], payload: { label: `${label} berührt` } });
  run.log = log;

  const single = applyEventToSingleNode(run.model, run.engineConfig, at, eventId, objectId);
  run.model = single.state;

  if (lastTouchedNodeId && lastTouchedNodeId !== objectId) {
    const edgeId = [lastTouchedNodeId, objectId].sort().join("::");
    run.model = ensureEdge(run.model, { id: edgeId, at, nodeA: lastTouchedNodeId, nodeB: objectId });
    const pair = applyEventToPair(run.model, run.engineConfig, at, eventId, lastTouchedNodeId, objectId);
    run.model = pair.state;
  }
  lastTouchedNodeId = objectId;

  saveRunToStorage(run);
  render();
}

for (const element of document.querySelectorAll(".room-object")) {
  const worldId = OBJECT_ID_BY_CLASS[[...element.classList].find((c) => c in OBJECT_ID_BY_CLASS)];
  if (!worldId) continue;
  element.addEventListener("click", () => touchObject(worldId, element.dataset.object ?? worldId));
}

render();

/**
 * Ruhephase (Bauplan Phase 8): klare Ereignisgrenze beim Wechsel, ein
 * Ruheschritt wirkt nur innerhalb der Ruhephase. Von echten Bedienelementen
 * in Box 2 und von der Testschnittstelle gleichermaßen genutzt.
 */
function setRestActive(active) {
  run.restActive = active;
  eventCounter += 1;
  const eventId = `ev${eventCounter}`;
  const at = Date.now();
  const { log } = appendEvent(run.log, {
    id: eventId,
    time: at,
    participants: [],
    payload: { label: active ? "Ruhephase begonnen" : "Ruhephase beendet" },
  });
  run.log = log;
  saveRunToStorage(run);
  updateRestControls();
  render();
}

function applyRestStep() {
  if (!run.restActive) return { applied: false, reason: "not in rest phase" };
  const at = Date.now();
  const result = runRestStep(run.model, run.engineConfig, at);
  run.model = result.state;
  eventCounter += 1;
  const eventId = `ev${eventCounter}`;
  const { log } = appendEvent(run.log, {
    id: eventId,
    time: at,
    participants: [],
    payload: { label: `Ruheschritt: ${result.changes.length} Änderung(en)` },
  });
  run.log = log;
  saveRunToStorage(run);
  render();
  return { applied: true, changeCount: result.changes.length };
}

const restToggleButton = document.getElementById("rest-toggle");
const restStepButton = document.getElementById("rest-step");

function updateRestControls() {
  if (!restToggleButton || !restStepButton) return;
  restToggleButton.textContent = run.restActive ? "Ruhephase verlassen" : "Ruhephase betreten";
  restStepButton.disabled = !run.restActive;
}

restToggleButton?.addEventListener("click", () => setRestActive(!run.restActive));
restStepButton?.addEventListener("click", () => applyRestStep());
updateRestControls();

/**
 * Lauf-Werkzeuge (Bauplan Phase 9): Export in ein lesbares Format,
 * Snapshot anlegen und daraus eine neue Abzweigung starten — die
 * bereits getestete Domainlogik (exportRunAsJson/serializeRun/
 * branchFromSnapshot) jetzt über echte Bedienelemente statt nur als
 * ungenutzte Funktionen im Browser-Bundle. Der Ursprungslauf wird nie
 * überschrieben: Snapshot und Abzweigung liegen unter eigenen
 * localStorage-Schlüsseln.
 */
const runExportButton = document.getElementById("run-export");
const runSnapshotButton = document.getElementById("run-snapshot");
const runBranchButton = document.getElementById("run-branch");
const runToolsResult = document.getElementById("run-tools-result");
const runSelect = document.getElementById("run-select");
const runActivateButton = document.getElementById("run-activate");
const snapshotSelect = document.getElementById("snapshot-select");

function refreshRunSelect() {
  if (!runSelect) return;
  const ids = listKnownRunIds();
  runSelect.replaceChildren(
    ...ids.map((id) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = id === run.runId ? `${id} (aktiv)` : id;
      return option;
    }),
  );
  runSelect.value = run.runId;
}

function refreshSnapshotSelect() {
  if (!snapshotSelect) return;
  const ids = listKnownSnapshotIds();
  const previousValue = snapshotSelect.value;
  snapshotSelect.replaceChildren(
    ...ids.map((id) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = id;
      return option;
    }),
  );
  if (ids.includes(previousValue)) snapshotSelect.value = previousValue;
  if (runBranchButton) runBranchButton.disabled = ids.length === 0;
}

refreshRunSelect();
refreshSnapshotSelect();

runExportButton?.addEventListener("click", () => {
  const json = exportRunAsJson(run);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${run.runId}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  if (runToolsResult) runToolsResult.textContent = `Lauf "${run.runId}" als ${run.runId}.json exportiert.`;
});

runSnapshotButton?.addEventListener("click", () => {
  const snapshotId = `s${Date.now()}`;
  localStorage.setItem(SNAPSHOT_STORAGE_PREFIX + snapshotId, JSON.stringify(serializeRun(run)));
  refreshSnapshotSelect();
  if (snapshotSelect) snapshotSelect.value = snapshotId;
  if (runToolsResult) runToolsResult.textContent = `Snapshot "${snapshotId}" von Lauf "${run.runId}" angelegt (${run.model.nodes.size} Knoten).`;
});

runBranchButton?.addEventListener("click", () => {
  const selectedSnapshotId = snapshotSelect?.value;
  if (!selectedSnapshotId) return;
  const raw = localStorage.getItem(SNAPSHOT_STORAGE_PREFIX + selectedSnapshotId);
  if (!raw) return;
  const snapshot = deserializeRun(JSON.parse(raw));
  const originRunId = run.runId;
  const branchRunId = `branch-${Date.now()}`;
  const branch = branchFromSnapshot(snapshot, branchRunId, Date.now());
  localStorage.setItem(runStorageKey(branch.runId), JSON.stringify(serializeRun(branch)));
  // Die Abzweigung wird zur tatsächlich aktiven Instanz — der Ursprungslauf
  // bleibt unter seiner eigenen runId unverändert gespeichert und über den
  // Lauf-Wähler jederzeit wieder erreichbar.
  activateRun(branch.runId);
  if (runToolsResult) {
    runToolsResult.textContent =
      `Abzweigung "${branch.runId}" aus Snapshot "${selectedSnapshotId}" erstellt und aktiviert ` +
      `(abgezweigt von "${branch.branchedFromRunId}", ${branch.model.nodes.size} Knoten). ` +
      `Ursprungslauf "${originRunId}" bleibt unverändert und ist über "Lauf wechseln" erreichbar.`;
  }
});

runActivateButton?.addEventListener("click", () => {
  const targetRunId = runSelect?.value;
  if (!targetRunId || targetRunId === run.runId) return;
  if (activateRun(targetRunId) && runToolsResult) {
    runToolsResult.textContent = `Lauf "${targetRunId}" ist jetzt aktiv.`;
  }
});

/**
 * Testschnittstelle für automatisierte Prüfungen (kein zusätzliches
 * UI-Feature, nur direkter Zugriff auf dieselbe Logik wie die Buttons
 * oben): erlaubt, den Mehrfach-Kiesel-Vergleich (Phase 10) auch im echten
 * Browser zu verifizieren — zwei Instanzen aus dem aktuellen Zustand,
 * dieselbe Ereignisfolge abgespielt, Ergebnis verglichen.
 */
window.KieselWesenDebug = Object.freeze({
  getRun: () => run,
  enterRest: () => setRestActive(true),
  exitRest: () => setRestActive(false),
  runRestStep: () => applyRestStep(),
  compareIdenticalReplay: (actions) => {
    const [instanceA, instanceB] = createInstances(run, ["debug-a", "debug-b"], Date.now());
    const finalA = replaySequence(instanceA, actions, 1);
    const finalB = replaySequence(instanceB, actions, 1);
    return compareRuns(finalA, finalB);
  },
  compareDeviatedReplay: (actionsA, actionsB) => {
    const [instanceA, instanceB] = createInstances(run, ["debug-a2", "debug-b2"], Date.now());
    const finalA = replaySequence(instanceA, actionsA, 1);
    const finalB = replaySequence(instanceB, actionsB, 1);
    return compareRuns(finalA, finalB);
  },
});

/**
 * Echte Bedienelemente für den Mehrfach-Kiesel-Vergleich (Phase 10):
 * dieselbe Logik wie window.KieselWesenDebug.compareIdenticalReplay/
 * compareDeviatedReplay, jetzt über echte Buttons statt nur die
 * Testschnittstelle erreichbar — ein einziger Codepfad für beide.
 * Nutzt echte Weltobjekt-IDs, keine erfundenen Aktionen.
 */
const compareIdenticalButton = document.getElementById("compare-identical");
const compareDeviatedButton = document.getElementById("compare-deviated");
const compareResult = document.getElementById("compare-result");

function renderNodeDiffs(nodeDiffs) {
  if (nodeDiffs.length === 0) return "keine";
  return nodeDiffs
    .map((diff) => `${diff.nodeId}: ${diff.activationA.toFixed(2)} vs. ${diff.activationB.toFixed(2)} (Δ ${diff.delta.toFixed(2)})`)
    .join("; ");
}

function renderCompareResult(comparison) {
  if (!compareResult) return;
  compareResult.replaceChildren();
  const summary = document.createElement("p");
  summary.textContent = comparison.identical ? "Ergebnis: identisch." : "Ergebnis: nicht identisch.";
  compareResult.append(summary);
  if (!comparison.identical) {
    const diffs = document.createElement("p");
    diffs.textContent = `Knotenunterschiede: ${renderNodeDiffs(comparison.nodeDiffs)}`;
    compareResult.append(diffs);
  }
}

compareIdenticalButton?.addEventListener("click", () => {
  const [instanceA, instanceB] = createInstances(run, ["ui-a", "ui-b"], Date.now());
  const actions = [
    { kind: "single", nodeId: "plant" },
    { kind: "single", nodeId: "cat" },
  ];
  const finalA = replaySequence(instanceA, actions, 1);
  const finalB = replaySequence(instanceB, actions, 1);
  renderCompareResult(compareRuns(finalA, finalB));
});

compareDeviatedButton?.addEventListener("click", () => {
  const [instanceA, instanceB] = createInstances(run, ["ui-a2", "ui-b2"], Date.now());
  const finalA = replaySequence(instanceA, [{ kind: "single", nodeId: "plant" }], 1);
  const finalB = replaySequence(instanceB, [{ kind: "single", nodeId: "plant" }, { kind: "single", nodeId: "plant" }], 1);
  renderCompareResult(compareRuns(finalA, finalB));
});
