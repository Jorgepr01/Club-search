# Contrato de la API de IA

Fuente de verdad para conectar modelos a la interfaz. Las tres rutas viven en el servidor Next.js (`app/api/…/route.ts`) y las llama `lib/engine/remote.ts` desde el navegador. Si usas un servicio propio (opción B del [README](README.md)), ese servicio expone **exactamente las mismas rutas, cuerpos y respuestas**, y las rutas de Next.js solo lo reenvían y validan.

Los esquemas formales están en [`esquemas.json`](esquemas.json). Los tipos TypeScript de referencia están en [`lib/types.ts`](../../lib/types.ts) y [`lib/engine/types.ts`](../../lib/engine/types.ts).

## Reglas comunes

- Método `POST`, `Content-Type: application/json`, respuestas JSON en UTF-8. Nunca `GET`: el proyecto tiene `cacheComponents: true` y estas respuestas no deben cachearse.
- Todo el texto que ve el estudiante va **en español**, en texto plano (sin Markdown, sin emojis, sin listas con viñetas): se muestra tal cual y la guía de voz lo lee en voz alta.
- Cuerpo máximo de la solicitud: **32 KB**. Si se excede → `400`.
- Tiempo máximo del lado del servidor: **25 s** por solicitud (incluido el reintento). Si se excede → `504`.
- **Un reintento** ante respuesta inválida del modelo (JSON roto, forma incorrecta, IDs desconocidos). Si el segundo intento también falla → `502`.
- No guardar el contenido de las solicitudes ni de las respuestas. Registrar solo ruta, duración, modelo y código de error.

### Errores

Cualquier error devuelve este cuerpo:

```json
{ "error": { "kind": "quota", "message": "Se alcanzó el límite de uso del modelo." } }
```

| HTTP | `kind` | Cuándo | `EngineError.kind` en el cliente |
| --- | --- | --- | --- |
| `400` | `bad_request` | Cuerpo inválido o demasiado grande, `branchId` desconocido. | `invalid_response` |
| `429` | `quota` | El proveedor devolvió límite de cuota o de velocidad. | `quota` |
| `502` | `invalid_response` | El modelo respondió dos veces algo que no pasa la validación. | `invalid_response` |
| `503` | `unavailable` | Falta configuración (`AI_API_KEY`, `AI_MODEL` o `AI_SERVICE_URL`) o el proveedor está caído. | `network` |
| `504` | `timeout` | Se superaron los 25 s. | `network` |
| — | — | `fetch` falla en el navegador (sin red) o pasan 30 s sin respuesta. | `network` |

`message` es para registros y depuración; la interfaz muestra sus propios textos y nunca enseña el mensaje del proveedor. Nunca incluir claves, URLs internas ni el prompt en `message`.

---

## `POST /api/chat`

Siguiente turno del asistente. Implementa `DiscoveryEngine.reply(history)`.

La interfaz lo llama en dos situaciones:

1. **Conversación:** después de cada mensaje del estudiante, hasta que se responde `readyForProfile: true`. Entonces el composer se oculta y aparece «Revisar mi perfil».
2. **Panel de conversación del Perfil:** el estudiante puede seguir escribiendo o hablando después de tener borrador. Aquí el modelo responde dudas o recoge datos nuevos.

El primer mensaje del asistente **no** pasa por esta ruta: lo genera `start()` en el cliente (ver la guía).

### Solicitud

```json
{
  "messages": [
    { "role": "assistant", "text": "Hola. Para empezar, cuéntame qué te gusta hacer, dentro o fuera de clases." },
    { "role": "user", "text": "Me gusta programar y armar cosas con Arduino" }
  ]
}
```

| Campo | Tipo | Reglas |
| --- | --- | --- |
| `messages` | `{ role, text }[]` | Historial completo en orden. Empieza con un mensaje del asistente y **termina siempre con uno del estudiante**. `role` es `"assistant"` o `"user"`. |
| `messages[].text` | `string` | Del estudiante: 1–500 caracteres (límite del composer y del dictado). Del asistente: hasta 600. |

El cliente no envía los `id` de los mensajes. El servidor **recorta a los últimos 20 mensajes** antes de llamar al modelo.

### Respuesta `200`

