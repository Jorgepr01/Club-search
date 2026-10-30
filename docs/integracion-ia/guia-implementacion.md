# Guía de implementación

Pasos concretos para conectar los modelos en este repositorio. El contrato que hay que cumplir está en [`contrato-api.md`](contrato-api.md); aquí está **dónde** y **cómo**.

> **Antes de escribir código:** este proyecto usa **Next.js 16.4** con `cacheComponents: true`, React 19.3 y TypeScript. Las API pueden diferir de lo que conoces. Lee `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` y `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md` (ver [`AGENTS.md`](../../AGENTS.md)). El alias `@/` apunta a la raíz del repositorio.

## Archivos

| Archivo | Acción | Contenido |
| --- | --- | --- |
| `.env.local` | crear (no se sube: `.env*` está en `.gitignore`) | Variables de entorno. |
| `lib/ai/http.ts` | crear | Errores de la API, lectura del cuerpo, reintento. `server-only`. |
| `lib/ai/model.ts` | crear | Llamada al modelo: opción A (proveedor) u opción B (servicio propio). `server-only`. |
| `lib/ai/prompts.ts` | crear | Instrucciones de [`prompts.md`](prompts.md). |
| `lib/engine/validate.ts` | ampliar | `validateTurn` y `validateProfile` junto a `validateRecommendations`. |
| `app/api/chat/route.ts` | crear | `POST /api/chat`. |
| `app/api/perfil/route.ts` | crear | `POST /api/perfil`. |
| `app/api/recomendar/route.ts` | crear | `POST /api/recomendar`. |
| `lib/engine/remote.ts` | crear | `remoteEngine`: implementa `DiscoveryEngine` llamando a las rutas. |
| `lib/engine/current.ts` | crear | Elige `demoEngine` o `remoteEngine` según `NEXT_PUBLIC_ENGINE`. |
| `components/experience/Experience.tsx` | 1 línea | Usar `engine` de `lib/engine/current.ts`. |
| Avisos «sin IA» | 3 textos | Ver [paso 8](#8-avisos-de-la-interfaz). |
| `README.md` | actualizar | Sección «Conectar Gemma» y tabla «Qué está simulado y qué es real». |

No hace falta tocar ningún otro componente ni CSS.

## 1. Variables de entorno

```bash
npm install server-only
```

`.env.local`:

```dotenv
# Cliente: "ia" activa remoteEngine; cualquier otro valor o ausente usa demoEngine.
# No es secreto. Se fija al compilar (NEXT_PUBLIC_).
NEXT_PUBLIC_ENGINE=ia

# Opción A: proveedor directo (ejemplo: Gemma en Gemini API).
AI_API_KEY=
AI_MODEL=gemma-4-26b-a4b-it

# Opción B: servicio propio que implementa contrato-api.md. Si está definida, tiene prioridad sobre la opción A.
AI_SERVICE_URL=
AI_SERVICE_TOKEN=
```

Ninguna variable con clave lleva prefijo `NEXT_PUBLIC_`. El README raíz menciona `GEMINI_API_KEY` y `GEMMA_MODEL`: al terminar, actualízalo con los nombres que realmente uses.

## 2. Utilidades del servidor (`lib/ai/http.ts`)

```ts
import "server-only";

// Errores de las rutas de IA con el cuerpo y el estado HTTP de contrato-api.md.
// Nunca se registra ni se devuelve el contenido de la conversación.

export type ApiErrorKind = "bad_request" | "quota" | "invalid_response" | "unavailable" | "timeout";

const STATUS: Record<ApiErrorKind, number> = {
  bad_request: 400,
  quota: 429,
  invalid_response: 502,
  unavailable: 503,
  timeout: 504,
};

export class ApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(route: string, error: unknown): Response {
  const e =
    error instanceof ApiError
      ? error
      : error instanceof DOMException && error.name === "TimeoutError"
        ? new ApiError("timeout", "Se superó el tiempo máximo.")
        : new ApiError("unavailable", "Error inesperado.");
  console.error(`[ia] ${route} ${e.kind}: ${e.message}`);
  return Response.json({ error: { kind: e.kind, message: e.message } }, { status: STATUS[e.kind] });
}

const MAX_BODY = 32 * 1024;

export async function readBody(request: Request): Promise<unknown> {
  const raw = await request.text();
  if (raw.length > MAX_BODY) throw new ApiError("bad_request", "Cuerpo demasiado grande.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError("bad_request", "JSON inválido.");
  }
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

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
```

## 3. Llamada al modelo (`lib/ai/model.ts`)

Una sola función para las tres rutas. Devuelve el JSON ya parseado (o `null` si el modelo no devolvió JSON, para que la validación pida el reintento).

```ts
import "server-only";
import { ApiError } from "./http";

export interface ModelMessage {
  role: "user" | "assistant";
  text: string;
}

export async function callModel(system: string, messages: ModelMessage[], signal: AbortSignal): Promise<unknown> {
  const key = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!key || !model) throw new ApiError("unavailable", "Falta AI_API_KEY o AI_MODEL.");

  // Algunos modelos Gemma no aceptan systemInstruction: la instrucción va en el primer turno del usuario.
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));
  if (contents[0]?.role === "user") contents[0].parts[0].text = `${system}\n\n${contents[0].parts[0].text}`;
  else contents.unshift({ role: "user", parts: [{ text: system }] });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents, generationConfig: { temperature: 0.4 } }),
    signal,
  });
  if (res.status === 429) throw new ApiError("quota", "El proveedor devolvió límite de cuota.");
  if (!res.ok) throw new ApiError("unavailable", `El proveedor respondió ${res.status}.`);

  const data = await res.json();
  const text: string = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("");
  return parseJson(text);
}

/** Acepta JSON puro o envuelto en ```json … ```. */
export function parseJson(text: string): unknown {
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (start === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Opción B: el servicio propio ya implementa contrato-api.md; aquí solo se reenvía. */
export async function callService(path: string, body: unknown, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(new URL(path, process.env.AI_SERVICE_URL), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.AI_SERVICE_TOKEN ? { Authorization: `Bearer ${process.env.AI_SERVICE_TOKEN}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (res.status === 429) throw new ApiError("quota", "El servicio devolvió límite de cuota.");
  if (!res.ok) throw new ApiError("unavailable", `El servicio respondió ${res.status}.`);
  return res.json();
}

