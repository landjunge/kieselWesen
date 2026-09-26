/**
 * Vorschläge eines austauschbaren, lokalen LLM — kein automatisches Wissen.
 * Ein LLM ist bereits fertig trainiert und lernt zur Laufzeit nicht mehr
 * dazu; sein Vorschlag kann falsch/erfunden sein (Halluzination), unabhängig
 * von der Modellgröße. Deshalb fließt ein Vorschlag NIE automatisch in
 * Kiesels echtes Gedächtnis (Mini-Lerner/Ereignisprotokoll) ein — er bleibt
 * "pending", bis ein Mensch ihn bestätigt oder verwirft. Nur eine Bestätigung
 * erzeugt einen echten Lernschritt (siehe miniLearner.ts), identisch zu
 * einem selbst beobachteten Übergang. Das Modell selbst ist reiner
 * Konfigurationswert (Name/Endpunkt) und damit austauschbar.
 */

export interface Suggestion {
  id: string;
  createdAt: number;
  fromId: string;
  toId: string;
  text: string;
  modelName: string;
  status: "pending" | "confirmed" | "rejected";
}

export interface SuggestionState {
  items: Suggestion[];
}

export function createEmptySuggestions(): SuggestionState {
  return { items: [] };
}

export interface NewSuggestion {
  id: string;
  createdAt: number;
  fromId: string;
  toId: string;
  text: string;
  modelName: string;
}

/** Fügt einen neuen, noch unbestätigten Vorschlag hinzu. */
export function addSuggestion(state: SuggestionState, suggestion: NewSuggestion): SuggestionState {
  return { items: [...state.items, { ...suggestion, status: "pending" }] };
}

function setStatus(state: SuggestionState, id: string, status: Suggestion["status"]): SuggestionState {
  return {
    items: state.items.map((item) => (item.id === id ? { ...item, status } : item)),
  };
}

/** Verwirft einen Vorschlag folgenlos — er bleibt sichtbar, ändert aber nie Kiesels echtes Wissen. */
export function rejectSuggestion(state: SuggestionState, id: string): SuggestionState {
  return setStatus(state, id, "rejected");
}

/**
 * Markiert einen Vorschlag als bestätigt. Bestätigen allein verändert hier
 * noch keinen Lerner — der Aufrufer wendet dafür `learnTransition` auf den
 * bestätigten Übergang (fromId -> toId) an, exakt wie bei einer selbst
 * beobachteten Erfahrung.
 */
export function confirmSuggestion(state: SuggestionState, id: string): SuggestionState {
  return setStatus(state, id, "confirmed");
}

export function pendingSuggestions(state: SuggestionState): Suggestion[] {
  return state.items.filter((item) => item.status === "pending");
}
