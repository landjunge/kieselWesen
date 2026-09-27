// Verbindet den Code-Unterbau (src/domain) mit der UI aus main.js.
// Keine erfundenen Simulationswerte: jeder Zustand kommt aus echten
// Ereignissen (Objektberührung im Raum) über den getesteten Versuchsmotor.
import {
  allRulesEnabled,
  appendEvent,
  applyEventEdgeFade,
  applyEventToPair,
  applyEventToSingleNode,
  branchFromSnapshot,
  compareRuns,
  createEmptyLog,
  createEmptyModel,
  createInstances,
  addSuggestion,
  appendRejectedSuggestionEvent,
  classifySuggestionSource,
  confirmSuggestion,
  createAnthropicClient,
  createNode,
  createOllamaClient,
  createOpenAiCompatibleClient,
  demoEngineParams,
  deserializeRun,
  ensureEdge,
  exportRunAsJson,
  getLearner,
  getSuggestions,
  learnTransition,
  listAnthropicModels,
  listOllamaModels,
  listOpenAiCompatibleModels,
  predictNext,
  readEventLog,
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

  // Kanten-Verblassen ist an dieses Ereignis gekoppelt, nicht an feste Zeit:
  // nur Kanten, die einen der beteiligten Knoten berühren, verblassen hier.
  const fade = applyEventEdgeFade(run.model, run.engineConfig, at, eventId, [lastTouchedNodeId, objectId].filter(Boolean));
  run.model = fade.state;

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
/**
 * Kein Modellname zum Raten/Eintippen: die App fragt Ollama bzw. den
 * gewählten Cloud-Anbieter selbst, welche Modelle tatsächlich verfügbar
 * sind, und zeigt sie als Liste zum Auswählen — ohne Vorauswahl. Nur der
 * API-Schlüssel und (bei einem OpenAI-kompatiblen Anbieter) dessen Adresse
 * müssen von Hand eingegeben werden, weil die App die nicht erraten kann.
 */
const CLOUD_PROVIDER_STORAGE_KEY = "kieselwesen:llm-cloud-provider";
const CLOUD_BASE_URL_STORAGE_KEY = "kieselwesen:llm-cloud-base-url";
const CLOUD_API_KEY_STORAGE_KEY = "kieselwesen:llm-cloud-apikey";
let suggestionCounter = 0;

const llmModelSelect = document.getElementById("llm-model");
const llmRefreshModelsButton = document.getElementById("llm-refresh-models");
const llmSuggestButton = document.getElementById("llm-suggest");
const cloudProviderSelect = document.getElementById("cloud-provider");
const cloudBaseUrlField = document.getElementById("cloud-base-url-field");
const cloudBaseUrlInput = document.getElementById("cloud-base-url");
const cloudApiKeyInput = document.getElementById("cloud-api-key");
const cloudRefreshModelsButton = document.getElementById("cloud-refresh-models");
const cloudModelSelect = document.getElementById("cloud-model");
const cloudSuggestButton = document.getElementById("cloud-suggest");
const suggestionsResult = document.getElementById("suggestions-result");
const suggestionsNotice = document.getElementById("suggestions-notice");

/**
 * Kurze Hinweise/Fehler stehen in einem eigenen Bereich, getrennt von der
 * Liste der bisherigen Vorschläge — ein Hinweis darf die Liste nie
 * verdecken oder löschen.
 */
function showNotice(text) {
  if (!suggestionsNotice) return;
  const message = document.createElement("p");
  message.textContent = text;
  suggestionsNotice.replaceChildren(message);
}

function clearNotice() {
  if (suggestionsNotice) suggestionsNotice.replaceChildren();
}

function fillModelSelect(select, models) {
  if (!select) return;
  select.replaceChildren(
    ...[{ value: "", label: models.length ? "— Modell wählen —" : "— keine gefunden —" }, ...models.map((m) => ({ value: m, label: m }))].map(
      ({ value, label }) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        return option;
      },
    ),
  );
}

