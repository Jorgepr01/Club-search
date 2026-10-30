import type { Recommendation } from "@/lib/types";

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
