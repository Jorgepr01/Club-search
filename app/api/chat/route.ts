import { askWithRetry, handle, readBody, TIMEOUT_MS } from "@/lib/ai/http";
import { callModel } from "@/lib/ai/model";
import { CHAT_SYSTEM, CLOSING_TEXT, retryNote } from "@/lib/ai/prompts";
import { parseMessages } from "@/lib/ai/requests";
import { validateTurn } from "@/lib/engine/validate";

// POST /api/chat: siguiente turno del asistente (DiscoveryEngine.reply).

/** Con 6 respuestas del estudiante se cierra la conversación aunque falte información. */
const MAX_USER_TURNS = 6;

export async function POST(request: Request) {
  return handle("/api/chat", async () => {
    const messages = parseMessages(await readBody(request));
    const signal = AbortSignal.timeout(TIMEOUT_MS);

    const turn = await askWithRetry(
      (feedback) =>
        callModel(
          CHAT_SYSTEM,
          feedback
            ? messages.map((m, i) => (i === messages.length - 1 ? { ...m, text: m.text + retryNote(feedback) } : m))
            : messages,
          signal,
        ),
      validateTurn,
    );

    const userTurns = messages.filter((m) => m.role === "user").length;
    if (userTurns >= MAX_USER_TURNS && !turn.readyForProfile) {
      return { text: CLOSING_TEXT, suggestions: [], readyForProfile: true };
    }
    return turn;
  });
}