if (cloudProviderSelect) cloudProviderSelect.value = localStorage.getItem(CLOUD_PROVIDER_STORAGE_KEY) ?? "";
if (cloudBaseUrlInput) cloudBaseUrlInput.value = localStorage.getItem(CLOUD_BASE_URL_STORAGE_KEY) ?? "";
if (cloudApiKeyInput) cloudApiKeyInput.value = localStorage.getItem(CLOUD_API_KEY_STORAGE_KEY) ?? "";
if (cloudBaseUrlField) cloudBaseUrlField.hidden = cloudProviderSelect?.value !== "openai-compatible";

cloudProviderSelect?.addEventListener("change", () => {
  localStorage.setItem(CLOUD_PROVIDER_STORAGE_KEY, cloudProviderSelect.value);
  if (cloudBaseUrlField) cloudBaseUrlField.hidden = cloudProviderSelect.value !== "openai-compatible";
  fillModelSelect(cloudModelSelect, []);
});

cloudBaseUrlInput?.addEventListener("change", () => {
  localStorage.setItem(CLOUD_BASE_URL_STORAGE_KEY, cloudBaseUrlInput.value.trim());
});

cloudApiKeyInput?.addEventListener("change", () => {
  // Bewusst nur lokal im Browser gespeichert (localStorage) — der Schlüssel
  // verlässt dieses Gerät nur direkt an den gewählten Anbieter, nie an
  // KieselWesen selbst oder einen Zwischenserver.
  localStorage.setItem(CLOUD_API_KEY_STORAGE_KEY, cloudApiKeyInput.value);
});

llmRefreshModelsButton?.addEventListener("click", async () => {
  showNotice("Lade LLMs auf diesem Gerät...");
  try {
    fillModelSelect(llmModelSelect, await listOllamaModels());
    clearNotice();
  } catch (error) {
    showNotice(`Konnte LLMs nicht anzeigen: ${error.message}`);
  }
});

cloudRefreshModelsButton?.addEventListener("click", async () => {
  const provider = cloudProviderSelect?.value;
  const apiKey = cloudApiKeyInput?.value ?? "";
  if (!provider || !apiKey) {
    showNotice("Bitte zuerst Anbieter und Schlüssel angeben.");
    return;
  }
  showNotice("Lade verfügbare LLMs...");
  try {
    const models =
      provider === "anthropic"
        ? await listAnthropicModels(apiKey)
        : await listOpenAiCompatibleModels(cloudBaseUrlInput.value.trim(), apiKey);
    fillModelSelect(cloudModelSelect, models);
    clearNotice();
  } catch (error) {
    showNotice(`Konnte LLMs nicht anzeigen: ${error.message}`);
  }
});

/**
 * Ein einzelner LLM-Durchlauf: Prompt aus dem Ereignisprotokoll bauen,
 * Modell befragen, Antwort als unbestätigten Vorschlag ablegen.
 * `client`/`modelName` sind austauschbar — Kiesel selbst kennt nur die
 * LlmClient-Schnittstelle.
 *
 * Manueller Takt (gegen versteckte Automatik): startLlmRound läuft NUR,
 * wenn dieser Code aufgerufen wird — ausschließlich aus den beiden
 * Button-Klick-Handlern unten. Kein Scheduler, kein Timer, kein Aufruf aus
 * touchObject/setRestActive/applyRestStep. Berühren von Objekten oder das
 * Verstreichen von Zeit lösen nie von selbst einen LLM-Durchlauf aus.
 *
 * Fallback (gegen Kopplung): schlägt die Anfrage fehl (Netzwerk, Ollama
 * nicht erreichbar, ungültiger Schlüssel), wird der Fehler hier abgefangen
 * und nur als Hinweis angezeigt — run.model/run.log/run.learner bleiben
 * unverändert. Die Engine, der Mini-Lerner und der Rest der App laufen
 * unabhängig vom LLM weiter; ein sterbender LLM-Durchlauf reißt nichts mit.
 *
 * Quellentrennung gegen Zirkularität: der Prompt bekommt AUSSCHLIESSLICH
 * die letzten Ereignisse aus dem Protokoll (readEventLog) — nie Kanten,
 * Stärken oder sonst etwas aus dem Graphen. Das schließt frühere
 * "rejected_suggestion"-Einträge mit ein, damit das LLM sieht, was es schon
 * versucht hat, und dieselbe Idee nicht wiederholt. Das LLM soll nur
 * vorschlagen, was aus diesen Ereignissen folgt, nicht, was "passieren
 * wird". Trotzdem kann sich ein LLM Dinge ausdenken; classifySuggestionSource
 * prüft die Antwort deshalb zusätzlich auf erkennbares Graph-Vokabular und
 * markiert einen solchen Vorschlag als "graph" — der lässt sich nie
 * bestätigen.
 */