```json
{
  "text": "¡Buena combinación! Programación y electrónica abren varias puertas. ¿Qué te gustaría lograr al unirte a un club?",
  "suggestions": ["Conocer gente", "Ganar experiencia profesional", "Crear proyectos propios"],
  "readyForProfile": false
}
```

| Campo | Tipo | Reglas |
| --- | --- | --- |
| `text` | `string` | 1–600 caracteres, idealmente menos de 300. Una sola pregunta por turno. Se lee en voz alta: frases cortas, sin símbolos ni Markdown. |
| `suggestions` | `string[]` | 0–3 respuestas rápidas que el **estudiante** podría enviar (escritas en primera persona o como frase corta), 1–60 caracteres cada una, sin repetir. Vacío cuando `readyForProfile` es `true`. |
| `readyForProfile` | `boolean` | `true` cuando ya se sabe algo de **intereses**, **objetivos** y **disponibilidad** (vale «no lo sé» como disponibilidad). |

Comportamiento esperado:

- Cubrir los tres temas en el orden intereses → objetivos → disponibilidad, una pregunta a la vez. Si una respuesta ya cubre varios, saltar los cubiertos.
- **Tope de turnos:** si el historial ya tiene 6 mensajes del estudiante, el servidor fuerza `readyForProfile: true` aunque falte información.
- El turno con `readyForProfile: true` cierra la conversación con un texto como «Listo. Armé un borrador de tu perfil con lo que escribiste. Revísalo y corrige lo que no encaje antes de seguir.»
- Después de ese cierre (panel del Perfil), responder con normalidad y volver a poner `readyForProfile: true` solo si el estudiante aportó un dato nuevo del perfil. En ese caso la interfaz llama otra vez a `/api/perfil`, pero **solo rellena campos que el estudiante dejó vacíos**: no pisa lo que ya editó.
- No recomendar clubes en el chat ni prometer resultados: eso ocurre en el paso Clubes.

---

## `POST /api/perfil`

Borrador de perfil a partir de la conversación. Implementa `DiscoveryEngine.proposeProfile(history)`. El estudiante revisa y corrige el borrador antes de seguir; el modelo nunca lo confirma.

### Solicitud

Mismo cuerpo que `/api/chat`:

```json
{
  "messages": [
    { "role": "assistant", "text": "Hola. Para empezar, cuéntame qué te gusta hacer, dentro o fuera de clases." },
    { "role": "user", "text": "Me gusta programar y armar cosas con Arduino" },
    { "role": "assistant", "text": "¿Qué te gustaría lograr al unirte a un club?" },
    { "role": "user", "text": "Conocer gente y hacer proyectos para mi portafolio" },
    { "role": "assistant", "text": "¿Cuánto tiempo libre tienes y en qué momentos?" },
    { "role": "user", "text": "Los sábados en la mañana" },
    { "role": "assistant", "text": "Listo. Armé un borrador de tu perfil con lo que escribiste. Revísalo y corrige lo que no encaje antes de seguir." }
  ]
}
```

Al modelo se le envían **solo los mensajes del estudiante** (y, si hace falta, la pregunta que respondían). No se le envía catálogo ni ramas.

### Respuesta `200`

```json
{
  "name": "",
  "career": "",
  "interests": ["programación", "electrónica"],
  "goals": ["conocer gente", "crear proyectos"],
  "availability": "Sábados por la mañana"
}
```

| Campo | Tipo | Reglas |
| --- | --- | --- |
| `name` | `string` | `""` salvo que el estudiante lo haya dicho literalmente («me llamo Ana»). Nunca inferirlo. Máximo 60. |
| `career` | `string` | `""` salvo que la haya dicho literalmente. Nunca inferirla. Máximo 80. |
| `interests` | `string[]` | 1–**4** etiquetas (`MAX_PROFILE_INTERESTS`), 1–60 caracteres, en minúsculas salvo siglas («IoT»), de 1 a 4 palabras, sin repetir. Si no se reconoce nada, una sola etiqueta con lo que escribió el estudiante, recortada. |
| `goals` | `string[]` | 0–4 frases cortas en infinitivo o como objetivo («conocer gente», «ganar experiencia profesional»), 1–60 caracteres. |
| `availability` | `string \| null` | Texto breve (máximo 120) con lo que dijo el estudiante, o `null` si dijo que no sabe, que depende, o no respondió. |

