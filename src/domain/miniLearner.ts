/**
 * Winziges, eigenes lernendes Modell (kein fertiges/externes LLM, keine
 * externe Wissensbibliothek — passend zu den Leitplanken des Bauplans).
 * Lernt ausschließlich aus KieselWesens eigenen Ereignissen: welcher
 * Knoten als Nächstes berührt wird, nachdem ein bestimmter Knoten berührt
 * wurde. Ein Softmax-Klassifikator pro Ausgangsknoten, trainiert mit
 * einem einzelnen Gradientenschritt je beobachtetem Übergang.
 *
 * Deterministisch: gleiche Ereignisfolge + gleiche Lernrate erzeugen
 * immer denselben gelernten Zustand. Keine erfundene Bedeutung — die
 * Vorhersage ist eine reine Wahrscheinlichkeitsverteilung über bereits
 * beobachtete Übergänge, keine Interpretation.
 */

export interface LearnerState {
  /** von-Knoten-ID -> (zu-Knoten-ID -> Logit) */
  logits: Map<string, Map<string, number>>;
}

export interface SerializedLearnerState {
  logits: [string, [string, number][]][];
}

export function createEmptyLearner(): LearnerState {
  return { logits: new Map() };
}

export function serializeLearner(state: LearnerState): SerializedLearnerState {
  return {
    logits: [...state.logits.entries()].map(([fromId, row]) => [fromId, [...row.entries()]]),
  };
}

export function deserializeLearner(data: SerializedLearnerState): LearnerState {
  return {
    logits: new Map(data.logits.map(([fromId, row]) => [fromId, new Map(row)])),
  };
}

function softmax(entries: [string, number][]): Map<string, number> {
  const max = Math.max(...entries.map(([, v]) => v));
  const exps = entries.map(([k, v]) => [k, Math.exp(v - max)] as [string, number]);
  const sum = exps.reduce((s, [, v]) => s + v, 0);
  return new Map(exps.map(([k, v]) => [k, sum === 0 ? 0 : v / sum]));
}

export interface Prediction {
  toId: string;
  probability: number;
}

/**
 * Gelernte Vorhersage, welcher Knoten nach `fromId` als Nächstes berührt
 * wird — absteigend nach Wahrscheinlichkeit. Leer, wenn noch nichts von
 * diesem Knoten aus beobachtet wurde.
 */
export function predictNext(state: LearnerState, fromId: string): Prediction[] {
  const row = state.logits.get(fromId);
  if (!row || row.size === 0) return [];
  const probs = softmax([...row.entries()]);
  return [...probs.entries()]
    .map(([toId, probability]) => ({ toId, probability }))
    .sort((a, b) => b.probability - a.probability);
}

/**
 * Ein einzelner Lernschritt: der beobachtete Übergang fromId -> toId
 * bekommt einen Gradientenschritt Richtung höherer Wahrscheinlichkeit,
 * alle anderen bereits bekannten Ziele von fromId entsprechend niedriger
 * (Standard-Softmax-Gradient). Mutiert den übergebenen Zustand nicht.
 */
export function learnTransition(
  state: LearnerState,
  fromId: string,
  toId: string,
  learningRate = 0.5,
): LearnerState {
  const nextLogits = new Map(state.logits);
  const row = new Map(nextLogits.get(fromId) ?? []);
  if (!row.has(toId)) row.set(toId, 0);

  const entries = [...row.entries()];
  const probs = softmax(entries);
  for (const [id, logit] of entries) {
    const p = probs.get(id) ?? 0;
    const target = id === toId ? 1 : 0;
    row.set(id, logit + learningRate * (target - p));
  }

  nextLogits.set(fromId, row);
  return { logits: nextLogits };
}