async function startLlmRound(client, modelName) {
  if (!lastTouchedNodeId) return;
  const recentEvents = readEventLog(run.log, 10);
  const eventsText = recentEvents
    .map((entry) => {
      const base = `[${entry.time}] ${entry.type} (${entry.participants.join(", ") || "keine Beteiligten"})`;
      return entry.detail ? `${base}: ${entry.detail}` : base;
    })
    .join("; ");
  const prompt =
    `Die letzten Ereignisse in zeitlicher Reihenfolge, einschließlich bereits abgelehnter Vorschläge: ${eventsText}. ` +
    `Zuletzt berührter Ort: "${lastTouchedNodeId}". ` +
    `Schlage nur vor, was aus diesen Ereignissen folgt — nicht, was passieren wird. ` +
    `Wiederhole keine bereits abgelehnte Idee. Antworte nur mit dem Namen des als Nächstes berührten Ortes.`;

  showNotice(`Frage "${modelName}"...`);

  try {
    const text = await client.suggest(prompt);
    const knownNodeIds = [...world.objects.keys()];
    const matchedToId = knownNodeIds.find((id) => text.trim().toLowerCase().includes(id.toLowerCase()));
    if (!matchedToId) {
      // Kein bekannter Ort in der Antwort erkannt — wird bewusst nicht als
      // bestätigbarer Vorschlag abgelegt, damit Kiesel nie einen erfundenen
      // Ort lernen kann. Bleibt aber nicht spurlos: als abgelehnter Vorschlag
      // im Ereignisprotokoll, damit künftige Durchläufe das sehen.
      run.log = appendRejectedSuggestionEvent(run.log, {
        id: `sugg${++suggestionCounter}`,
        time: Date.now(),
        suggestionText: text.trim(),
        reason: "kein bekannter Ort in der Antwort",
      });
      saveRunToStorage(run);
      render();
      showNotice(`"${modelName}" hat keinen bekannten Ort genannt. Antwort verworfen: "${text.trim()}"`);
      renderSuggestionsPanel();
      return;
    }
    const source = classifySuggestionSource(text);
    suggestionCounter += 1;
    run.suggestions = addSuggestion(getSuggestions(run), {
      id: `sugg${suggestionCounter}`,
      createdAt: Date.now(),
      fromId: lastTouchedNodeId,
      toId: matchedToId,
      text,
      modelName,
      source,
    });
    saveRunToStorage(run);
    if (source === "graph") {
      showNotice(`"${modelName}" hat sich erkennbar auf Graph-Wissen gestützt, das es nie bekommen hat. Vorschlag wird angezeigt, kann aber nicht bestätigt werden.`);
    } else {
      clearNotice();
    }
  } catch (error) {
    // Fallback: die Engine/der Rest der App laufen unbeeinflusst weiter —
    // hier passiert nichts außer einem Hinweis für den Menschen.
    showNotice(`Anfrage an "${modelName}" fehlgeschlagen: ${error.message}`);
  }
  renderSuggestionsPanel();
}

llmSuggestButton?.addEventListener("click", () => {
  const modelName = llmModelSelect?.value;
  if (!modelName) {
    showNotice("Bitte zuerst ein LLM aus der Liste auswählen.");
    return;
  }
  startLlmRound(createOllamaClient(modelName), modelName);
});

