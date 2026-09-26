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
  addSuggestion,
  confirmSuggestion,
  createAnthropicClient,
  createNode,
  createOllamaClient,
  demoEngineParams,
  deserializeRun,
  ensureEdge,
  exportRunAsJson,
  getLearner,
  getSuggestions,
  learnTransition,
  predictNext,
  rejectSuggestion,
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
  renderLearnerPanel();
  renderSuggestionsPanel();
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
    // Mini-Lerner (Bauplan-offener Punkt "Sprache/LLM"): lernt ausschließlich
    // aus dieser echten Übergangsfolge, keine erfundenen Werte, keine
    // externe Wissensquelle.
    run.learner = learnTransition(getLearner(run), lastTouchedNodeId, objectId);
  }
  lastTouchedNodeId = objectId;

  saveRunToStorage(run);
  render();
  renderLearnerPanel();
}

for (const element of document.querySelectorAll(".room-object")) {
  const worldId = OBJECT_ID_BY_CLASS[[...element.classList].find((c) => c in OBJECT_ID_BY_CLASS)];
  if (!worldId) continue;
  element.addEventListener("click", () => touchObject(worldId, element.dataset.object ?? worldId));
}

/**
 * Zeigt die gelernte Vorhersage für den zuletzt berührten Knoten an —
 * reine gelernte Fakten aus dem Mini-Lerner, keine Interpretation.
 */
function renderLearnerPanel() {
  const container = document.getElementById("learner-result");
  if (!container) return;
  container.replaceChildren();

  if (!lastTouchedNodeId) {
    const message = document.createElement("p");
    message.textContent = "Noch keine Übergänge gelernt.";
    container.append(message);
    return;
  }

  const predictions = predictNext(getLearner(run), lastTouchedNodeId);
  const heading = document.createElement("p");
  heading.textContent = `Zuletzt berührt: "${lastTouchedNodeId}".`;
  container.append(heading);

  if (predictions.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "Noch kein gelernter Übergang von diesem Knoten aus.";
    container.append(empty);
    return;
  }

  const label = document.createElement("p");
  label.textContent = "Gelernte Vorhersage für den nächsten berührten Knoten:";
  container.append(label);

  const list = document.createElement("ol");
  for (const prediction of predictions) {
    const item = document.createElement("li");
    item.textContent = `${prediction.toId}: ${Math.round(prediction.probability * 100)} %`;
    list.append(item);
  }
  container.append(list);
}

/**
 * Vorschläge eines austauschbaren LLM — lokal (Ollama) oder ein großes
 * externes Modell über die Cloud (Anthropic), für allgemeines Weltwissen,
 * das das kleine lokale Modell nicht hat. Beide Quellen münden im
 * selben Bestätigungs-Workflow: ein Vorschlag verändert Kiesels echtes
 * Wissen (den Mini-Lerner) NIE von selbst — er bleibt "unbestätigt", bis
 * ein Mensch ihn per Klick bestätigt oder verwirft. Nur eine Bestätigung
 * erzeugt einen echten Lernschritt, identisch zu einem selbst beobachteten
 * Übergang (touchObject oben). Ein großes Modell kann sich genauso irren
 * wie ein kleines — deshalb dieselbe Kontrolle für beide.
 */
const LLM_MODEL_STORAGE_KEY = "kieselwesen:llm-model";
const DEFAULT_LLM_MODEL = "llama3.2:3b";
const CLOUD_MODEL_STORAGE_KEY = "kieselwesen:llm-cloud-model";
const CLOUD_API_KEY_STORAGE_KEY = "kieselwesen:llm-cloud-apikey";
const DEFAULT_CLOUD_MODEL = "claude-sonnet-5";
let suggestionCounter = 0;

function currentLlmModelName() {
  return localStorage.getItem(LLM_MODEL_STORAGE_KEY) ?? DEFAULT_LLM_MODEL;
}

function currentCloudModelName() {
  return localStorage.getItem(CLOUD_MODEL_STORAGE_KEY) ?? DEFAULT_CLOUD_MODEL;
}

function currentCloudApiKey() {
  return localStorage.getItem(CLOUD_API_KEY_STORAGE_KEY) ?? "";
}

const llmModelInput = document.getElementById("llm-model");
const llmSuggestButton = document.getElementById("llm-suggest");
const cloudModelInput = document.getElementById("cloud-model");
const cloudApiKeyInput = document.getElementById("cloud-api-key");
const cloudSuggestButton = document.getElementById("cloud-suggest");
const suggestionsResult = document.getElementById("suggestions-result");

if (llmModelInput) llmModelInput.value = currentLlmModelName();
if (cloudModelInput) cloudModelInput.value = currentCloudModelName();
if (cloudApiKeyInput) cloudApiKeyInput.value = currentCloudApiKey();

llmModelInput?.addEventListener("change", () => {
  const value = llmModelInput.value.trim();
  if (value) localStorage.setItem(LLM_MODEL_STORAGE_KEY, value);
});

cloudModelInput?.addEventListener("change", () => {
  const value = cloudModelInput.value.trim();
  if (value) localStorage.setItem(CLOUD_MODEL_STORAGE_KEY, value);
});

