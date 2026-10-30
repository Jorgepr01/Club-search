# Encuentra tu comunidad en ESPOL

Demo navegable para que estudiantes de ESPOL descubran hasta tres clubes u organizaciones afines a partir de una conversación, un perfil editable y un árbol de intereses.

> **Estado:** demo para presentar el concepto. La conversación es simulada y **no usa inteligencia artificial**. Gemma todavía no está conectado.

## Ejecutar

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>. Para una versión de producción: `npm run build && npm start`.

## Recorrido

1. **Bienvenida:** título, aviso de demo y un anillo por el que giran las fotos de los clubes con estela de movimiento (botón para pausarlo).
2. **Conversación:** tres preguntas fijas (intereses, objetivos y disponibilidad), con respuestas sugeridas, texto libre o dictado por micrófono. Cada pregunta puede escucharse en voz alta. Ver [Chat y audio](#chat-y-audio).
3. **Perfil:** nombre, carrera, hasta cuatro intereses como etiquetas editables, objetivos y disponibilidad. Hay que confirmarlo para seguir.
4. **Ramas:** árbol con conexiones SVG desde «Tu perfil». Las ramas relacionadas con el perfil aparecen marcadas.
5. **Clubes:** hasta tres paneles por rama. Al abrir uno, el panel se expande y muestra por qué aparece, los datos del catálogo, el contacto (si existe) y la fuente.
6. **Navegación:** «Volver a las ramas», «Explorar otra rama», «Ver otras organizaciones de esta rama» y los pasos de la barra superior.

## Qué está simulado y qué es real

| Parte | Estado |
| --- | --- |
| Catálogo de clubes | **Real**: 31 organizaciones de `data/catalogo-clubes.csv`, extraídas el 29-10-2026 de los directorios públicos de ESPOL. |
| Conversación | **Simulada**: preguntas fijas en `lib/demo/engine.ts`. La interfaz de chat usa assistant-ui, pero no hay ningún modelo detrás. |
| Dictado y lectura en voz alta | **Del navegador**: Web Speech API. Ningún servicio de pago ni clave del proyecto. |
| Perfil propuesto | **Reglas**: detección de palabras clave (`lib/demo/vocabulary.ts`). Si no reconoce nada, conserva el texto del estudiante para que lo corrija. |
| Ramas | **Agrupación editorial** del equipo (`lib/catalog/branches.ts`), basada en el campo `categoria`. No es un dato oficial. |
| Orden y explicaciones | **Reglas**: cuentan las coincidencias entre el perfil y la descripción o categoría del catálogo. Cada explicación cita la palabra exacta del catálogo que coincidió. No se muestran puntajes. |
| Logos e imágenes | **Gráficos provisionales** (sigla sobre el color de la rama) hasta que se registren fotos en `data/medios-clubes.json`. |

Los datos ausentes (actividades, requisitos, horario y, a veces, contacto) se muestran como «Información no disponible». Los usuarios de Instagram y Facebook se muestran como texto y se marcan como «sin verificar»: solo se enlazan las URL y los correos que vienen explícitos en el catálogo.

## Estructura

```
app/                      layout, página y estilos globales (tokens y componentes)
components/experience/    pasos del recorrido, paneles, árbol y conexiones SVG
data/                     catálogo fuente (CSV) y su versión JSON
lib/types.ts              tipos compartidos (Club, Profile, Recommendation…)
lib/catalog/              carga y normalización del catálogo, ramas
lib/engine/               contrato DiscoveryEngine y validación de recomendaciones
lib/demo/                 motor de demostración por reglas
lib/speech/               adaptadores de dictado y lectura en voz alta (Web Speech API)
scripts/csv-a-json.mjs    regenera data/catalogo-clubes.json desde el CSV
```

## Actualizar el catálogo

1. Edita o reemplaza `data/catalogo-clubes.csv` conservando las columnas.
2. Ejecuta `node scripts/csv-a-json.mjs`.
3. Si aparece una `categoria` nueva, asígnale ramas en `CATEGORY_BRANCHES` (`lib/catalog/branches.ts`). Mientras no tenga, el club cae en «Otras organizaciones».
4. Cuando existan logos, fotos, actividades, requisitos u horarios, añádelos como columnas y mapea los campos en `normalize()` (`lib/catalog/index.ts`). La interfaz ya los muestra cuando no son `null`.

## Añadir fotos y logos de clubes

1. Copia los archivos a `public/clubes/` (por ejemplo `public/clubes/22.jpg` y `public/clubes/22-logo.png`). Usa solo imágenes con permiso.
2. Regístralos en `data/medios-clubes.json` con el `id` del catálogo:

   ```json
   {
     "22": { "foto": "/clubes/22.jpg", "logo": "/clubes/22-logo.png" }
   }
   ```

3. Las fotos aparecen en el anillo de la portada (primero los clubes con foto) y en el panel del club. En el panel, el logo tiene prioridad sobre la foto; si no hay ninguno o no cargan, se muestra la sigla del club. Recomendado: fotos cuadradas de al menos 400 × 400 px y logos con fondo transparente.

## Conectar Gemma

> La guía completa para conectar modelos (contrato HTTP, esquemas, instrucciones y pasos) está en [`docs/integracion-ia/`](docs/integracion-ia/README.md). Este apartado es el resumen original.

La interfaz solo habla con la interfaz `DiscoveryEngine` (`lib/engine/types.ts`):

- `reply(history)`: siguiente turno del asistente y sugerencias.
- `proposeProfile(history)`: perfil propuesto (nombre, carrera, hasta cuatro intereses, objetivos y disponibilidad).
- `recommend({ profile, branchId, candidates, exclude })`: hasta tres `{ clubId, reasons }`.

Pasos sugeridos:

1. Crea rutas del servidor (por ejemplo `app/api/chat/route.ts` y `app/api/recomendar/route.ts`) que llamen a Gemma con la clave en una variable de entorno (`GEMINI_API_KEY`) y el modelo en otra (`GEMMA_MODEL`, candidato: `gemma-4-26b-a4b-it`, pendiente de probar con la cuenta del equipo). La clave nunca debe llegar al cliente.
2. En `recommend`, envía solo el perfil y los clubes de la rama elegida. Pide IDs existentes y justificaciones ligadas a datos del catálogo.
3. Valida la respuesta en el servidor con `validateRecommendations` (`lib/engine/validate.ts`): JSON válido, IDs existentes y únicos, máximo tres y texto no vacío. Reintenta una vez; si falla, lanza `EngineError` para que la interfaz muestre el error recuperable sin perder el perfil.
4. Crea un `gemmaEngine` con `mode: "gemma"` que llame a esas rutas y cámbialo por `demoEngine` en `components/experience/Experience.tsx`. Actualiza los avisos de «Demo sin IA».

Que el formato sea válido no garantiza que la explicación sea verdadera: las explicaciones requieren revisión manual.

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
- Conectar Gemma y registrar el modelo realmente probado y sus límites. Al conectarlo, `isRunning` y `onNew` del adaptador de assistant-ui ya están listos; habría que añadir `onCancel` solo si el motor permite cancelar.
- Probar dictado y lectura con micrófono y altavoces reales en Chrome, Edge, Safari (macOS e iOS) y Chrome para Android.
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
