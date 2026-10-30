import "server-only";
import { ApiError } from "./http";

// Llamada a Gemma 4 en Gemini API (Google AI Studio) con la clave del servidor.
// Probado con gemma-4-26b-a4b-it: acepta systemInstruction, historial que empieza con
// el asistente y responseMimeType "application/json". Las partes de razonamiento
// (`thought: true`) se descartan; con thinkingLevel "minimal" llegan vacías.

export interface ModelMessage {
  role: "user" | "assistant";
  text: string;
}

export interface ModelOptions {
  /** "minimal" desactiva el razonamiento (más rápido); "high" lo activa. */
  thinking?: "minimal" | "high";
  temperature?: number;
}

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

interface Part {
  text?: string;
  thought?: boolean;
}

/** Devuelve el JSON ya parseado, o `null` si el modelo no devolvió JSON (la validación pedirá el reintento). */
export async function callModel(
  system: string,
  messages: ModelMessage[],
  signal: AbortSignal,
  { thinking = "minimal", temperature = 0.4 }: ModelOptions = {},
): Promise<unknown> {
  const key = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!key || !model) throw new ApiError("unavailable", "Falta AI_API_KEY o AI_MODEL.");

  const res = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.text }],
      })),
      generationConfig: {
        temperature,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: thinking },
      },
    }),
    signal,
    cache: "no-store",
  });
  if (res.status === 429) throw new ApiError("quota", "El proveedor devolvió límite de cuota.");
  if (!res.ok) throw new ApiError("unavailable", `El proveedor respondió ${res.status}.`);

  const data = await res.json();
  const parts: Part[] = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");
  return parseJson(text);
}

/** Acepta JSON puro o envuelto en ```json … ```. */
export function parseJson(text: string): unknown {
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (start === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
