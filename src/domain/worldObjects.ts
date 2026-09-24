/**
 * Technische Rastergröße für Box 1 (Raum). Dient nur Position, Größe,
 * Bewegung und Kollision — im UI nie sichtbar.
 */
export const ROOM_GRID_SIZE = 64;

export interface GridPosition {
  x: number;
  y: number;
}

export interface GridSize {
  width: number;
  height: number;
}

export type WorldObjectType = "kieselwesen" | "cat" | "plant" | "clutter" | "bed";

export interface WorldObject {
  id: string;
  type: WorldObjectType;
  position: GridPosition;
  size: GridSize;
  /** Referenz für die UI-Darstellung, keine Simulationsgröße. */
  visualRef: string;
  state?: Record<string, unknown>;
}

export interface WorldState {
  objects: ReadonlyMap<string, WorldObject>;
}

export function createEmptyWorld(): WorldState {
  return { objects: new Map() };
}

function isWithinGrid(position: GridPosition, size: GridSize): boolean {
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x + size.width <= ROOM_GRID_SIZE &&
    position.y + size.height <= ROOM_GRID_SIZE
  );
}

export function placeObject(
  state: WorldState,
  input: { id: string; type: WorldObjectType; position: GridPosition; size: GridSize; visualRef: string; state?: Record<string, unknown> },
): WorldState {
  if (!isWithinGrid(input.position, input.size)) {
    throw new Error(`object ${input.id} does not fit the ${ROOM_GRID_SIZE}x${ROOM_GRID_SIZE} grid`);
  }
  const object: WorldObject = {
    id: input.id,
    type: input.type,
    position: input.position,
    size: input.size,
    visualRef: input.visualRef,
    state: input.state,
  };
  const objects = new Map(state.objects);
  objects.set(object.id, object);
  return { objects };
}

export function moveObject(state: WorldState, id: string, position: GridPosition): WorldState {
  const object = state.objects.get(id);
  if (!object) throw new Error(`unknown world object: ${id}`);
  if (!isWithinGrid(position, object.size)) {
    throw new Error(`object ${id} would leave the ${ROOM_GRID_SIZE}x${ROOM_GRID_SIZE} grid`);
  }
  const objects = new Map(state.objects);
  objects.set(id, { ...object, position });
  return { objects };
}

/**
 * Die für V1 fest vereinbarten Zimmerobjekte (Bauplan Abschnitt 5):
 * KieselWesen, Katze, genau eine Pflanze, Kiste/Krams, Bett als
 * Größenreferenz. Positionen sind Platzhalter, kollisionsfrei verteilt.
 */
export function seedInitialRoom(): WorldState {
  let state = createEmptyWorld();
  state = placeObject(state, {
    id: "bed",
    type: "bed",
    position: { x: 2, y: 2 },
    size: { width: 8, height: 12 },
    visualRef: "bed",
  });
  state = placeObject(state, {
    id: "plant",
    type: "plant",
    position: { x: 14, y: 2 },
    size: { width: 3, height: 3 },
    visualRef: "plant",
  });
  state = placeObject(state, {
    id: "clutter",
    type: "clutter",
    position: { x: 20, y: 2 },
    size: { width: 4, height: 4 },
    visualRef: "clutter",
  });
  state = placeObject(state, {
    id: "cat",
    type: "cat",
    position: { x: 30, y: 30 },
    size: { width: 2, height: 2 },
    visualRef: "cat",
  });
  state = placeObject(state, {
    id: "kieselwesen",
    type: "kieselwesen",
    position: { x: 40, y: 40 },
    size: { width: 2, height: 2 },
    visualRef: "kieselwesen",
  });
  return state;
}
