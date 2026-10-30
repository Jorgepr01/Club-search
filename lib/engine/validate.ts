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
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Quita marcas de Markdown que se colarían en la lectura en voz alta. */
function plain(text: string): string {
  return text.replace(/[*_#`]+/g, "").replace(/\s+/g, " ").trim();
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  // Corta en la última palabra completa para que la tarjeta no muestre media palabra.
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

/** Gemma a veces envuelve el objeto pedido en una lista de un elemento. */
function unwrap(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
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

export function validateTurn(raw: unknown): Checked<AssistantTurn> {
  const value = unwrap(raw);
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
export function validateProfile(raw: unknown, userTexts: string[]): Checked<Profile> {
  const value = unwrap(raw);
  if (typeof value !== "object" || value === null) return { ok: false, error: "La respuesta no es un objeto JSON." };
  const { name, career, interests, goals, availability } = value as Record<string, unknown>;
  // Gemma a veces devuelve una etiqueta suelta en lugar de una lista: se acepta como lista de una.
  const asList = (field: unknown) => (typeof field === "string" ? [field] : field);

  const said = userTexts.map(fold);
  const literal = (field: unknown, max: number) => {
    if (typeof field !== "string") return "";
    const text = clip(plain(field), max);
    return text && said.some((t) => t.includes(fold(text))) ? text : "";
  };

  const cleanInterests = cleanList(asList(interests), MAX_LABEL, MAX_PROFILE_INTERESTS);
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
      goals: cleanList(asList(goals), MAX_LABEL, MAX_GOALS),
      availability: cleanAvailability || null,
    },
  };
}

/** Ajusta una razón a su límite cortando en la última palabra completa. */
function fitReason(reason: string, max: number): string {
  return clip(plain(reason), max);
}

/**
 * Saca la lista de clubes de las formas que Gemma devuelve: `{ recommendations: [...] }`, la lista sola,
 * `[{ recommendations: [...] }]` o un objeto con otra clave cuyo valor es la lista.
 */
function recommendationList(value: unknown): unknown {
  const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
  if (Array.isArray(value)) {
    return value.length === 1 && isRecord(value[0]) && !("clubId" in value[0]) ? recommendationList(value[0]) : value;
  }
  if (!isRecord(value)) return value;
  if (Array.isArray(value.recommendations)) return value.recommendations;
  if ("clubId" in value) return [value];
  const lists = Object.values(value).filter(Array.isArray);
  return lists.length === 1 ? lists[0] : value;
}

/** Exige exactamente `expected` clubes válidos, con razones ajustadas a su límite. */
export function checkRecommendations(
  value: unknown,
  allowedIds: ReadonlySet<string>,
  expected: number,
): Checked<Recommendation[]> {
  const base = validateRecommendations(recommendationList(value), allowedIds);
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
      if (!text || seen.has(fold(text))) continue;
      seen.add(fold(text));
      fitted.push(text);
    }
    if (fitted.length === 0) return { ok: false, error: `Sin explicación para ${clubId}` };
    recommendations.push({ clubId, reasons: fitted });
  }
  return { ok: true, value: recommendations };
}
