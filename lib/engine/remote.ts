import type { ChatMessage, Profile, Recommendation } from "@/lib/types";
import { EngineError, type AssistantTurn, type DiscoveryEngine } from "./types";

// Motor que llama a las rutas de IA del servidor (ver docs/integracion-ia/contrato-api.md).
// La primera pregunta es fija y local porque start() es síncrono.

const FIRST_TURN: AssistantTurn = {
  text: "Hola. Para empezar, cuéntame qué te gusta hacer, dentro o fuera de clases.",
  suggestions: ["Programar y hacer apps", "Robótica y electrónica", "Cine, fotografía y dibujo"],
  readyForProfile: false,
};

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new EngineError("Sin conexión con el servidor.", "network");
  }
  if (res.ok) return (await res.json()) as T;
  if (res.status === 429) throw new EngineError("Límite de uso del modelo.", "quota");
  if (res.status === 400 || res.status === 502) throw new EngineError("Respuesta no válida.", "invalid_response");
  throw new EngineError("Servicio no disponible.", "network");
}

const toWire = (history: ChatMessage[]) => history.map(({ role, text }) => ({ role, text }));

export const remoteEngine: DiscoveryEngine = {
  mode: "gemma",

  start() {
    return FIRST_TURN;
  },

  reply(history) {
    return post<AssistantTurn>("/api/chat", { messages: toWire(history) });
  },

  proposeProfile(history) {
    return post<Profile>("/api/perfil", { messages: toWire(history) });
  },

  async recommend({ profile, branchId, exclude }) {
    // Sin nombre ni carrera, y sin candidatos: el servidor los toma del catálogo.
    const { interests, goals, availability } = profile;
    const { recommendations } = await post<{ recommendations: Recommendation[] }>("/api/recomendar", {
      branchId,
      profile: { interests, goals, availability },
      exclude,
    });
    return recommendations;
  },
};