cloudApiKeyInput?.addEventListener("change", () => {
  // Bewusst nur lokal im Browser gespeichert (localStorage) — der Schlüssel
  // verlässt dieses Gerät nur direkt an die Anthropic-API, nie an KieselWesen
  // selbst oder einen Zwischenserver.
  localStorage.setItem(CLOUD_API_KEY_STORAGE_KEY, cloudApiKeyInput.value);
});

/**
 * Gemeinsamer Ablauf für beide Quellen: Prompt bauen, Modell befragen,
 * Antwort als unbestätigten Vorschlag ablegen. `client`/`modelName` sind
 * austauschbar — Kiesel selbst kennt nur die LlmClient-Schnittstelle.
 */
async function requestSuggestionFrom(client, modelName) {
  if (!lastTouchedNodeId) return;
  const knownNodeIds = [...run.model.nodes.keys()];
  const prompt =
    `Bekannte Knoten: ${knownNodeIds.join(", ")}. ` +
    `Zuletzt berührter Knoten: "${lastTouchedNodeId}". ` +
    `Welcher bekannte Knoten folgt darauf am wahrscheinlichsten? Antworte nur mit der Knoten-ID.`;

  if (suggestionsResult) {
    const pending = document.createElement("p");
    pending.textContent = `Frage Modell "${modelName}"...`;
    suggestionsResult.append(pending);
  }

  try {
    const text = await client.suggest(prompt);
    const matchedToId = knownNodeIds.find((id) => text.trim().toLowerCase().includes(id.toLowerCase()));
    suggestionCounter += 1;
    run.suggestions = addSuggestion(getSuggestions(run), {
      id: `sugg${suggestionCounter}`,
      createdAt: Date.now(),
      fromId: lastTouchedNodeId,
      toId: matchedToId ?? text.trim(),
      text,
      modelName,
    });
    saveRunToStorage(run);
  } catch (error) {
    if (suggestionsResult) {
      const message = document.createElement("p");
      message.textContent = `Anfrage an "${modelName}" fehlgeschlagen: ${error.message}`;
      suggestionsResult.append(message);
    }
  }
  renderSuggestionsPanel();
}

llmSuggestButton?.addEventListener("click", () => {
  requestSuggestionFrom(createOllamaClient(currentLlmModelName()), currentLlmModelName());
});

cloudSuggestButton?.addEventListener("click", () => {
  const apiKey = currentCloudApiKey();
  if (!apiKey) {
    if (suggestionsResult) {
      const message = document.createElement("p");
      message.textContent = "Kein API-Schlüssel für das große Cloud-Modell hinterlegt.";
      suggestionsResult.replaceChildren(message);
    }
    return;
  }
  const modelName = currentCloudModelName();
  requestSuggestionFrom(createAnthropicClient(apiKey, modelName), modelName);
});

function confirmSuggestionById(suggestionId) {
  const suggestion = getSuggestions(run).items.find((item) => item.id === suggestionId);
  if (!suggestion || suggestion.status !== "pending") return;
  // Bestätigung erzeugt denselben echten Lernschritt wie eine selbst
  // beobachtete Erfahrung (siehe touchObject) — keine Extra-Wissensquelle.
  run.learner = learnTransition(getLearner(run), suggestion.fromId, suggestion.toId);
  run.suggestions = confirmSuggestion(getSuggestions(run), suggestionId);
  saveRunToStorage(run);
  renderSuggestionsPanel();
  renderLearnerPanel();
}

function rejectSuggestionById(suggestionId) {
  run.suggestions = rejectSuggestion(getSuggestions(run), suggestionId);
  saveRunToStorage(run);
  renderSuggestionsPanel();
}

function renderSuggestionsPanel() {
  if (!suggestionsResult) return;
  suggestionsResult.replaceChildren();

  const items = getSuggestions(run).items;
  if (items.length === 0) {
    const message = document.createElement("p");
    message.textContent = "Noch kein Vorschlag angefragt.";
    suggestionsResult.append(message);
    return;
  }

  const list = document.createElement("ul");
  for (const suggestion of [...items].reverse()) {
    const item = document.createElement("li");
    const summary = document.createElement("p");
    summary.textContent = `[${suggestion.modelName}] "${suggestion.fromId}" → "${suggestion.toId}" (${suggestion.status}): ${suggestion.text}`;
    item.append(summary);

    if (suggestion.status === "pending") {
      const confirmButton = document.createElement("button");
      confirmButton.type = "button";
      confirmButton.textContent = "Bestätigen";
      confirmButton.addEventListener("click", () => confirmSuggestionById(suggestion.id));

      const rejectButton = document.createElement("button");
      rejectButton.type = "button";
      rejectButton.textContent = "Verwerfen";
      rejectButton.addEventListener("click", () => rejectSuggestionById(suggestion.id));

      item.append(confirmButton, rejectButton);
    }

    list.append(item);
  }
  suggestionsResult.append(list);
}

render();
renderLearnerPanel();
renderSuggestionsPanel();

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
