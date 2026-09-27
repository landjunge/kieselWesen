/**
 * Anbindung an jeden Cloud-Anbieter, der die verbreitete OpenAI-kompatible
 * API-Form anbietet (z.B. DeepSeek, oder viele andere) — ein Kiesel-Nutzer
 * soll nicht auf einen einzigen Anbieter (Anthropic) festgelegt sein. Nur
 * die baseUrl unterscheidet die Anbieter; die Anfrageform ist identisch.
 * Erfüllt dieselbe LlmClient-Schnittstelle wie ollamaClient.ts/
 * anthropicClient.ts — auch dieses Modell mündet im selben
 * Bestätigungs-Workflow, kein automatisches Übernehmen von Antworten.
 */
import type { LlmClient } from "./ollamaClient.js";

export interface OpenAiCompatibleOptions {
  maxTokens?: number;
}

export function createOpenAiCompatibleClient(
  baseUrl: string,
  apiKey: string,
  modelName: string,
  options: OpenAiCompatibleOptions = {},
): LlmClient {
  const maxTokens = options.maxTokens ?? 200;
  return {
    modelName,
    async suggest(prompt: string): Promise<string> {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!response.ok) {
        throw new Error(`Anfrage an "${baseUrl}" fehlgeschlagen (${response.status}): ${await response.text()}`);
      }
      const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      return data.choices?.[0]?.message?.content ?? "";
    },
  };
}

/**
 * Fragt den Anbieter selbst, welche Modelle mit diesem Schlüssel verfügbar
 * sind — statt dass der Mensch einen Modellnamen erraten/eintippen muss.
 */
export async function listOpenAiCompatibleModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const response = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    throw new Error(`Modellliste von "${baseUrl}" fehlgeschlagen (${response.status}): ${await response.text()}`);
  }
  const data = (await response.json()) as { data?: { id: string }[] };
  return (data.data ?? []).map((model) => model.id);
}
