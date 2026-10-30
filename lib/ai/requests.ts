import "server-only";
import { BRANCH_BY_ID } from "@/lib/catalog/branches";
import { MAX_PROFILE_INTERESTS, type Branch, type Profile } from "@/lib/types";
import { ApiError } from "./http";
import type { ModelMessage } from "./model";

// Lectura estricta de los cuerpos de docs/integracion-ia/contrato-api.md.
// Cualquier desvío es un 400: el cliente propio nunca debería enviarlo.

const MAX_USER_TEXT = 500;
const MAX_ASSISTANT_TEXT = 600;
/** El servidor solo envía al modelo los últimos mensajes. */
const MAX_HISTORY = 20;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** `messages` válido, terminado en un mensaje del estudiante y recortado a los últimos 20. */
export function parseMessages(body: unknown): ModelMessage[] {
  if (!isObject(body) || !Array.isArray(body.messages) || body.messages.length === 0) {
    throw new ApiError("bad_request", "Falta «messages».");
  }
  const messages = body.messages.map((m): ModelMessage => {
    if (!isObject(m) || (m.role !== "user" && m.role !== "assistant") || typeof m.text !== "string") {
      throw new ApiError("bad_request", "Mensaje inválido.");
    }
    const text = m.text.trim();
    const max = m.role === "user" ? MAX_USER_TEXT : MAX_ASSISTANT_TEXT;
    if (!text || text.length > max) throw new ApiError("bad_request", "Mensaje vacío o demasiado largo.");
    return { role: m.role, text };
  });
  if (messages.at(-1)?.role !== "user") throw new ApiError("bad_request", "El último mensaje debe ser del estudiante.");
  return messages.slice(-MAX_HISTORY);
}

export interface RecommendRequest {
  branch: Branch;
  profile: Pick<Profile, "interests" | "goals" | "availability">;
  exclude: string[];
}

function stringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value) || value.length > max || !value.every((v) => typeof v === "string" && v.length <= 120)) {
    throw new ApiError("bad_request", "Perfil inválido.");
  }
  return value.map((v: string) => v.trim()).filter(Boolean);
}

export function parseRecommendRequest(body: unknown): RecommendRequest {
  if (!isObject(body) || !isObject(body.profile)) throw new ApiError("bad_request", "Cuerpo inválido.");
  const branch =
    typeof body.branchId === "string" && Object.hasOwn(BRANCH_BY_ID, body.branchId)
      ? BRANCH_BY_ID[body.branchId as Branch["id"]]
      : undefined;
  if (!branch) throw new ApiError("bad_request", "Rama desconocida.");

  const { interests, goals, availability } = body.profile;
  if (availability !== null && (typeof availability !== "string" || availability.length > 120)) {
    throw new ApiError("bad_request", "Disponibilidad inválida.");
  }
  const exclude = body.exclude ?? [];
  if (!Array.isArray(exclude) || !exclude.every((id) => typeof id === "string")) {
    throw new ApiError("bad_request", "«exclude» inválido.");
  }

  return {
    branch,
    profile: {
      interests: stringList(interests, MAX_PROFILE_INTERESTS),
      goals: stringList(goals, MAX_PROFILE_INTERESTS),
      availability: availability?.trim() || null,
    },
    exclude,
  };
}
