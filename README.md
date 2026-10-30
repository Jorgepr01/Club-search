# Encuentra tu comunidad en ESPOL

Demo navegable para que estudiantes de ESPOL descubran hasta tres clubes u organizaciones afines a partir de una conversación, un perfil editable y un árbol de intereses.

> **Estado:** con `NEXT_PUBLIC_ENGINE=ia`, la conversación, el perfil y las recomendaciones los genera **Gemma 4** (`gemma-4-26b-a4b-it`, Gemini API) desde el servidor. Sin esa variable se usa la demo por reglas, sin IA, y la interfaz lo indica. Ver [Conectar Gemma](#conectar-gemma).

## Ejecutar

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>. Para una versión de producción: `npm run build && npm start`.

Para usar Gemma, crea `.env.local` (ver [Conectar Gemma](#conectar-gemma)). Sin él, la página funciona con la demo por reglas.

## Recorrido

1. **Bienvenida:** título, aviso de demo y un anillo por el que giran las fotos de los clubes con estela de movimiento (botón para pausarlo).
2. **Conversación:** tres preguntas fijas (intereses, objetivos y disponibilidad), con respuestas sugeridas, texto libre o dictado por micrófono. Cada pregunta puede escucharse en voz alta. Ver [Chat y audio](#chat-y-audio).
3. **Perfil:** nombre, carrera, hasta cuatro intereses como etiquetas editables, objetivos y disponibilidad. Hay que confirmarlo para seguir.
4. **Ramas:** árbol con conexiones SVG desde «Tu perfil». Las ramas relacionadas con el perfil aparecen marcadas.
5. **Clubes:** hasta tres paneles por rama. Al abrir uno, el panel se expande y muestra por qué aparece, los datos del catálogo (facultad, ubicación, áreas, miembros), contacto, redes, documentos públicos, próximos eventos (calculados al abrir el panel) y la fuente. Si el club tiene un evento abierto con inscripción, también aparece como razón.
6. **Navegación:** «Volver a las ramas», «Explorar otra rama», «Ver otras organizaciones de esta rama» y los pasos de la barra superior.

## Qué está simulado y qué es real

| Parte | Estado |
| --- | --- |
| Catálogo de clubes | **Real**: 43 organizaciones (40 de la plataforma de clubes, entregada el 30-10-2026, más 3 del directorio de Bienestar de ESPOL extraído el 29-10-2026) y 194 eventos. |
| Conversación | **Gemma 4** con `NEXT_PUBLIC_ENGINE=ia` (`/api/chat`). En modo demo: preguntas fijas en `lib/demo/engine.ts`. |
| Dictado y lectura en voz alta | **Del navegador**: Web Speech API. Ningún servicio de pago ni clave del proyecto. |
| Perfil propuesto | **Gemma 4** (`/api/perfil`), validado en el servidor: nombre y carrera solo si el estudiante los escribió. En modo demo: palabras clave (`lib/demo/vocabulary.ts`). |
| Ramas | **Agrupación editorial** del equipo (`lib/catalog/branches.ts`), basada en el campo `categoria`. No es un dato oficial. |
| Orden y explicaciones | **Gemma 4** (`/api/recomendar`): elige solo entre los clubes de la rama y cita el catálogo entre «». El servidor valida IDs y longitudes; la veracidad requiere revisión manual. En modo demo: reglas de coincidencia. No se muestran puntajes. |
| Logos e imágenes | **Gráficos provisionales** (sigla sobre el color de la rama) hasta que se registren fotos en `data/medios-clubes.json`. |

Los datos ausentes (actividades, requisitos, horario y, a veces, contacto) se muestran como «Información no disponible». Los usuarios de Instagram y Facebook se muestran como texto y se marcan como «sin verificar»: solo se enlazan las URL y los correos que vienen explícitos en el catálogo.

## Estructura

```
app/                      layout, página y estilos globales (tokens y componentes)
components/experience/    pasos del recorrido, paneles, árbol y conexiones SVG
data/                     catálogo fusionado, eventos y fuentes (data/fuentes/)
lib/types.ts              tipos compartidos (Club, Profile, Recommendation…)
lib/catalog/              carga y normalización del catálogo, ramas
app/api/                  rutas de IA: chat, perfil y recomendar (servidor)
lib/ai/                   llamada a Gemma, instrucciones y lectura de solicitudes (server-only)
lib/engine/               contrato DiscoveryEngine, motor remoto, selección de motor y validación
lib/demo/                 motor de demostración por reglas
lib/speech/               adaptadores de dictado y lectura en voz alta (Web Speech API)
scripts/                  construir-catalogo, descargar-logos y csv-a-json
```

## Actualizar el catálogo

Las fuentes están en `data/fuentes/`:

| Archivo | Papel |
| --- | --- |
| `clubes-plataforma.json` | **Fuente principal** (40 clubes de la plataforma de clubes): nombre, sigla, descripción, ubicación, facultad, áreas de interés, redes, documentos públicos, miembros y estado. |
| `directorio-oe.csv` / `.json` | Directorio de Bienestar (31 organizaciones). Aporta `tipo`, `categoria`, `contacto` y `fuente_url` a los clubes que también están en la plataforma. |
| `cruce-directorio.json` | Cruce manual entre ids del directorio y de la plataforma. Las 3 organizaciones con `null` (asociaciones de facultad) solo existen en el directorio y se conservan. |
| `categorias-clubes.json` | Categoría por id de la plataforma (tiene prioridad sobre la del directorio). Aquí se asignan las categorías de los clubes que no estaban en el directorio. |
| `eventos-plataforma.json` | Eventos de los clubes. |

1. Reemplaza o edita los archivos de `data/fuentes/` (si cambias el CSV, ejecuta `node scripts/csv-a-json.mjs`).
2. Ejecuta `npm run catalogo`: fusiona las fuentes, valida (ids únicos, eventos con club existente, URLs y fechas válidas) y escribe `data/catalogo-clubes.json` y `data/eventos-clubes.json`. Falla si hay errores y lista como avisos los clubes sin descripción o sin categoría.
3. La plataforma no trae `categoria`: los clubes sin categoría caen en «Otras organizaciones» hasta que se asigne en `categorias-clubes.json` y su valor exista en `CATEGORY_BRANCHES` (`lib/catalog/branches.ts`). `npm run catalogo` lista los pendientes.
4. Los eventos se filtran al abrir la página (`upcomingEvents`), no al compilar.

## Añadir fotos y logos de clubes

0. `npm run logos` descarga los logos de la plataforma a `public/clubes/` y los registra solo (necesita acceso a los sitios de ESPOL).
1. O copia los archivos a `public/clubes/` (por ejemplo `public/clubes/22.jpg` y `public/clubes/22-logo.png`). Usa solo imágenes con permiso.
2. Regístralos en `data/medios-clubes.json` con el `id` del catálogo:

   ```json
   {
     "22": { "foto": "/clubes/22.jpg", "logo": "/clubes/22-logo.png" }
   }
   ```

3. Las fotos aparecen en el anillo de la portada (primero los clubes con foto) y en el panel del club. En el panel, el logo tiene prioridad sobre la foto; si no hay ninguno o no cargan, se muestra la sigla del club. Recomendado: fotos cuadradas de al menos 400 × 400 px y logos con fondo transparente.

## Conectar Gemma

Contrato, esquemas e instrucciones completos en [`docs/integracion-ia/`](docs/integracion-ia/README.md).

1. Crea una clave en [Google AI Studio](https://aistudio.google.com/apikey).
2. Crea `.env.local` en la raíz (está en `.gitignore`; nunca lo subas):

   ```dotenv
   # "ia" activa Gemma; sin esta variable se usa la demo por reglas.
   NEXT_PUBLIC_ENGINE=ia
   # Solo en el servidor: nunca con prefijo NEXT_PUBLIC_.
   AI_API_KEY=tu_clave
   AI_MODEL=gemma-4-26b-a4b-it
   ```

3. `npm run dev`. La etiqueta de la cabecera cambia de «Demo sin IA» a «Con IA».

Cómo funciona: el navegador usa `remoteEngine` (`lib/engine/remote.ts`), que llama a `POST /api/chat`, `/api/perfil` y `/api/recomendar`. Esas rutas llaman a Gemini API con la clave del servidor (`lib/ai/model.ts`), validan la respuesta (`lib/engine/validate.ts`) y reintentan una vez si no es válida. Si el modelo falla, la interfaz muestra un error recuperable; nunca cae en silencio a la demo.

**Modelo probado (30-10-2026):** `gemma-4-26b-a4b-it` con `responseMimeType: "application/json"` y `thinkingLevel: "minimal"`. Acepta `systemInstruction` y un historial que empieza con el asistente. Las partes de razonamiento (`thought: true`) se descartan.

| Ruta | Latencia observada |
| --- | --- |
| `/api/chat` | 1,6–3,3 s |
| `/api/perfil` | 2,2–2,7 s |
| `/api/recomendar` | 7,3–9,3 s |

Mientras llegan las recomendaciones, el paso Clubes muestra «Preparando recomendaciones…». `gemma-4-31b-it` respondió `500` en una prueba y no se usa. Las cuotas dependen del proyecto: revísalas en AI Studio; con cuota agotada la ruta responde `429` y la interfaz pide esperar.

**Privacidad:** al modelo solo llegan la conversación (últimos 20 mensajes), las respuestas del estudiante para el perfil y, al recomendar, intereses, objetivos, disponibilidad y los clubes de la rama. Nunca nombre ni carrera al recomendar, ni audio. Los registros del servidor solo guardan ruta, estado, duración y modelo. Falta definir con el equipo el aviso al estudiante de que sus respuestas se envían a Google.

Pruebas rápidas (con el servidor en marcha):

```bash
curl -s localhost:3000/api/recomendar -H 'Content-Type: application/json' -d '{"branchId":"programacion","profile":{"interests":["programación"],"goals":["crear proyectos"],"availability":null},"exclude":[]}'
```

Que el formato sea válido no garantiza que la explicación sea verdadera: revisa que cada cita entre «» exista en el catálogo.

## Chat y audio

La conversación usa [assistant-ui](https://www.assistant-ui.com) (`@assistant-ui/react` 0.15) con `useExternalStoreRuntime`: los mensajes siguen viviendo en `Experience.tsx` y el runtime solo los presenta, así que hay una sola fuente de verdad y el motor de demostración no cambió.

- **Adaptador** (`components/experience/Conversation.tsx`): convierte cada `ChatMessage` conservando su ID y rol; `isRunning` refleja la espera de la siguiente pregunta; `isSendDisabled` bloquea el envío mientras llega la pregunta y al terminar; las sugerencias del turno se pasan como `suggestions` y se envían con un clic sin borrar lo que el estudiante ya había escrito.
- **Sin funciones de modelo:** no se pasan `onEdit`, `onReload`, `onCancel` ni `setMessages`, por lo que no aparecen editar, regenerar, cancelar ni ramas.
- **Composer:** crece con el texto, máximo 500 caracteres (también para el dictado). Enter envía, Shift + Enter agrega una línea y se respeta la composición IME. Mientras llega la pregunta se puede seguir escribiendo, pero no enviar.
- **Historial:** se desplaza dentro del panel y solo sigue el final si el estudiante ya está abajo. Los lectores de pantalla escuchan cada pregunta nueva una sola vez.
- **Cierre:** al terminar se ocultan el composer y las sugerencias, el micrófono se detiene y el foco pasa a «Revisar mi perfil».

### Dictado (voz a texto)

`lib/speech/dictation.ts` implementa el `DictationAdapter` de assistant-ui con el reconocimiento de voz del navegador. No usa `WebSpeechDictationAdapter` directamente porque hacía falta explicar cada error y probar varios idiomas.

- Se dicta con el micrófono de la guía de voz (ver «Guía de voz»), no desde el composer. Al detenerlo sin errores, lo dictado se envía como respuesta; si el reconocimiento falla, no se envía nada.
- Idioma: `es-EC`; si el navegador no lo admite, prueba `es-419` y luego `es-ES`.
- Solo se usan frases finales; el texto provisional se muestra aparte en la barra de la guía mientras se habla.
- Mensajes para permiso denegado, falta de micrófono, falta de red, silencio, idioma no disponible y navegador sin soporte. Escribir siempre sigue disponible.
- Se detiene al cambiar de paso, al pulsar detener o descartar, tras 60 segundos de mensaje o 10 de orden; el mensaje se recorta a 500 caracteres.

**Limitaciones según navegador.** Chrome y Edge envían el audio a un servicio de reconocimiento del propio navegador: necesitan conexión y el audio no se procesa solo en el dispositivo. Safari (macOS e iOS) también lo ofrece y puede depender de los servicios de dictado de Apple. Firefox no tiene reconocimiento de voz: allí el micrófono aparece como no disponible. La calidad del español y la disponibilidad de `es-EC` dependen del navegador. En Chrome para Android el modo continuo puede comportarse distinto.

### Lectura en voz alta (texto a voz)

`lib/speech/synthesis.ts` implementa el `SpeechSynthesisAdapter` con `speechSynthesis`. Cada mensaje de la guía tiene «Escuchar respuesta», que pasa a «Detener lectura» mientras suena.

- Elige una voz en español: primero `es-EC`, luego otras de Latinoamérica, luego `es-ES`. Si el sistema no tiene voces en español, el navegador usa la que tenga.
- Nunca suenan dos lecturas a la vez. Se reproduce sola solo si se activó «Leer guía y respuestas» o si se le habló al chat por voz. Se detiene al salir del chat y al empezar a dictar.
- Si el navegador no tiene `speechSynthesis`, el botón no aparece y el texto sigue disponible.

No hay conversación de voz en tiempo real: cada mensaje se envía al pulsar detener.

### Probado y pendiente

Se verificaron en el navegador integrado: el recorrido completo hasta Clubes, el envío por texto y por sugerencias, el bloqueo durante la espera y al terminar, el diseño en escritorio y teléfono (incluida una altura reducida como la del teclado abierto), el error de permiso del micrófono y el caso sin soporte. La lógica de transcripción (texto previo, parciales, duplicados, idioma de respaldo, límite) y la de lectura (una sola a la vez, detener) se probaron con las API del navegador simuladas. **No se probó la captura real del micrófono ni la reproducción real de voz**: falta probar en Chrome, Edge, Safari y Android.

## Accesibilidad y diseño

- Botones semánticos, foco visible, navegación completa con teclado y foco movido al título de cada paso. Los botones de micrófono y lectura cambian de etiqueta sin perder el foco.
- `prefers-reduced-motion`: Motion usa `reducedMotion="user"` y el CSS desactiva transiciones. Las conexiones SVG se dibujan sin animación.
- Las conexiones SVG son decorativas (`aria-hidden`): la relación rama → club también está en el texto.
- Diseño para escritorio (paneles lado a lado que se expanden) y teléfono (lectura vertical).
- Portada basada en el video de referencia: anillo con insignias en órbita. Los paneles de clubes mantienen las lacas de color y las placas tipo museo.

## Pendientes

- Cargar las fotos de los clubes.
- Definir y mostrar el aviso de que las respuestas se envían a Google (Gemini API) antes de conversar.
- Revisar a mano al menos una recomendación de Gemma por rama.
- Probar dictado y lectura con micrófono y altavoces reales en Google Chrome (la voz se hace solo con la Web Speech API del navegador; no hay modelo de voz local). En Linux, Chromium no trae el servicio de reconocimiento de Google: usar Google Chrome.
- Revisar contactos y vigencia de cada organización. Conseguir logos y fotos con permiso.
- Elegir licencia.

## Guía de voz: navegación del recorrido

La guía es una barra fija al pie de la página y la forma principal de moverse por el recorrido (no hay barra de pasos en la cabecera). Muestra el paso actual («Paso 2 de 4 · Perfil»), una indicación breve y los botones **Atrás** y **Siguiente**. Cuando un paso aún no está disponible, Siguiente queda atenuado y la barra explica qué falta: responder las preguntas, confirmar el perfil o elegir una rama. Al pulsar el resumen se abren los detalles: la guía completa con «Escuchar», el interruptor «Leer guía y respuestas» (lee la guía al cambiar de paso y, en la conversación, cada respuesta nueva), la lista de pasos para saltar a cualquiera ya disponible y los comandos de voz.

La guía tiene un solo micrófono con dos usos, que se distinguen por la palabra clave «Guía» al inicio de la frase:

- **Navegar:** «Guía, siguiente», «Guía, atrás», «Guía, ir a perfil / ramas / clubes» (también «vamos a…», «volvamos a…» o «llévame a…»: basta con nombrar el paso), «Guía, vamos», «Guía, inicio», «Guía, repite», «Guía, para» o «Guía, ayuda» (ver `components/experience/voiceCommands.ts`). Se ejecuta al terminar la frase y la guía responde en voz alta. En los pasos sin chat, una frase sin la palabra clave recibe una indicación de cómo empezarla.
- **Conversar con el chat** (en Conversación y Perfil): se habla normal, sin «Guía». Lo dicho se acumula en la barra y se envía al pulsar detener (✕ lo descarta); la respuesta del chat se lee en voz alta. En el Perfil se abre el panel de conversación para ver la respuesta.

Además de navegar, en cada paso la guía puede actuar sobre la página (las órdenes también empiezan con «Guía»):

- **Perfil:** «me llamo Ana», «mi carrera es Computación», «agrega interés fotografía», «agrega objetivo hacer amigos», «quita fotografía», «mi disponibilidad es cinco horas», «abre / cierra la conversación» y «confirmar perfil».
- **Ramas:** decir el nombre de una rama la elige («Guía, robótica»).
- **Clubes:** «abre el primero / segundo / tercero» o «abre PHYCOM» voltea la tarjeta y lee su descripción; «ver otras organizaciones» y «voltea la tarjeta».

Para que la guía haga algo nuevo, agrega una entrada en `actionsFor` (`components/experience/voiceActions.ts`): un `example` que se muestra en la guía y una función `run(said)` que ejecuta la acción y devuelve lo que la guía responde, o `null` si la frase no es para ella. Si la acción necesita algo de la página, agrégalo a `VoiceContext` y pásalo desde `Experience`. Las acciones del paso se prueban antes que la navegación.

Por eso el composer del chat ya no tiene micrófono: hay un solo punto de voz en la página. Todo usa las API de voz del navegador; el reconocimiento puede enviar audio a un servicio del navegador y requiere permiso.

### Contrato propuesto para conectar un modelo

Aún no hay integración con un modelo; antes de enviar datos hay que informar del proveedor y obtener la autorización de la persona. No enviar audio, nombre ni carrera por defecto. Limitar el historial y no conservarlo de forma persistente. Los datos concretos para cada solicitud serían:

- **Bienvenida:** etapa y pregunta actual, sin perfil ni catálogo.
- **Conversación:** pregunta actual y los turnos de conversación necesarios para responder; para proponer el perfil, las respuestas aportadas por el estudiante. No enviar el catálogo completo.
- **Perfil:** pregunta actual y solo los campos editables pertinentes del borrador; marcar las inferencias como propuestas. No confirmar ni guardar por voz.
- **Ramas:** pregunta actual y los intereses y objetivos confirmados, junto con identificadores y descripciones de las ramas disponibles. La selección sigue siendo manual.
- **Clubes:** pregunta actual, rama seleccionada, intereses y objetivos pertinentes y campos públicos disponibles de los clubes que se muestran; incluir disponibilidad solo cuando sea relevante. No inventar datos ausentes ni seleccionar o abrir un club por voz.

Validar en servidor cualquier respuesta estructurada contra IDs y datos del catálogo; mantener la clave en el servidor y ofrecer error recuperable. La definición exacta del proveedor, consentimiento, retención y límites del contexto requiere validación del equipo antes de habilitar el envío.

### Ensayo de tiempos en la computadora de la demo

Con micrófono, altavoces y red reales, medir al menos cinco turnos por etapa y anotar navegador, dispositivo y condiciones de red. Registrar por separado: fin de la frase → transcripción final; transcripción → respuesta del modelo (cuando exista); respuesta → inicio del audio; y fin de la frase → inicio y fin de la respuesta hablada. Anotar mediana, peor caso, errores y si el reconocimiento necesita reintentos. Probar también permiso denegado, red desconectada, interrupción del audio y navegación durante una lectura. Esta medición sigue pendiente: las pruebas locales de compilación no sustituyen el ensayo en el equipo de la demo.
