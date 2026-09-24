/**
 * Barrel-Export für den Browser-Bundle. Bewusst ohne persistence.ts
 * (nutzt node:fs/promises, dort nicht verfügbar).
 */
export * from "./types.js";
export * from "./eventLog.js";
export * from "./innerModel.js";
export * from "./experimentEngine.js";
export * from "./worldObjects.js";
export * from "./uiAdapter.js";
