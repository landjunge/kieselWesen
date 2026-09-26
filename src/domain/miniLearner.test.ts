import { describe, expect, it } from "vitest";
import {
  createEmptyLearner,
  deserializeLearner,
  learnTransition,
  predictNext,
  serializeLearner,
} from "./miniLearner.js";

describe("Mini-Lerner — Vorhersage nächster Übergänge", () => {
  it("liefert keine Vorhersage für unbekannte Ausgangsknoten", () => {
    const state = createEmptyLearner();
    expect(predictNext(state, "plant")).toEqual([]);
  });

  it("ein einzelner beobachteter Übergang macht das Ziel zum wahrscheinlichsten", () => {
    let state = createEmptyLearner();
    state = learnTransition(state, "plant", "cat");
    const predictions = predictNext(state, "plant");
    expect(predictions[0].toId).toBe("cat");
    expect(predictions[0].probability).toBeGreaterThan(0.5);
  });

  it("wiederholtes Beobachten desselben Übergangs erhöht die Wahrscheinlichkeit weiter (bei konkurrierenden Zielen)", () => {
    let state = createEmptyLearner();
    state = learnTransition(state, "plant", "cat");
    state = learnTransition(state, "plant", "kieselwesen");
    const afterOneEach = predictNext(state, "plant").find((p) => p.toId === "cat")!.probability;
    state = learnTransition(state, "plant", "cat");
    const afterExtraCat = predictNext(state, "plant").find((p) => p.toId === "cat")!.probability;
    expect(afterExtraCat).toBeGreaterThan(afterOneEach);
  });

  it("konkurrierende Übergänge teilen sich die Wahrscheinlichkeit nachvollziehbar auf", () => {
    let state = createEmptyLearner();
    state = learnTransition(state, "plant", "cat");
    state = learnTransition(state, "plant", "kieselwesen");
    const predictions = predictNext(state, "plant");
    const total = predictions.reduce((sum, p) => sum + p.probability, 0);
    expect(total).toBeCloseTo(1, 10);
    expect(predictions).toHaveLength(2);
  });

  it("verschiedene Ausgangsknoten lernen unabhängig voneinander", () => {
    let state = createEmptyLearner();
    state = learnTransition(state, "plant", "cat");
    state = learnTransition(state, "cat", "kieselwesen");
    expect(predictNext(state, "plant").map((p) => p.toId)).toEqual(["cat"]);
    expect(predictNext(state, "cat").map((p) => p.toId)).toEqual(["kieselwesen"]);
  });

  it("ist deterministisch: gleiche Ereignisfolge + gleiche Lernrate erzeugen denselben Zustand", () => {
    function runSequence() {
      let state = createEmptyLearner();
      state = learnTransition(state, "plant", "cat");
      state = learnTransition(state, "cat", "kieselwesen");
      state = learnTransition(state, "plant", "cat");
      return predictNext(state, "plant");
    }
    expect(runSequence()).toEqual(runSequence());
  });

  it("lernt nicht heimlich rückwärts: der Ursprungszustand bleibt beim Lernschritt unverändert", () => {
    const before = createEmptyLearner();
    const after = learnTransition(before, "plant", "cat");
    expect(before.logits.size).toBe(0);
    expect(after.logits.size).toBe(1);
  });
});

describe("Mini-Lerner — Serialisierung", () => {
  it("serializeLearner/deserializeLearner sind verlustfreie Umkehrfunktionen", () => {
    let state = createEmptyLearner();
    state = learnTransition(state, "plant", "cat");
    state = learnTransition(state, "cat", "kieselwesen");
    state = learnTransition(state, "plant", "kieselwesen");

    const restored = deserializeLearner(serializeLearner(state));
    expect(predictNext(restored, "plant")).toEqual(predictNext(state, "plant"));
    expect(predictNext(restored, "cat")).toEqual(predictNext(state, "cat"));
  });

  it("serializeLearner liefert ein einfaches, JSON-taugliches Format", () => {
    let state = createEmptyLearner();
    state = learnTransition(state, "plant", "cat");
    const json = JSON.stringify(serializeLearner(state));
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
