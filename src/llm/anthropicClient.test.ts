import { afterEach, describe, expect, it, vi } from "vitest";
import { createAnthropicClient } from "./anthropicClient.js";

describe("Anthropic-Client — großes, externes Modell als zweite, getrennte Quelle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sendet API-Key, Modell und Prompt an die Anthropic-API", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({ content: [{ type: "text", text: "cat" }] }),
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createAnthropicClient("sk-test-key", "claude-sonnet-5");
    const result = await client.suggest("Was folgt auf n1?");

    expect(result).toBe("cat");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({ method: "POST" }),
    );
    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-test-key");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      model: "claude-sonnet-5",
      max_tokens: 200,
      messages: [{ role: "user", content: "Was folgt auf n1?" }],
    });
  });

  it("das Modell ist austauschbar über den Konstruktor-Parameter", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({ content: [{ type: "text", text: "x" }] }),
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createAnthropicClient("sk-test-key", "claude-opus-5-5");
    expect(client.modelName).toBe("claude-opus-5-5");
    await client.suggest("Frage");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.model).toBe("claude-opus-5-5");
  });

  it("wirft einen Fehler, wenn die Anthropic-API nicht ok antwortet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401, text: async () => "ungültiger API-Key" })),
    );
    const client = createAnthropicClient("sk-invalid", "claude-sonnet-5");
    await expect(client.suggest("Frage")).rejects.toThrow(/Anthropic-Anfrage fehlgeschlagen/);
  });

  it("liefert einen leeren String, wenn keine Text-Antwort enthalten ist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ content: [] }), text: async () => "" })),
    );
    const client = createAnthropicClient("sk-test-key", "claude-sonnet-5");
    expect(await client.suggest("Frage")).toBe("");
  });
});