export const usesService = () => Boolean(process.env.AI_SERVICE_URL);
```

- Si usas **otro proveedor** en la opción A (OpenAI, Anthropic, Ollama, vLLM…), reemplaza solo el `fetch` y la extracción del texto; el resto de la guía no cambia. Si el modelo admite salida estructurada, pásale el esquema de [`esquemas.json`](esquemas.json) correspondiente.
- En la **opción B**, el servicio recibe los cuerpos de [`contrato-api.md`](contrato-api.md) y, en `/api/recomendar`, además `branch` y `candidates` (ver [Opción B en el contrato](contrato-api.md#opción-b-cuerpo-que-recibe-el-servicio-propio)). Las rutas de Next.js validan la respuesta del servicio igual que la del modelo.

## 4. Validadores (`lib/engine/validate.ts`)

Agrega `validateTurn` y `validateProfile` junto a `validateRecommendations`, con el mismo estilo (`{ ok: true, … } | { ok: false, error }`). Reglas exactas en el contrato; resumen:

```ts
export const MAX_TURN_TEXT = 600;
export const MAX_SUGGESTION = 60;

// validateTurn(value): text string 1–600 (recortar si se pasa), suggestions string[] (filtrar vacías,
// repetidas y de más de 60; máximo 3), readyForProfile boolean. Si readyForProfile, suggestions = [].

