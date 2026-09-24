// Verbindet den Code-Unterbau (src/domain) mit der UI aus main.js.
// Keine erfundenen Simulationswerte: jeder Zustand kommt aus echten
// Ereignissen (Objektberührung im Raum) über den getesteten Versuchsmotor.
import {
  allRulesEnabled,
  appendEvent,
  applyEventToPair,
  applyEventToSingleNode,
  createEmptyLog,
  createEmptyModel,
  createNode,
  demoEngineParams,
  ensureEdge,
  seedInitialRoom,
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

let world = seedInitialRoom();
let run = {
  runId: "lokal-vorschau",
  seed: "lokal",
  createdAt: Date.now(),
  restActive: false,
  model: createEmptyModel(),
  log: createEmptyLog(),
  engineConfig: { params: demoEngineParams, rulesEnabled: allRulesEnabled },
};
let eventCounter = 0;
let lastTouchedNodeId = null;

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

  render();
}

for (const element of document.querySelectorAll(".room-object")) {
  const worldId = OBJECT_ID_BY_CLASS[[...element.classList].find((c) => c in OBJECT_ID_BY_CLASS)];
  if (!worldId) continue;
  element.addEventListener("click", () => touchObject(worldId, element.dataset.object ?? worldId));
}

render();
