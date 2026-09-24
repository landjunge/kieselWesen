import { describe, expect, it } from "vitest";
import {
  ROOM_GRID_SIZE,
  createEmptyWorld,
  moveObject,
  placeObject,
  seedInitialRoom,
} from "./worldObjects.js";

describe("Weltobjekte", () => {
  it("lässt sich innerhalb des Rasters platzieren", () => {
    let state = createEmptyWorld();
    state = placeObject(state, {
      id: "n1",
      type: "clutter",
      position: { x: 0, y: 0 },
      size: { width: 4, height: 4 },
      visualRef: "clutter",
    });
    expect(state.objects.get("n1")?.position).toEqual({ x: 0, y: 0 });
  });

  it("verweigert Platzierung außerhalb des 64x64-Rasters", () => {
    const state = createEmptyWorld();
    expect(() =>
      placeObject(state, {
        id: "n1",
        type: "clutter",
        position: { x: ROOM_GRID_SIZE - 1, y: 0 },
        size: { width: 4, height: 4 },
        visualRef: "clutter",
      }),
    ).toThrow(/does not fit/);
  });

  it("bewegt ein Objekt innerhalb der Grenzen, verweigert ein Verlassen des Rasters", () => {
    let state = createEmptyWorld();
    state = placeObject(state, {
      id: "n1",
      type: "clutter",
      position: { x: 0, y: 0 },
      size: { width: 4, height: 4 },
      visualRef: "clutter",
    });
    state = moveObject(state, "n1", { x: 10, y: 10 });
    expect(state.objects.get("n1")?.position).toEqual({ x: 10, y: 10 });
    expect(() => moveObject(state, "n1", { x: ROOM_GRID_SIZE, y: 0 })).toThrow(/would leave/);
  });
});

describe("Zimmer V1", () => {
  it("enthält genau die vereinbarten Objekte, keine zusätzliche Pflanze", () => {
    const state = seedInitialRoom();
    const types = [...state.objects.values()].map((o) => o.type).sort();
    expect(types).toEqual(["bed", "cat", "clutter", "kieselwesen", "plant"]);
    expect(types.filter((t) => t === "plant")).toHaveLength(1);
  });

  it("Bett und Pflanze entsprechen den vereinbarten Größen", () => {
    const state = seedInitialRoom();
    expect(state.objects.get("bed")?.size).toEqual({ width: 8, height: 12 });
    expect(state.objects.get("plant")?.size).toEqual({ width: 3, height: 3 });
  });

  it("alle Objekte liegen vollständig innerhalb des Rasters", () => {
    const state = seedInitialRoom();
    for (const obj of state.objects.values()) {
      expect(obj.position.x).toBeGreaterThanOrEqual(0);
      expect(obj.position.y).toBeGreaterThanOrEqual(0);
      expect(obj.position.x + obj.size.width).toBeLessThanOrEqual(ROOM_GRID_SIZE);
      expect(obj.position.y + obj.size.height).toBeLessThanOrEqual(ROOM_GRID_SIZE);
    }
  });
});
