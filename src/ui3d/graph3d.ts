import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * Echte 3D-Ansicht des Innenlebens (Bauplan Box 3 / Phase 6): nutzt die
 * tatsächlichen, unnormierten Knotenpositionen aus dem unbegrenzten
 * inneren Raum, sodass Straßenlängen der echten geometrischen Entfernung
 * entsprechen. Kamera lässt sich drehen und zoomen (OrbitControls).
 *
 * Sichtbare Kanäle, strikt getrennt:
 * - Distanz: räumliche Position/Länge der Verbindungslinien.
 * - Nutzung/Stärke einer Verbindung: Farbhelligkeit der Linie
 *   (Liniendicke wird von WebGL nicht zuverlässig unterstützt).
 * - Aktivierung eines Knotens: Kugelradius und Deckkraft.
 *
 * Keine erfundenen Simulationswerte — alle drei Kanäle stammen aus dem
 * bereits vorhandenen, getesteten UI-Payload (toUiPayload).
 */

export interface Graph3DNode {
  id: string;
  label: string;
  activation: number;
  position3d: { x: number; y: number; z: number };
}

export interface Graph3DEdge {
  source: string;
  target: string;
  weight: number;
}

export interface Graph3DView {
  render(nodes: Graph3DNode[], edges: Graph3DEdge[]): void;
  dispose(): void;
  /** Für automatisierte Tests: Radien der zuletzt gerenderten Knoten. */
  getLastNodeRadii(): number[];
}

export function createGraph3DView(container: HTMLElement): Graph3DView {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.append(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  let group = new THREE.Group();
  scene.add(group);
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.6);
  keyLight.position.set(1, 1, 1);
  scene.add(keyLight);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hitTargets: { mesh: THREE.Object3D; node: Graph3DNode }[] = [];

  function resize() {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  function onPointerMove(event: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(hitTargets.map((t) => t.mesh));
    if (hit.length > 0) {
      const found = hitTargets.find((t) => t.mesh === hit[0].object);
      if (found) {
        const percentOfMax = Math.round(found.node.activation * 100);
        container.title = `${found.node.label} — Aktivierung: ${percentOfMax} % vom aktuell höchsten Wert`;
        return;
      }
    }
    container.title = "";
  }
  renderer.domElement.addEventListener("pointermove", onPointerMove);

  let lastNodeRadii: number[] = [];

  function render(nodes: Graph3DNode[], edges: Graph3DEdge[]) {
    scene.remove(group);
    group = new THREE.Group();
    scene.add(group);
    hitTargets = [];
    lastNodeRadii = [];

    if (nodes.length === 0) {
      renderer.render(scene, camera);
      return;
    }

    const byId = new Map(nodes.map((n) => [n.id, n]));

    for (const edge of edges) {
      const from = byId.get(edge.source);
      const to = byId.get(edge.target);
      if (!from || !to) continue;
      const points = [
        new THREE.Vector3(from.position3d.x, from.position3d.y, from.position3d.z),
        new THREE.Vector3(to.position3d.x, to.position3d.y, to.position3d.z),
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      // Nutzung/Stärke: Farbhelligkeit, nicht Distanz und nicht Aktivierung.
      const brightness = 0.35 + Math.max(0, Math.min(1, edge.weight)) * 0.65;
      const material = new THREE.LineBasicMaterial({ color: new THREE.Color(brightness, brightness, brightness) });
      group.add(new THREE.Line(geometry, material));
    }

    for (const node of nodes) {
      const activation = Math.max(0, Math.min(1, node.activation));
      const radius = 0.3 + activation * 0.5;
      const geometry = new THREE.SphereGeometry(radius, 16, 16);
      const material = new THREE.MeshStandardMaterial({
        color: 0xd9e4df,
        transparent: true,
        opacity: 0.45 + activation * 0.55,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(node.position3d.x, node.position3d.y, node.position3d.z);
      group.add(mesh);
      hitTargets.push({ mesh, node });
      lastNodeRadii.push(radius);
    }

    // Kamera auf die Bounding Box aller Knoten einpassen — ein einzelner
    // Skalierungsfaktor für alle Achsen, damit Distanzverhältnisse nicht
    // verzerrt werden.
    const box = new THREE.Box3().setFromObject(group);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const center = sphere.center;
    const radius = Math.max(sphere.radius, 1);
    controls.target.copy(center);
    const distance = radius / Math.sin((camera.fov * Math.PI) / 360) + radius * 0.3;
    const direction = camera.position.clone().sub(center);
    if (direction.lengthSq() === 0) direction.set(0, 0, 1);
    direction.normalize().multiplyScalar(distance);
    camera.position.copy(center).add(direction);
    camera.near = Math.max(0.01, distance / 100);
    camera.far = distance * 100;
    camera.updateProjectionMatrix();
    controls.update();

    renderer.render(scene, camera);
  }

  let animating = true;
  function animate() {
    if (!animating) return;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  function dispose() {
    animating = false;
    resizeObserver.disconnect();
    renderer.domElement.removeEventListener("pointermove", onPointerMove);
    controls.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }

  return { render, dispose, getLastNodeRadii: () => lastNodeRadii };
}