cloudSuggestButton?.addEventListener("click", () => {
  const provider = cloudProviderSelect?.value;
  const apiKey = cloudApiKeyInput?.value ?? "";
  const modelName = cloudModelSelect?.value;
  if (!provider || !apiKey || !modelName) {
    showNotice("Bitte Anbieter, Schlüssel und LLM auswählen (LLMs zuerst anzeigen lassen).");
    return;
  }
  const client =
    provider === "anthropic"
      ? createAnthropicClient(apiKey, modelName)
      : createOpenAiCompatibleClient(cloudBaseUrlInput.value.trim(), apiKey, modelName);
  startLlmRound(client, modelName);
});

function confirmSuggestionById(suggestionId) {
  const suggestion = getSuggestions(run).items.find((item) => item.id === suggestionId);
  if (!suggestion || suggestion.status !== "pending" || suggestion.source !== "event_log") return;
  // confirmSuggestion selbst weigert sich bereits, einen source:"graph"-
  // Vorschlag zu bestätigen (siehe llmSuggestions.ts) — die Prüfung hier
  // ist zusätzlich, damit der Lernschritt gar nicht erst versucht wird.
  const nextSuggestions = confirmSuggestion(getSuggestions(run), suggestionId);
  const confirmed = nextSuggestions.items.find((item) => item.id === suggestionId)?.status === "confirmed";
  if (!confirmed) return;
  // Bestätigung erzeugt denselben echten Lernschritt wie eine selbst
  // beobachtete Erfahrung (siehe touchObject) — keine Extra-Wissensquelle.
  run.learner = learnTransition(getLearner(run), suggestion.fromId, suggestion.toId);
  run.suggestions = nextSuggestions;
  saveRunToStorage(run);
  renderSuggestionsPanel();
  renderLearnerPanel();
}

function rejectSuggestionById(suggestionId) {
  const suggestion = getSuggestions(run).items.find((item) => item.id === suggestionId);
  run.suggestions = rejectSuggestion(getSuggestions(run), suggestionId);
  if (suggestion) {
    // Nicht gelöscht, sondern als eigene Ereignisart im Log sichtbar — ein
    // späterer LLM-Durchlauf (readEventLog) sieht so, was schon abgelehnt
    // wurde, und muss dieselbe Idee nicht erneut vorschlagen.
    run.log = appendRejectedSuggestionEvent(run.log, {
      id: `rej${suggestion.id}`,
      time: Date.now(),
      suggestionText: suggestion.text,
      reason: suggestion.source === "graph" ? "aus Graph-Wissen, nicht bestätigbar" : undefined,
    });
  }
  saveRunToStorage(run);
  render();
  renderSuggestionsPanel();
}

function renderSuggestionsPanel() {
  if (!suggestionsResult) return;
  suggestionsResult.replaceChildren();

  const items = getSuggestions(run).items;
  if (items.length === 0) {
    const message = document.createElement("p");
    message.textContent = "Noch keinen Rat eingeholt.";
    suggestionsResult.append(message);
    return;
  }

  const list = document.createElement("ul");
  for (const suggestion of [...items].reverse()) {
    const item = document.createElement("li");
    const sourceLabel = suggestion.source === "graph" ? "aus Graph-Wissen, nicht bestätigbar" : "aus Ereignisprotokoll";
    const summary = document.createElement("p");
    summary.textContent = `[${suggestion.modelName} · ${sourceLabel}] "${suggestion.fromId}" → "${suggestion.toId}" (${suggestion.status}): ${suggestion.text}`;
    item.append(summary);

    if (suggestion.status === "pending") {
      if (suggestion.source === "event_log") {
        const confirmButton = document.createElement("button");
        confirmButton.type = "button";
        confirmButton.textContent = "Bestätigen";
        confirmButton.addEventListener("click", () => confirmSuggestionById(suggestion.id));
        item.append(confirmButton);
      }

      const rejectButton = document.createElement("button");
      rejectButton.type = "button";
      rejectButton.textContent = "Verwerfen";
      rejectButton.addEventListener("click", () => rejectSuggestionById(suggestion.id));
      item.append(rejectButton);
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
