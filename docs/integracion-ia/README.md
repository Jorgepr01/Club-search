# Integración de modelos de IA

Guía para el agente (o la persona) que conecte modelos de IA a la interfaz de **Comunidad ESPOL**. La interfaz ya está terminada y funciona con un motor de demostración por reglas; el trabajo consiste en sustituir ese motor por uno que llame a tus modelos **sin cambiar el diseño**.

Lee los documentos en este orden:

| Documento | Para qué |
| --- | --- |
| Este archivo | Qué se conecta, qué no se toca y cuándo está terminado. |
| [`contrato-api.md`](contrato-api.md) | Las tres rutas HTTP que la interfaz necesita: entrada, salida, errores y ejemplos. Es la fuente de verdad. |
| [`esquemas.json`](esquemas.json) | JSON Schema de cada solicitud y respuesta, listo para salida estructurada del modelo o para validar. |
| [`prompts.md`](prompts.md) | Instrucciones de sistema sugeridas y reglas de contenido para cada tarea. |
| [`guia-implementacion.md`](guia-implementacion.md) | Paso a paso en este repositorio: archivos a crear, código base, cambio de motor, avisos de la interfaz y pruebas. |

## Cómo está armado hoy

```
Navegador                                                     Hoy
┌──────────────────────────────────────────┐
│ components/experience/Experience.tsx     │
│   const engine: DiscoveryEngine = demoEngine  ──────►  lib/demo/engine.ts (reglas, sin IA)
│   engine.start() / reply() / proposeProfile() / recommend()
└──────────────────────────────────────────┘
```

Toda la interfaz habla con **una sola interfaz TypeScript**, `DiscoveryEngine` ([`lib/engine/types.ts`](../../lib/engine/types.ts)). Ningún componente sabe si detrás hay reglas o un modelo.

## Cómo debe quedar

```
Navegador                                Servidor Next.js (app/api/…)            Tus modelos
┌──────────────────────────┐   fetch    ┌───────────────────────────────┐        ┌──────────────────┐
│ Experience.tsx           │ ─────────► │ POST /api/chat                │ ─────► │ Opción A: API del │
│   engine = remoteEngine  │            │ POST /api/perfil              │        │ proveedor (Gemma) │
│   (lib/engine/remote.ts) │ ◄───────── │ POST /api/recomendar          │ ◄───── │ Opción B: servicio│
└──────────────────────────┘    JSON    │  · arma el contexto mínimo    │        │ propio (FastAPI…) │
                                        │  · valida la respuesta        │        └──────────────────┘
                                        │  · guarda la clave            │
                                        └───────────────────────────────┘
```

- **El navegador nunca habla con el modelo.** Solo llama a `/api/chat`, `/api/perfil` y `/api/recomendar` del mismo sitio. Las claves viven en variables de entorno del servidor.
- **Opción A (proveedor directo):** las rutas llaman a la API del modelo (por ejemplo Gemma en Gemini API) con `AI_API_KEY` y `AI_MODEL`.
- **Opción B (servicio propio):** si tus modelos ya corren en otro servidor, implementa en él **el mismo contrato** de [`contrato-api.md`](contrato-api.md) y las rutas de Next.js solo reenvían la solicitud a `AI_SERVICE_URL`, validando la respuesta antes de devolverla.

En ambos casos la interfaz no cambia: solo cambia `engine` en `Experience.tsx`.

## Qué hace cada método

| Método | Cuándo lo llama la interfaz | Ruta | Qué devuelve |
| --- | --- | --- | --- |
| `start()` | Al pulsar «Empezar conversación». **Síncrono.** | ninguna (local) | Primera pregunta fija. Se queda en el cliente. |
| `reply(history)` | Cada vez que el estudiante envía un mensaje (texto, sugerencia o voz), en Conversación y en el panel de conversación del Perfil. | `POST /api/chat` | `{ text, suggestions, readyForProfile }` |
| `proposeProfile(history)` | Justo después de un `reply` con `readyForProfile: true`. | `POST /api/perfil` | `{ name, career, interests, goals, availability }` |
| `recommend(input)` | Al elegir una rama, al pulsar «Ver otras organizaciones» y al reintentar. | `POST /api/recomendar` | `[{ clubId, reasons }]`, máximo 3 |

## Qué no se toca

- **Diseño y componentes visuales:** `app/globals.css`, `components/experience/*.css` y el marcado de los componentes. La única edición en componentes es cambiar el motor y los avisos «sin IA» (ver la guía).
- **Tipos compartidos** de [`lib/types.ts`](../../lib/types.ts) y la firma de `DiscoveryEngine`. Si el contrato necesita un campo nuevo, se agrega como opcional y se documenta aquí.
- **Catálogo** (`data/`, `lib/catalog/`). El modelo nunca inventa clubes: solo elige IDs que existen.
- **Voz** (`lib/speech/`, `VoiceGuide.tsx`, `voiceActions.ts`). La voz ya envía lo dictado por el mismo `send()` que el teclado y lee en voz alta el texto de `reply`.
- **`demoEngine`** sigue existiendo como respaldo y para presentar sin red.

## Reglas que no se negocian

1. **Ningún secreto en el cliente.** Nada de `NEXT_PUBLIC_` para claves. Los módulos que usan claves importan `server-only`.
2. **Contexto mínimo.** No enviar al modelo nombre ni carrera, ni audio, ni el catálogo completo. Detalle por ruta en el contrato.
3. **Validar todo en el servidor** antes de responder: forma, longitudes, IDs del catálogo. Un reintento; después, error recuperable.
4. **No inventar datos del catálogo.** Actividades, requisitos, horarios y contactos ausentes siguen ausentes.
5. **Sin persistencia.** No guardar conversaciones ni perfiles en disco ni en registros. Registrar solo metadatos (ruta, duración, código de error).
6. **Nunca presentar contenido simulado como si fuera del modelo.** Si el modelo falla, se muestra el error; no se cae en silencio al `demoEngine`.

## Definición de terminado

- [ ] `POST /api/chat`, `/api/perfil` y `/api/recomendar` responden según [`contrato-api.md`](contrato-api.md), incluidos los errores.
- [ ] Las respuestas pasan por validación en el servidor (`validateRecommendations` y los validadores de turno y perfil descritos en la guía).
- [ ] `lib/engine/remote.ts` implementa `DiscoveryEngine` y `Experience.tsx` lo usa cuando el modo IA está activo.
- [ ] Los avisos «Demo sin IA», «Guía por pasos, sin IA» y la nota de [`ClubResults.tsx`](../../components/experience/ClubResults.tsx) cambian según el motor.
- [ ] `npm run lint` y `npm run build` pasan.
- [ ] Recorrido completo en el navegador: conversación (texto, sugerencia y voz), perfil, ramas, clubes, «Ver otras organizaciones», y los casos sin red, cuota agotada y respuesta inválida.
- [ ] El README raíz registra el modelo realmente probado, las variables de entorno y los límites encontrados.
