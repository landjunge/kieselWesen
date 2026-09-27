import { describe, expect, it } from "vitest";
import {
  addSuggestion,
  classifySuggestionSource,
  confirmSuggestion,
  createEmptySuggestions,
  pendingSuggestions,
  rejectSuggestion,
} from "./llmSuggestions.js";

function seedSuggestion() {
  return addSuggestion(createEmptySuggestions(), {
    id: "s1",
    createdAt: 1,
    fromId: "n1",
    toId: "n2",
    text: "Vielleicht führt n1 oft zu n2.",
    modelName: "llama3.2:3b",
    source: "event_log",
  });
}

describe("LLM-Vorschläge — nie automatisches Wissen, nur nach Bestätigung", () => {
  it("ein neuer Vorschlag ist zunächst pending", () => {
    const state = seedSuggestion();
    expect(state.items).toHaveLength(1);
    expect(state.items[0].status).toBe("pending");
    expect(pendingSuggestions(state)).toHaveLength(1);
  });

  it("Bestätigen markiert den Vorschlag als confirmed, verändert sonst nichts", () => {
    const state = confirmSuggestion(seedSuggestion(), "s1");
    expect(state.items[0].status).toBe("confirmed");
    expect(pendingSuggestions(state)).toHaveLength(0);
    expect(state.items[0].fromId).toBe("n1");
    expect(state.items[0].toId).toBe("n2");
  });

  it("Verwerfen markiert den Vorschlag als rejected, er bleibt aber sichtbar", () => {
    const state = rejectSuggestion(seedSuggestion(), "s1");
    expect(state.items[0].status).toBe("rejected");
    expect(state.items).toHaveLength(1);
  });

  it("nur der angesprochene Vorschlag wird verändert, andere bleiben unberührt", () => {
    let state = seedSuggestion();
    state = addSuggestion(state, {
      id: "s2",
      createdAt: 2,
      fromId: "n2",
      toId: "n3",
      text: "Anderer Vorschlag.",
      modelName: "llama3.2:3b",
      source: "event_log",
    });
    state = confirmSuggestion(state, "s1");
    expect(state.items.find((i) => i.id === "s1")?.status).toBe("confirmed");
    expect(state.items.find((i) => i.id === "s2")?.status).toBe("pending");
  });

  it("das Modell ist austauschbar: modelName ist reiner Datenwert am Vorschlag", () => {
    const state = addSuggestion(createEmptySuggestions(), {
      id: "s1",
      createdAt: 1,
      fromId: "n1",
      toId: "n2",
      text: "Anderes Modell.",
      modelName: "mistral:7b",
      source: "event_log",
    });
    expect(state.items[0].modelName).toBe("mistral:7b");
  });

  it("createEmptySuggestions liefert einen leeren, unveränderlichen Ausgangszustand", () => {
    expect(createEmptySuggestions()).toEqual({ items: [] });
  });
});

describe("Quellentrennung — LLM darf nur aus dem Ereignisprotokoll lernen, nie aus dem Graphen", () => {
  it("addSuggestion lehnt einen Vorschlag ohne gültige source-Angabe ab", () => {
    expect(() =>
      addSuggestion(createEmptySuggestions(), {
        id: "s1",
        createdAt: 1,
        fromId: "n1",
        toId: "n2",
        text: "Ohne Quelle.",
        modelName: "llama3.2:3b",
        // @ts-expect-error absichtlich ungültig, um die Ablehnung zu testen
        source: "irgendwas",
      }),
    ).toThrow(/source/);
  });

  it("classifySuggestionSource erkennt reine Ereignis-Sprache als event_log", () => {
    expect(classifySuggestionSource("Nach dem Klick auf n1 folgte oft n2.")).toBe("event_log");
  });

  it("classifySuggestionSource erkennt Graph-Vokabular (z.B. Kantenstärke) als graph", () => {
    expect(classifySuggestionSource("Die Kante zur Pflanze ist stark, also folgt vermutlich sie.")).toBe("graph");
  });

  it("ein als graph markierter Vorschlag lässt sich nie bestätigen und landet nie im Lernschritt", () => {
    let state = addSuggestion(createEmptySuggestions(), {
      id: "s1",
      createdAt: 1,
      fromId: "n1",
      toId: "plant",
      text: "Die Kante zur Pflanze ist stark, also folgt vermutlich sie.",
      modelName: "llama3.2:3b",
      source: "graph",
    });

    state = confirmSuggestion(state, "s1");
    // Bleibt trotz Bestätigungsversuch "pending" — kein Statuswechsel, also
    // löst der Aufrufer (app.js) auch keinen learnTransition-Schritt aus.
    expect(state.items[0].status).toBe("pending");

    // Auch ein zweiter Versuch ändert nichts.
    state = confirmSuggestion(state, "s1");
    expect(state.items[0].status).toBe("pending");
  });

  it("ein event_log-Vorschlag lässt sich normal bestätigen", () => {
    let state = addSuggestion(createEmptySuggestions(), {
      id: "s1",
      createdAt: 1,
      fromId: "n1",
      toId: "n2",
      text: "Nach n1 folgte zuletzt n2.",
      modelName: "llama3.2:3b",
      source: "event_log",
    });
    state = confirmSuggestion(state, "s1");
    expect(state.items[0].status).toBe("confirmed");
  });
});
