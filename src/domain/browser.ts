/**
 * Barrel-Export für den Browser-Bundle. Bewusst ohne persistence.ts
 * (nutzt node:fs/promises, dort nicht verfügbar). runSerialization.ts
 * und compare.ts sind rein und funktionieren im Browser identisch zu
 * Node — Speicherung dort erfolgt über localStorage in app.js.
 */
export * from "./types.js";
export * from "./eventLog.js";
export * from "./innerModel.js";
export * from "./experimentEngine.js";
export * from "./worldObjects.js";
export * from "./runSerialization.js";
export * from "./uiAdapter.js";
export * from "./compare.js";
export * from "./miniLearner.js";
