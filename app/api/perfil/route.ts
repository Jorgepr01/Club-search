import { askWithRetry, handle, readBody, TIMEOUT_MS } from "@/lib/ai/http";
import { callModel } from "@/lib/ai/model";
import { PROFILE_SYSTEM, profilePrompt, retryNote } from "@/lib/ai/prompts";
import { parseMessages } from "@/lib/ai/requests";
import { validateProfile } from "@/lib/engine/validate";

// POST /api/perfil: borrador de perfil a partir de la conversación (DiscoveryEngine.proposeProfile).
// Al modelo solo llegan las respuestas del estudiante y la pregunta que respondían.

export async function POST(request: Request) {
  return handle("/api/perfil", async () => {
    const messages = parseMessages(await readBody(request));
    const userTexts = messages.filter((m) => m.role === "user").map((m) => m.text);
    const prompt = profilePrompt(messages);
    const signal = AbortSignal.timeout(TIMEOUT_MS);

    return askWithRetry(
      (feedback) =>
        callModel(PROFILE_SYSTEM, [{ role: "user", text: feedback ? prompt + retryNote(feedback) : prompt }], signal, {
          temperature: 0.2,
        }),
      (value) => validateProfile(value, userTexts),
    );
  });
}
