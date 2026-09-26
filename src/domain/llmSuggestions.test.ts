import { describe, expect, it } from "vitest";
import {
  addSuggestion,
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
    });
    expect(state.items[0].modelName).toBe("mistral:7b");
  });

  it("createEmptySuggestions liefert einen leeren, unveränderlichen Ausgangszustand", () => {
    expect(createEmptySuggestions()).toEqual({ items: [] });
  });
});
