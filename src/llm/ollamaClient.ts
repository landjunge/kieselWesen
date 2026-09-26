/**
 * Anbindung an ein lokal laufendes LLM über Ollama (http://localhost:11434).
 * Läuft komplett offline auf dem eigenen Rechner, keine Cloud-Anfrage.
 * Das Modell ist ein reiner Konfigurationswert (modelName) — jedes von
 * Ollama unterstützte Modell lässt sich damit austauschen, ohne dass sich
 * an der restlichen Anbindung etwas ändert.
 */

export interface LlmClient {
  modelName: string;
  suggest(prompt: string): Promise<string>;
}

export interface OllamaClientOptions {
  baseUrl?: string;
}

export function createOllamaClient(modelName: string, options: OllamaClientOptions = {}): LlmClient {
  const baseUrl = options.baseUrl ?? "http://localhost:11434";
  return {
    modelName,
    async suggest(prompt: string): Promise<string> {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelName, prompt, stream: false }),
      });
      if (!response.ok) {
        throw new Error(`Ollama-Anfrage fehlgeschlagen (${response.status}): ${await response.text()}`);
      }
      const data = (await response.json()) as { response?: string };
      return data.response ?? "";
    },
  };
}
