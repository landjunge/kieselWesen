import { afterEach, describe, expect, it, vi } from "vitest";
import { createOllamaClient, listOllamaModels } from "./ollamaClient.js";

describe("Ollama-Client — austauschbares lokales LLM", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sendet das konfigurierte Modell und den Prompt an den lokalen Ollama-Endpunkt", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({ response: "eine Antwort" }),
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createOllamaClient("llama3.2:3b");
    const result = await client.suggest("Was folgt auf n1?");

    expect(result).toBe("eine Antwort");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:11434/api/generate",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ model: "llama3.2:3b", prompt: "Was folgt auf n1?", stream: false });
  });

  it("das Modell ist austauschbar über den Konstruktor-Parameter", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({ response: "x" }),
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createOllamaClient("mistral:7b");
    expect(client.modelName).toBe("mistral:7b");
    await client.suggest("Frage");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.model).toBe("mistral:7b");
  });

  it("wirft einen Fehler, wenn der Ollama-Endpunkt nicht ok antwortet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, text: async () => "Server-Fehler" })),
    );
    const client = createOllamaClient("llama3.2:3b");
    await expect(client.suggest("Frage")).rejects.toThrow(/Ollama-Anfrage fehlgeschlagen/);
  });

  it("nutzt eine benutzerdefinierte baseUrl, falls angegeben", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ response: "x" }),
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createOllamaClient("llama3.2:3b", { baseUrl: "http://localhost:9999" });
    await client.suggest("Frage");
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:9999/api/generate", expect.anything());
  });

  it("listOllamaModels liefert die tatsächlich installierten Modellnamen — kein Raten nötig", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ models: [{ name: "llama3.2:3b" }, { name: "mistral:7b" }] }),
        text: async () => "",
      })),
    );
    expect(await listOllamaModels()).toEqual(["llama3.2:3b", "mistral:7b"]);
  });

  it("listOllamaModels liefert eine leere Liste, wenn nichts installiert ist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ models: [] }), text: async () => "" })),
    );
    expect(await listOllamaModels()).toEqual([]);
  });

  it("listOllamaModels wirft einen Fehler, wenn Ollama nicht erreichbar ist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, text: async () => "nicht erreichbar" })),
    );
    await expect(listOllamaModels()).rejects.toThrow(/Ollama-Modellliste fehlgeschlagen/);
  });
});
