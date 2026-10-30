import "server-only";
import type { Checked } from "@/lib/engine/validate";

// Errores de las rutas de IA con el cuerpo y el estado HTTP de docs/integracion-ia/contrato-api.md.
// Nunca se registra ni se devuelve el contenido de la conversación: solo ruta, duración y error.

export type ApiErrorKind = "bad_request" | "quota" | "invalid_response" | "unavailable" | "timeout";

const STATUS: Record<ApiErrorKind, number> = {
  bad_request: 400,
  quota: 429,
  invalid_response: 502,
  unavailable: 503,
  timeout: 504,
};

/** Tiempo máximo por solicitud del lado del servidor, incluido el reintento. */
export const TIMEOUT_MS = 25_000;

export class ApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    message: string,
  ) {
    super(message);
  }
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return new ApiError("timeout", "Se superó el tiempo máximo.");
  }
  return new ApiError("unavailable", "Error inesperado.");
}

/** Ejecuta una ruta, registra solo metadatos y convierte cualquier fallo en el error del contrato. */
export async function handle(route: string, run: () => Promise<unknown>): Promise<Response> {
  const started = Date.now();
  try {
    const body = await run();
    console.info(`[ia] ${route} 200 ${Date.now() - started}ms ${process.env.AI_MODEL ?? ""}`);
    return Response.json(body);
  } catch (error) {
    const e = toApiError(error);
    console.error(`[ia] ${route} ${STATUS[e.kind]} ${Date.now() - started}ms ${e.kind}: ${e.message}`);
    return Response.json({ error: { kind: e.kind, message: e.message } }, { status: STATUS[e.kind] });
  }
}

const MAX_BODY = 32 * 1024;

export async function readBody(request: Request): Promise<unknown> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY) throw new ApiError("bad_request", "Cuerpo demasiado grande.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError("bad_request", "JSON inválido.");
  }
}

/** Pide al modelo, valida y, si falla, reintenta una vez avisándole del error. */
export async function askWithRetry<T>(
  ask: (feedback: string | null) => Promise<unknown>,
  check: (value: unknown) => Checked<T>,
): Promise<T> {
  let feedback: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = check(await ask(feedback));
    if (result.ok) return result.value;
    feedback = result.error;
  }
  throw new ApiError("invalid_response", feedback ?? "Respuesta inválida.");
}
