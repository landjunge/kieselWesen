/**
 * Anbindung an ein großes, externes LLM über die Anthropic-API — für
 * allgemeines Weltwissen, das das kleine lokale Modell (ollamaClient.ts)
 * nicht hat. Anders als das lokale Modell läuft diese Anfrage über das
 * Internet an einen fremden Server; deshalb bewusst als zweite, getrennte
 * Quelle, nicht als Ersatz. Erfüllt dieselbe LlmClient-Schnittstelle wie
 * ollamaClient.ts — beide münden im selben Bestätigungs-Workflow
 * (llmSuggestions.ts): auch ein "großes" Modell wird nicht ungeprüft
 * übernommen, es kann sich genauso irren.
 */
import type { LlmClient } from "./ollamaClient.js";

export interface AnthropicClientOptions {
  baseUrl?: string;
  maxTokens?: number;
}

export function createAnthropicClient(
  apiKey: string,
  modelName: string,
  options: AnthropicClientOptions = {},
): LlmClient {
  const baseUrl = options.baseUrl ?? "https://api.anthropic.com";
  const maxTokens = options.maxTokens ?? 200;
  return {
    modelName,
    async suggest(prompt: string): Promise<string> {
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: modelName,
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!response.ok) {
        throw new Error(`Anthropic-Anfrage fehlgeschlagen (${response.status}): ${await response.text()}`);
      }
      const data = (await response.json()) as { content?: { type: string; text?: string }[] };
      return data.content?.find((block) => block.type === "text")?.text ?? "";
    },
  };
}

/**
 * Fragt die Anthropic-API selbst, welche Modelle mit diesem Schlüssel
 * verfügbar sind — statt dass der Mensch einen Modellnamen erraten muss.
 */
export async function listAnthropicModels(apiKey: string, options: AnthropicClientOptions = {}): Promise<string[]> {
  const baseUrl = options.baseUrl ?? "https://api.anthropic.com";
  const response = await fetch(`${baseUrl}/v1/models`, {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
  });
  if (!response.ok) {
    throw new Error(`Anthropic-Modellliste fehlgeschlagen (${response.status}): ${await response.text()}`);
  }
  const data = (await response.json()) as { data?: { id: string }[] };
  return (data.data ?? []).map((model) => model.id);
}