Estilo de etiquetas: se parecen a las del vocabulario de la demo ([`lib/demo/vocabulary.ts`](../../lib/demo/vocabulary.ts)): «programación», «apps y web», «inteligencia artificial y datos», «robótica», «cine», «debate y oratoria», «conocer gente», «aprender en talleres y cursos». No es obligatorio usar esas palabras exactas.

---

## `POST /api/recomendar`

Hasta tres clubes de la rama elegida, con la explicación de por qué aparecen. Implementa `DiscoveryEngine.recommend(input)`.

### Solicitud

```json
{
  "branchId": "programacion",
  "profile": {
    "interests": ["programación", "electrónica"],
    "goals": ["conocer gente", "crear proyectos"],
    "availability": "Sábados por la mañana"
  },
  "exclude": []
}
```

| Campo | Tipo | Reglas |
| --- | --- | --- |
| `branchId` | `BranchId` | Uno de `programacion`, `robotica`, `tierra`, `industria`, `arte`, `cultura`, `comunidad`, `otras`. Otro valor → `400`. |
| `profile` | objeto | **Sin `name` ni `career`**: no hacen falta para recomendar. `interests` y `goals` hasta 4 elementos; `availability` texto o `null`. |
| `exclude` | `string[]` | IDs ya mostrados (por ejemplo `"club-21"`), para «Ver otras organizaciones». Puede estar vacío. |

El cliente **no envía los candidatos**. El servidor los obtiene del catálogo con `clubsInBranch(branchId)` ([`lib/catalog/index.ts`](../../lib/catalog/index.ts)), quita los de `exclude` y solo esos (`pendientes`) van al modelo, con estos campos y omitiendo los `null`:

```json
[
  { "id": "club-12", "name": "Kokoa", "type": "club", "faculty": "FIEC", "category": "software_hardware_libre", "description": "Comunidad de código abierto y tecnologías libres" },
  { "id": "club-21", "name": "CIAP", "type": "club", "faculty": "FIEC", "category": "inteligencia_artificial_datos", "description": "Promueve IA y análisis de datos mediante talleres conferencias y proyectos" },
  { "id": "club-22", "name": "PHYCOM", "type": "club", "faculty": "FIEC", "category": "electronica_robotica", "description": "Impulsa electrónica programación y robótica con proyectos creativos" }
]
```

También se le envían el nombre y la descripción de la rama (`BRANCH_BY_ID[branchId].name` y `.blurb`). Nunca el catálogo completo, ni contactos, ni URLs de fuente: el panel ya los muestra desde el catálogo.

Si `exclude` deja la lista de pendientes vacía, el servidor responde `{ "recommendations": [] }` sin llamar al modelo (la interfaz ya reinicia `exclude` antes de llegar a ese caso).

### Respuesta `200`

```json
{
  "recommendations": [
    {
      "clubId": "club-22",
      "reasons": [
        "Combina dos de tus intereses: su descripción habla de «electrónica» y «programación».",
        "Tu objetivo «crear proyectos» encaja con sus «proyectos creativos».",
        "El catálogo no incluye horarios: confirma con el club si encaja con los sábados por la mañana."
      ]
    },
    {
      "clubId": "club-21",
      "reasons": [
        "Trabaja con «IA y análisis de datos», cercano a tu interés en programación.",
        "Organiza «talleres conferencias y proyectos», útil para tu objetivo «crear proyectos».",
        "El catálogo no incluye horarios: confirma con el club si encaja con los sábados por la mañana."
      ]
    },
    {
      "clubId": "club-12",
      "reasons": [
        "Se presenta como «Comunidad de código abierto»: buen lugar para programar y conocer gente.",
        "El catálogo no incluye horarios: confirma con el club si encaja con los sábados por la mañana."
      ]
    }
  ]
}
```

