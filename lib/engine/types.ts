import type { BranchId, ChatMessage, Club, Profile, Recommendation } from "@/lib/types";

// Contrato entre la interfaz y quien interpreta la conversación y recomienda clubes.
// Hoy lo implementa `demoEngine` (reglas en el navegador). La versión con Gemma debe
// cumplir el mismo contrato llamando a rutas del servidor, para que la clave nunca
// llegue al cliente. Ver README, sección «Conectar Gemma».

export interface AssistantTurn {
  text: string;
  /** Respuestas rápidas sugeridas; el estudiante siempre puede escribir libremente. */
  suggestions: string[];
  /** true cuando ya hay suficiente información para proponer un perfil. */
  readyForProfile: boolean;
}

export interface RecommendInput {
  profile: Profile;
  branchId: BranchId;
  /** Solo los clubes de la rama elegida: lo mínimo necesario para el modelo. */
  candidates: Club[];
  /** IDs ya mostrados, para explorar alternativas en la misma rama. */
  exclude: string[];
}

export interface DiscoveryEngine {
  /** "demo" se muestra en la interfaz para no confundirlo con respuestas de un modelo. */
  mode: "demo" | "gemma";
  start(): AssistantTurn;
  reply(history: ChatMessage[]): Promise<AssistantTurn>;
  proposeProfile(history: ChatMessage[]): Promise<Profile>;
  recommend(input: RecommendInput): Promise<Recommendation[]>;
}

export class EngineError extends Error {
  constructor(
    message: string,
    public readonly kind: "network" | "quota" | "invalid_response",
  ) {
    super(message);
  }
}