// validateProfile(value, userTexts: string[]): name/career string (vaciar si no aparecen literalmente
// en userTexts), interests 1–4 sin repetir (si queda vacío, usar la primera respuesta recortada a 60),
// goals 0–4, availability string ≤ 120 o null. Usa MAX_PROFILE_INTERESTS de lib/types.ts.
```

Para las recomendaciones, envuelve el existente:

```ts
// checkRecommendations(value, allowed, expected):
//   1. Extraer value.recommendations (o value si ya es lista).
//   2. validateRecommendations(lista, allowed).
//   3. Exigir lista.length === expected, reasons de 1 a 3 y sin repetir,
//      reasons[0] ≤ 140 y el resto ≤ 220 (recortar con «…» si se pasa).
```

## 5. Rutas (`app/api/*/route.ts`)

Ejemplo completo de la más delicada. Las otras dos siguen el mismo patrón.

### `app/api/recomendar/route.ts`

```ts
import { askWithRetry, errorResponse, readBody, ApiError } from "@/lib/ai/http";
import { callModel, callService, usesService } from "@/lib/ai/model";
import { recommendPrompt, RECOMMEND_SYSTEM } from "@/lib/ai/prompts";
import { clubsInBranch } from "@/lib/catalog";
import { BRANCH_BY_ID } from "@/lib/catalog/branches";
import { MAX_RECOMMENDATIONS } from "@/lib/engine/validate";
import type { BranchId, Club } from "@/lib/types";

const TIMEOUT_MS = 25_000;

function toCandidate(club: Club) {
  const { id, name, type, faculty, category, description } = club;
  return Object.fromEntries(
    Object.entries({ id, name, type, faculty, category, description }).filter(([, v]) => v !== null),
  );
}

export async function POST(request: Request) {
  try {
    const body = parseRecommendRequest(await readBody(request)); // lanza ApiError("bad_request") si no cumple
    const branch = BRANCH_BY_ID[body.branchId as BranchId];
    if (!branch) throw new ApiError("bad_request", "Rama desconocida.");

    // Los candidatos salen del catálogo del servidor, nunca del cliente.
    const pending = clubsInBranch(branch.id).filter((c) => !body.exclude.includes(c.id));
    if (pending.length === 0) return Response.json({ recommendations: [] });

    const expected = Math.min(MAX_RECOMMENDATIONS, pending.length);
    const allowed = new Set(pending.map((c) => c.id));
    const candidates = pending.map(toCandidate);
    const signal = AbortSignal.timeout(TIMEOUT_MS);

    const recommendations = await askWithRetry(
      (feedback) =>
        usesService()
          ? callService("/api/recomendar", { ...body, branch: { id: branch.id, name: branch.name, blurb: branch.blurb }, candidates }, signal)
          : callModel(
              RECOMMEND_SYSTEM.replace("{N}", String(expected)).replace("{RAMA}", branch.name),
              [{ role: "user", text: recommendPrompt(branch, body.profile, candidates, feedback) }],
              signal,
            ),
      (value) => checkRecommendations(value, allowed, expected),
    );
    return Response.json({ recommendations });
  } catch (error) {
    return errorResponse("/api/recomendar", error);
  }
}
```

### `app/api/chat/route.ts`

1. `readBody` y validar `messages` (array de `{ role, text }`, último `role: "user"`, textos de usuario ≤ 500). Si no → `bad_request`.
2. Recortar a los últimos 20 mensajes.
3. `askWithRetry` con `callModel(CHAT_SYSTEM, mensajes, signal)` o `callService("/api/chat", { messages }, signal)`, y `validateTurn`. En el reintento, añade `feedback` como un último mensaje de usuario: «Tu respuesta anterior no es válida: …».
4. **Tope de turnos:** si hay 6 o más mensajes `user` y `readyForProfile` es `false`, devolver el turno de cierre (ver [`prompts.md`](prompts.md#controles-del-servidor)).
5. `Response.json(turn)`; errores con `errorResponse("/api/chat", error)`.

### `app/api/perfil/route.ts`

1. Mismo cuerpo y validación que `/api/chat`.
2. Construir el texto «Pregunta: … / Respuesta: …» solo con las respuestas del estudiante ([`prompts.md`](prompts.md#2-perfil-apiperfil)).
3. `askWithRetry` con `callModel(PROFILE_SYSTEM, [{ role: "user", text }], signal)` o `callService("/api/perfil", { messages }, signal)`, y `validateProfile(value, textosDelEstudiante)`.
4. `Response.json(profile)`.

Notas de Next.js 16:

- Exporta solo `POST`. Con `cacheComponents: true` los `POST` nunca se cachean; no agregues `GET` a estas rutas.
- No puede haber `route.ts` y `page.tsx` en el mismo segmento: `app/api/…` no tiene páginas, así que no hay conflicto.
- `lib/catalog` importa `data/*.json`; funciona igual en el servidor.

## 6. Motor del cliente (`lib/engine/remote.ts`)

```ts
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
```

`mode` admite `"demo" | "gemma"` ([`lib/engine/types.ts`](../../lib/engine/types.ts)). Si tu modelo no es Gemma, agrega su valor a esa unión (es el único cambio permitido en el contrato TypeScript) y úsalo aquí.

## 7. Cambiar de motor

`lib/engine/current.ts`:

```ts
import { demoEngine } from "@/lib/demo/engine";
import { remoteEngine } from "./remote";
import type { DiscoveryEngine } from "./types";

// Motor activo para toda la interfaz. NEXT_PUBLIC_ENGINE=ia usa los modelos; si no, la demo por reglas.
export const engine: DiscoveryEngine = process.env.NEXT_PUBLIC_ENGINE === "ia" ? remoteEngine : demoEngine;
export const usesModel = engine.mode !== "demo";
```

En [`components/experience/Experience.tsx`](../../components/experience/Experience.tsx), sustituye

```ts
import { demoEngine } from "@/lib/demo/engine";
// …
const engine: DiscoveryEngine = demoEngine;
```

por

```ts
import { engine } from "@/lib/engine/current";
```

y quita el import de tipo `DiscoveryEngine` si queda sin uso. Nada más en ese archivo cambia: `send`, `loadRecommendations` y la fusión del perfil ya funcionan con un motor asíncrono que puede fallar.

**Si el modelo falla, no se cae al `demoEngine` en silencio**: la interfaz muestra su error recuperable y el estudiante reintenta.

## 8. Avisos de la interfaz

Hoy la interfaz dice que no hay IA. Con `usesModel` de `lib/engine/current.ts`, haz cada texto condicional (conserva clases y marcado):

| Archivo | Texto actual | Con modelo (sugerido) |
| --- | --- | --- |
| [`Experience.tsx:170`](../../components/experience/Experience.tsx) | «Demo sin IA» | «Con IA» |
| [`ClubResults.tsx:150-154`](../../components/experience/ClubResults.tsx) | «…El orden y las explicaciones salen de reglas de palabras clave, no de un modelo de inteligencia artificial.» | «…El orden y las explicaciones los propone un modelo de IA a partir del catálogo y pueden contener errores.» |
| [`VoiceGuide.tsx:468`](../../components/experience/VoiceGuide.tsx) | «Guía por pasos, sin IA. Usa las voces…» | «La guía funciona por pasos; las respuestas del chat las genera un modelo de IA. Usa las voces…» |

Opcional, recomendado por la especificación: en los `catch` de `send` y `loadRecommendations` (`Experience.tsx`), distinguir `EngineError` con `kind === "quota"`:

> «Se alcanzó el límite de uso del modelo. Espera un momento e intenta de nuevo; tu conversación sigue aquí.»

Lo que **sigue por reglas** y no hay que cambiar: la marca de ramas relacionadas en el árbol (`suggestedBranches` en [`InterestTree.tsx`](../../components/experience/InterestTree.tsx)) y los comandos de la guía de voz.

## 9. Pruebas

Con el servidor en marcha (`npm run dev`, puerto 3000):

```bash
curl -s localhost:3000/api/chat -H 'Content-Type: application/json' -d '{"messages":[{"role":"assistant","text":"Hola. Para empezar, cuéntame qué te gusta hacer, dentro o fuera de clases."},{"role":"user","text":"Me gusta programar y armar cosas con Arduino"}]}'
```

```bash
curl -s localhost:3000/api/perfil -H 'Content-Type: application/json' -d '{"messages":[{"role":"assistant","text":"Cuéntame qué te gusta hacer."},{"role":"user","text":"Programar y robótica"},{"role":"assistant","text":"¿Qué quieres lograr?"},{"role":"user","text":"Conocer gente"},{"role":"assistant","text":"¿Cuánto tiempo tienes?"},{"role":"user","text":"Los sábados"}]}'
```

```bash
curl -s localhost:3000/api/recomendar -H 'Content-Type: application/json' -d '{"branchId":"programacion","profile":{"interests":["programación","electrónica"],"goals":["crear proyectos"],"availability":"Sábados por la mañana"},"exclude":[]}'
```

```bash
curl -s -i localhost:3000/api/recomendar -H 'Content-Type: application/json' -d '{"branchId":"inventada","profile":{"interests":[],"goals":[],"availability":null},"exclude":[]}'
```

Comprobar:

- [ ] Las tres respuestas cumplen [`esquemas.json`](esquemas.json). Los `clubId` existen en la rama y no repiten los de `exclude`.
- [ ] `branchId` inventado → `400`. Sin `AI_API_KEY` ni `AI_SERVICE_URL` → `503`. Con una clave sin cuota → `429`.
- [ ] Ninguna respuesta ni registro contiene la clave, el prompt o el texto del estudiante.
- [ ] `npm run lint` y `npm run build` sin errores.
- [ ] En el navegador, recorrido completo: responder por sugerencia, por texto y por voz; revisar el perfil; seguir conversando desde «Abrir conversación» en el Perfil; elegir rama; abrir y voltear tarjetas (`reasons[0]` cabe en el frente); «Ver otras organizaciones» hasta volver a las primeras; reintentar tras un error.
- [ ] Con la red cortada o el servidor de IA caído: aparece el error recuperable, la conversación y el perfil se conservan.
- [ ] Con `NEXT_PUBLIC_ENGINE` sin definir, todo sigue funcionando con `demoEngine` y los avisos dicen «sin IA».
- [ ] Revisión manual de las explicaciones: cada cita entre «» existe en el catálogo.
