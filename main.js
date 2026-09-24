const tabs = [...document.querySelectorAll('[role="tab"]')];
for (const tab of tabs) {
  tab.addEventListener('click', () => {
    for (const item of tabs) {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
    }
  });
  tab.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const next = tabs[(tabs.indexOf(tab) + direction + tabs.length) % tabs.length];
    next.focus();
    next.click();
  });
}

const room = document.getElementById('room');
let zoom = 1;
function setZoom(value) {
  zoom = Math.max(0.75, Math.min(1.75, value));
  room.style.transform = `scale(${zoom})`;
  document.getElementById('zoom-value').textContent = `${Math.round(zoom * 100)} %`;
  document.getElementById('zoom-out').disabled = zoom <= 0.75;
  document.getElementById('zoom-in').disabled = zoom >= 1.75;
}
document.getElementById('zoom-out').addEventListener('click', () => setZoom(zoom - 0.25));
document.getElementById('zoom-in').addEventListener('click', () => setZoom(zoom + 0.25));
for (const object of document.querySelectorAll('.room-object')) {
  object.addEventListener('click', () => {
    document.querySelector('.room-object.is-selected')?.classList.remove('is-selected');
    object.classList.add('is-selected');
    document.getElementById('object-info').textContent = `Ausgewählt: ${object.dataset.object}`;
  });
}

// The simulation sends observed values here. No values are fabricated by the UI.
// window.KieselWesenUI.update({status, event, state, nodes, edges, history, position})
// nodes: [{id, label, x, y, activation, position3d:{x,y,z}}], x/y in [0,1] (2D-Hilfswerte);
// position3d: echte unnormierte Koordinaten aus dem unbegrenzten inneren Raum, für die
// 3D-Ansicht. edges: [{source, target, weight}]; position: {x, y}, integer room coords [0, 63].
let graph3dView = null;
function renderGraph(nodes, edges) {
  const stage = document.getElementById('graph-stage');
  const hasNodes = Array.isArray(nodes) && nodes.length > 0;
  if (!hasNodes) {
    graph3dView?.dispose();
    graph3dView = null;
    stage.replaceChildren();
    const message = document.createElement('p');
    message.textContent = 'Noch keine Knotendaten.';
    stage.append(message);
    return;
  }
  if (!graph3dView) {
    stage.replaceChildren();
    graph3dView = window.KieselWesenGraph3D.createGraph3DView(stage);
  }
  graph3dView.render(nodes, edges);
  // Testschnittstelle (kein UI-Feature): erlaubt automatisierten Tests zu
  // prüfen, dass Aktivierung sich tatsächlich in unterschiedlicher
  // Knotengröße niederschlägt, ohne in die WebGL-Szene hineinzusehen.
  window.__kieselwesenGraph3DDebug = { nodeCount: nodes.length, radii: graph3dView.getLastNodeRadii() };
}
function renderHistory(history) {
  const list = document.getElementById('history-list');
  list.replaceChildren();
  if (!Array.isArray(history) || !history.length) {
    const message = document.createElement('p');
    message.textContent = 'Noch keine Ereignisse.';
    list.append(message);
    return;
  }
  const ordered = document.createElement('ol');
  for (const entry of history.slice(-100).reverse()) {
    const item = document.createElement('li');
    item.textContent = String(entry?.label ?? entry?.event ?? entry);
    ordered.append(item);
  }
  list.append(ordered);
}
function update(data = {}) {
  document.getElementById('simulation-status').textContent = String(data.status ?? 'Warte auf Simulationsdaten');
  document.getElementById('current-event').textContent = String(data.event ?? 'Noch kein Ereignis.');
  const stateList = document.getElementById('state-list');
  stateList.replaceChildren();
  const heading = document.createElement('span');
  heading.className = 'eyebrow';
  heading.textContent = 'ZUSTAND';
  stateList.append(heading);
  const entries = data.state && typeof data.state === 'object' ? Object.entries(data.state) : [];
  if (!entries.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Noch keine Zustandsdaten.';
    stateList.append(empty);
  }
  for (const [name, value] of entries) {
    const row = document.createElement('div');
    row.className = 'state-row';
    const key = document.createElement('span');
    key.textContent = name;
    const val = document.createElement('strong');
    val.textContent = String(value);
    row.append(key, val);
    stateList.append(row);
  }
  renderGraph(data.nodes, data.edges);
  renderHistory(data.history);
  if (data.position && Number.isInteger(data.position.x) && Number.isInteger(data.position.y)
      && data.position.x >= 0 && data.position.x < 64 && data.position.y >= 0 && data.position.y < 64) {
    const being = document.querySelector('.kiesel');
    being.style.left = `${data.position.x / 64 * 100}%`;
    being.style.top = `${data.position.y / 64 * 100}%`;
  }
}
window.KieselWesenUI = Object.freeze({update});
window.addEventListener('kieselwesen:state', event => update(event.detail));
