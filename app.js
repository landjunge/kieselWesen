// Verbindet den Code-Unterbau (src/domain) mit der UI aus main.js.
// Keine erfundenen Simulationswerte: jeder Zustand kommt aus echten
// Ereignissen (Objektberührung im Raum) über den getesteten Versuchsmotor.
import {
  allRulesEnabled,
  appendEvent,
  applyEventToPair,
  applyEventToSingleNode,
  compareRuns,
  createEmptyLog,
  createEmptyModel,
  createInstances,
  createNode,
  demoEngineParams,
  deserializeRun,
  ensureEdge,
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

const STORAGE_KEY = "kieselwesen:lokal-vorschau";

function loadRunFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return deserializeRun(JSON.parse(raw));
  } catch {
    // Privater Modus, defekte Daten o.ä. — startet dann einfach frisch.
    return null;
  }
}

function saveRunToStorage(currentRun) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeRun(currentRun)));
  } catch {
    // Speicher voll/blockiert — Zustand bleibt dann nur für diese Sitzung erhalten.
  }
}

let world = seedInitialRoom();
let run = loadRunFromStorage() ?? {
  runId: "lokal-vorschau",
  seed: "lokal",
  createdAt: Date.now(),
  restActive: false,
  model: createEmptyModel(),
  log: createEmptyLog(),
  engineConfig: { params: demoEngineParams, rulesEnabled: allRulesEnabled },
};
let eventCounter = run.log.events.length;
let lastTouchedNodeId = run.log.events.at(-1)?.participants.at(-1) ?? null;

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
