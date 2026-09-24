import { createGraph3DView } from "./graph3d.js";

declare global {
  interface Window {
    KieselWesenGraph3D: { createGraph3DView: typeof createGraph3DView };
  }
}

window.KieselWesenGraph3D = { createGraph3DView };
