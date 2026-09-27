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
 *
 * Quellentrennung (gegen Zirkularität): das LLM darf als Kontext NUR das
 * Ereignisprotokoll bekommen (readEventLog in eventLog.ts), nie den Graphen
 * (Kanten/Stärken/Aktivierung). Jeder Vorschlag trägt deshalb eine
 * verpflichtende `source`-Angabe. Ein Vorschlag, dessen Text erkennbar aus
 * Graph-Wissen stammt (z.B. Kantenstärke), wird als "graph" markiert und
 * kann nie bestätigt/gelernt werden — nur ein "event_log"-Vorschlag kann das.
 */

export type SuggestionSource = "event_log" | "graph";

export interface Suggestion {
  id: string;
  createdAt: number;
  fromId: string;
  toId: string;
  text: string;
  modelName: string;
  source: SuggestionSource;
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
  source: SuggestionSource;
}

const VALID_SOURCES: readonly SuggestionSource[] = ["event_log", "graph"];

/**
 * Fügt einen neuen, noch unbestätigten Vorschlag hinzu. Ein Vorschlag ohne
 * gültige `source`-Angabe wird abgelehnt (Fehler), statt stillschweigend
 * angenommen zu werden — jede Wissensquelle muss benannt sein.
 */
export function addSuggestion(state: SuggestionState, suggestion: NewSuggestion): SuggestionState {
  if (!VALID_SOURCES.includes(suggestion.source)) {
    throw new Error(`Vorschlag ohne gültige source-Angabe abgelehnt: "${String(suggestion.source)}"`);
  }
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
 * Markiert einen Vorschlag als bestätigt — aber NUR, wenn seine Quelle das
 * Ereignisprotokoll ist. Ein als "graph" markierter Vorschlag bleibt
 * unverändert "pending", ganz gleich wie oft confirmSuggestion darauf
 * aufgerufen wird: er kann so nie einen Lernschritt auslösen. Bestätigen
 * allein verändert hier noch keinen Lerner — der Aufrufer wendet dafür
 * `learnTransition` auf den bestätigten Übergang (fromId -> toId) an, exakt
 * wie bei einer selbst beobachteten Erfahrung, und tut das nur, wenn der
 * Status hier tatsächlich auf "confirmed" gewechselt ist.
 */
export function confirmSuggestion(state: SuggestionState, id: string): SuggestionState {
  const suggestion = state.items.find((item) => item.id === id);
  if (!suggestion || suggestion.status !== "pending" || suggestion.source !== "event_log") return state;
  return setStatus(state, id, "confirmed");
}

export function pendingSuggestions(state: SuggestionState): Suggestion[] {
  return state.items.filter((item) => item.status === "pending");
}

/**
 * Wörter, die nur aus dem inneren Graphen (Kanten/Stärke/Aktivierung)
 * stammen können, nicht aus reinen Ereignisdaten (Zeit, Typ, Beteiligte).
 * Rein heuristisch: dient nur dazu, eine Antwort zu erkennen, die sich
 * erkennbar auf Graph-Wissen stützt, das dem LLM nie gegeben wurde.
 */
const GRAPH_ONLY_TERMS = ["kante", "kanten", "stark", "stärke", "verbindung", "aktivierung", "graph"];

/**
 * Ordnet einer LLM-Antwort ihre Quelle zu. Enthält der Text erkennbares
 * Graph-Vokabular, gilt er als "graph" — unabhängig davon, ob der Prompt
 * selbst nur Ereignisdaten enthielt (ein LLM kann sich Dinge ausdenken).
 * Alles andere gilt als "event_log".
 */
export function classifySuggestionSource(text: string): SuggestionSource {
  const lower = text.toLowerCase();
  return GRAPH_ONLY_TERMS.some((term) => lower.includes(term)) ? "graph" : "event_log";
}
