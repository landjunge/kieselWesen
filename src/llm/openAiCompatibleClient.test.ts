import { afterEach, describe, expect, it, vi } from "vitest";
import { createOpenAiCompatibleClient, listOpenAiCompatibleModels } from "./openAiCompatibleClient.js";

describe("OpenAI-kompatibler Client — beliebiger Cloud-Anbieter (z.B. DeepSeek)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sendet API-Key, Modell und Prompt an die angegebene baseUrl", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "cat" } }] }),
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createOpenAiCompatibleClient("https://api.deepseek.com", "sk-test", "deepseek-chat");
    const result = await client.suggest("Was folgt auf n1?");

    expect(result).toBe("cat");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe("deepseek-chat");
  });

  it("wirft einen Fehler, wenn der Anbieter nicht ok antwortet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401, text: async () => "ungültiger Schlüssel" })),
    );
    const client = createOpenAiCompatibleClient("https://api.deepseek.com", "sk-invalid", "deepseek-chat");
    await expect(client.suggest("Frage")).rejects.toThrow(/fehlgeschlagen/);
  });

  it("listOpenAiCompatibleModels liefert die verfügbaren Modell-IDs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: [{ id: "deepseek-chat" }, { id: "deepseek-reasoner" }] }),
        text: async () => "",
      })),
    );
    const models = await listOpenAiCompatibleModels("https://api.deepseek.com", "sk-test");
    expect(models).toEqual(["deepseek-chat", "deepseek-reasoner"]);
  });

  it("listOpenAiCompatibleModels wirft einen Fehler bei fehlgeschlagener Anfrage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 403, text: async () => "verboten" })),
    );
    await expect(listOpenAiCompatibleModels("https://api.deepseek.com", "sk-bad")).rejects.toThrow(/fehlgeschlagen/);
  });
});
