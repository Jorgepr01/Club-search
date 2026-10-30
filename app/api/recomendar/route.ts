import { askWithRetry, handle, readBody, TIMEOUT_MS } from "@/lib/ai/http";
import { callModel } from "@/lib/ai/model";
import { recommendPrompt, recommendSystem, retryNote } from "@/lib/ai/prompts";
import { parseRecommendRequest } from "@/lib/ai/requests";
import { clubsInBranch } from "@/lib/catalog";
import { checkRecommendations, MAX_RECOMMENDATIONS } from "@/lib/engine/validate";
import type { Club } from "@/lib/types";

// POST /api/recomendar: hasta tres clubes de la rama con su explicación (DiscoveryEngine.recommend).
// Los candidatos salen del catálogo del servidor, nunca del cliente.

/** Solo los campos que el modelo necesita, sin los nulos. Nunca contactos ni URLs. */
function toCandidate({ id, name, type, faculty, category, description }: Club) {
  return Object.fromEntries(
    Object.entries({ id, name, type, faculty, category, description }).filter(([, v]) => v !== null),
  );
}

export async function POST(request: Request) {
  return handle("/api/recomendar", async () => {
    const { branch, profile, exclude } = parseRecommendRequest(await readBody(request));

    const pending = clubsInBranch(branch.id).filter((c) => !exclude.includes(c.id));
    if (pending.length === 0) return { recommendations: [] };

    const expected = Math.min(MAX_RECOMMENDATIONS, pending.length);
    const allowed = new Set(pending.map((c) => c.id));
    const system = recommendSystem(expected, branch.name);
    const prompt = recommendPrompt(branch, profile, pending.map(toCandidate));
    const signal = AbortSignal.timeout(TIMEOUT_MS);

    const recommendations = await askWithRetry(
      (feedback) =>
        callModel(system, [{ role: "user", text: feedback ? prompt + retryNote(feedback) : prompt }], signal, {
          temperature: 0.3,
        }),
      (value) => checkRecommendations(value, allowed, expected),
    );
    return { recommendations };
  });
}
