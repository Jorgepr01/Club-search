import { MAX_PROFILE_INTERESTS, type Profile, type Recommendation } from "@/lib/types";
import type { AssistantTurn } from "./types";

// Validación de las recomendaciones antes de mostrarlas. Pensada para aplicarse en el
// servidor a la respuesta de Gemma: IDs existentes y únicos, máximo tres, texto no vacío.
// Que el formato sea válido no garantiza que la explicación sea verdadera.

export const MAX_RECOMMENDATIONS = 3;

export type ValidationResult =
  | { ok: true; recommendations: Recommendation[] }
  | { ok: false; error: string };

export function validateRecommendations(
  value: unknown,
  allowedIds: ReadonlySet<string>,
): ValidationResult {
  if (!Array.isArray(value)) return { ok: false, error: "La respuesta no es una lista." };
  if (value.length > MAX_RECOMMENDATIONS) {
    return { ok: false, error: `Hay más de ${MAX_RECOMMENDATIONS} recomendaciones.` };
  }

  const seen = new Set<string>();
  const recommendations: Recommendation[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return { ok: false, error: "Elemento inválido." };
    const { clubId, reasons } = item as Record<string, unknown>;
    if (typeof clubId !== "string" || !allowedIds.has(clubId)) {
      return { ok: false, error: `ID desconocido: ${String(clubId)}` };
    }
    if (seen.has(clubId)) return { ok: false, error: `ID repetido: ${clubId}` };
    if (!Array.isArray(reasons) || reasons.length === 0) {
      return { ok: false, error: `Sin explicación para ${clubId}` };
    }
    const cleanReasons = reasons.filter((r): r is string => typeof r === "string" && r.trim() !== "");
    if (cleanReasons.length === 0) return { ok: false, error: `Explicación vacía para ${clubId}` };
    seen.add(clubId);
    recommendations.push({ clubId, reasons: cleanReasons });
  }
  return { ok: true, recommendations };
}

// Validadores de los turnos del chat, del perfil y de la respuesta completa de recomendaciones.
// Reglas en docs/integracion-ia/contrato-api.md. Recortan lo que se pasa por poco y
// rechazan lo que no tiene arreglo, para que el servidor pida un reintento.

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

export const MAX_TURN_TEXT = 600;
export const MAX_SUGGESTION = 60;
export const MAX_SUGGESTIONS = 3;
export const MAX_GOALS = 4;
export const MAX_LABEL = 60;
export const MAX_AVAILABILITY = 120;
export const MAX_FIRST_REASON = 140;
export const MAX_OTHER_REASON = 220;
export const MAX_REASONS = 3;

/** Compara sin tildes, mayúsculas ni espacios repetidos. */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Quita marcas de Markdown que se colarían en la lectura en voz alta. */
function plain(text: string): string {
  return text.replace(/[*_#`]+/g, "").replace(/\s+/g, " ").trim();
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Lista de textos limpios, sin vacíos ni repetidos, recortada a `limit` elementos. */
function cleanList(value: unknown, maxLength: number, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const text = clip(plain(item), maxLength);
    const key = fold(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length === limit) break;
  }
  return result;
}

export function validateTurn(value: unknown): Checked<AssistantTurn> {
  if (typeof value !== "object" || value === null) return { ok: false, error: "La respuesta no es un objeto JSON." };
  const { text, suggestions, readyForProfile } = value as Record<string, unknown>;
  if (typeof text !== "string" || !plain(text)) return { ok: false, error: "Falta «text»." };
  if (typeof readyForProfile !== "boolean") return { ok: false, error: "«readyForProfile» debe ser true o false." };
  return {
    ok: true,
    value: {
      text: clip(plain(text), MAX_TURN_TEXT),
      suggestions: readyForProfile ? [] : cleanList(suggestions, MAX_SUGGESTION, MAX_SUGGESTIONS),
      readyForProfile,
    },
  };
}

/** `userTexts`: lo que escribió el estudiante, para comprobar que nombre y carrera son literales. */
export function validateProfile(value: unknown, userTexts: string[]): Checked<Profile> {
  if (typeof value !== "object" || value === null) return { ok: false, error: "La respuesta no es un objeto JSON." };
  const { name, career, interests, goals, availability } = value as Record<string, unknown>;
  if (!Array.isArray(interests)) return { ok: false, error: "«interests» debe ser una lista." };

  const said = userTexts.map(fold);
  const literal = (field: unknown, max: number) => {
    if (typeof field !== "string") return "";
    const text = clip(plain(field), max);
    return text && said.some((t) => t.includes(fold(text))) ? text : "";
  };

  const cleanInterests = cleanList(interests, MAX_LABEL, MAX_PROFILE_INTERESTS);
  if (cleanInterests.length === 0) {
    const first = userTexts.find((t) => t.trim());
    if (first) cleanInterests.push(clip(first.trim(), MAX_LABEL));
  }

  const cleanAvailability = typeof availability === "string" ? clip(plain(availability), MAX_AVAILABILITY) : "";

  return {
    ok: true,
    value: {
      name: literal(name, 60),
      career: literal(career, 80),
      interests: cleanInterests,
      goals: cleanList(goals, MAX_LABEL, MAX_GOALS),
      availability: cleanAvailability || null,
    },
  };
}

/** Ajusta una razón a su límite si se pasa por poco; si se pasa mucho, la rechaza. */
function fitReason(reason: string, max: number): string | null {
  const text = plain(reason);
  if (text.length <= max) return text;
  return text.length <= max * 1.25 ? clip(text, max) : null;
}

/** Acepta `{ recommendations: [...] }` o la lista sola y exige exactamente `expected` clubes. */
export function checkRecommendations(
  value: unknown,
  allowedIds: ReadonlySet<string>,
  expected: number,
): Checked<Recommendation[]> {
  const list =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>).recommendations
      : value;
  const base = validateRecommendations(list, allowedIds);
  if (!base.ok) return base;
  if (base.recommendations.length !== expected) {
    return { ok: false, error: `Se esperaban ${expected} clubes y llegaron ${base.recommendations.length}.` };
  }

  const recommendations: Recommendation[] = [];
  for (const { clubId, reasons } of base.recommendations) {
    const seen = new Set<string>();
    const fitted: string[] = [];
    for (const reason of reasons) {
      if (fitted.length === MAX_REASONS) break;
      const text = fitReason(reason, fitted.length === 0 ? MAX_FIRST_REASON : MAX_OTHER_REASON);
      if (text === null) {
        const max = fitted.length === 0 ? MAX_FIRST_REASON : MAX_OTHER_REASON;
        return { ok: false, error: `Una razón de ${clubId} supera ${max} caracteres.` };
      }
      if (!text || seen.has(fold(text))) continue;
      seen.add(fold(text));
      fitted.push(text);
    }
    if (fitted.length === 0) return { ok: false, error: `Sin explicación para ${clubId}` };
    recommendations.push({ clubId, reasons: fitted });
  }
  return { ok: true, value: recommendations };
}