| Campo | Tipo | Reglas |
| --- | --- | --- |
| `recommendations` | `{ clubId, reasons }[]` | Exactamente `min(3, pendientes)` elementos, **del más al menos relacionado**. |
| `clubId` | `string` | Un `id` de los pendientes enviados al modelo. Sin repetir. |
| `reasons` | `string[]` | 1–3 frases, sin repetir dentro del mismo club (se usan como `key` de React). |
| `reasons[0]` | `string` | Se muestra en el **frente de la tarjeta** como resumen: la razón más fuerte, máximo 140 caracteres. |
| `reasons[1..]` | `string` | Se muestran al voltear la tarjeta, en «Por qué aparece». Máximo 220 caracteres cada una. |

Reglas de contenido de `reasons` (detalle en [`prompts.md`](prompts.md)):

- Cada razón se apoya en un dato del catálogo enviado (descripción, categoría, tipo o facultad). Las palabras citadas del catálogo van entre comillas «», copiadas tal cual.
- Si el club no coincide de forma directa, decirlo: «Aparece porque pertenece a la rama «Programación y datos». Su descripción no menciona tus intereses de forma directa.»
- El catálogo **no tiene** actividades, requisitos ni horarios. No inventarlos. Si hay `availability`, la última razón recuerda confirmar el horario con el club.
- Sin puntajes, porcentajes, rankings («el mejor») ni promesas («te aceptarán»).

### Validación obligatoria en el servidor

Antes de responder `200`:

1. Parsear el JSON del modelo y extraer la lista.
2. `validateRecommendations(lista, new Set(idsPendientes))` ([`lib/engine/validate.ts`](../../lib/engine/validate.ts)): lista, máximo 3, IDs existentes y únicos, `reasons` no vacías.
3. Además: longitud `min(3, pendientes)`, `reasons` de 1–3 elementos, únicas, `reasons[0]` ≤ 140 y el resto ≤ 220 caracteres (recortar con «…» si se pasa por poco; si viene vacía, inválida).
4. Si falla → un reintento con el error de validación añadido al prompt. Si vuelve a fallar → `502`.

Que el formato sea válido no garantiza que la explicación sea cierta: las explicaciones requieren revisión manual del equipo antes de la demo.

---

## Opción B: cuerpo que recibe el servicio propio

Si los modelos corren en un servicio aparte (`AI_SERVICE_URL`), las rutas de Next.js le reenvían la solicitud y validan su respuesta con las mismas reglas. El servicio implementa las mismas tres rutas con estas diferencias:

- `/api/chat` y `/api/perfil`: mismo cuerpo, con `messages` ya recortado a los últimos 20. Misma respuesta.
- `/api/recomendar`: el servicio no tiene el catálogo, así que Next.js añade `branch` y `candidates` (ya sin los de `exclude`). Misma respuesta.

```json
{
  "branchId": "programacion",
  "profile": { "interests": ["programación", "electrónica"], "goals": ["crear proyectos"], "availability": "Sábados por la mañana" },
  "exclude": [],
  "branch": { "id": "programacion", "name": "Programación y datos", "blurb": "Software, web, apps, inteligencia artificial y código abierto." },
  "candidates": [
    { "id": "club-12", "name": "Kokoa", "type": "club", "faculty": "FIEC", "category": "software_hardware_libre", "description": "Comunidad de código abierto y tecnologías libres" }
  ]
}
```

Autenticación: si se define `AI_SERVICE_TOKEN`, Next.js envía `Authorization: Bearer <token>` y el servicio debe rechazar cualquier otra solicitud. Errores: el servicio responde `429` ante cuota y cualquier otro estado no exitoso se trata como `503`. El servicio no debe ser accesible desde el navegador.

---

## Resumen de datos enviados al modelo

| Ruta | Se envía | No se envía nunca |
| --- | --- | --- |
| `/api/chat` | Últimos 20 mensajes de la conversación. | Perfil, catálogo, audio. |
| `/api/perfil` | Mensajes del estudiante (y la pregunta que respondían). | Catálogo, ramas, audio. |
| `/api/recomendar` | Intereses, objetivos, disponibilidad; rama (nombre y descripción); clubes pendientes de la rama con `id`, `name`, `type`, `faculty`, `category`, `description`. | Nombre, carrera, conversación, contactos, catálogo completo. |

Antes de habilitar el envío real hay que informar al estudiante del proveedor y obtener su autorización (pendiente de definir con el equipo, ver README raíz).
