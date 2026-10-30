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

3. Las fotos aparecen en el anillo de la portada (primero los clubes con foto) y en el panel del club. El logo reemplaza a la sigla. Recomendado: fotos cuadradas de al menos 400 × 400 px.

## Conectar Gemma

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

- Solo empieza al pulsar el micrófono; el mismo botón lo detiene. Nunca envía lo reconocido: el texto queda en el cuadro para revisarlo y editarlo.
- Idioma: `es-EC`; si el navegador no lo admite, prueba `es-419` y luego `es-ES`.
- Al composer solo llegan frases finales y se agregan después de lo que ya estaba escrito. El texto provisional se muestra aparte, así no se duplican transcripciones parciales y se puede seguir escribiendo mientras se dicta.
- Mensajes para permiso denegado, falta de micrófono, falta de red, silencio, idioma no disponible y navegador sin soporte. Escribir siempre sigue disponible.
- Se detiene al salir del chat, al terminar la conversación, al enviar desde el cuadro y al llegar a 500 caracteres.

**Limitaciones según navegador.** Chrome y Edge envían el audio a un servicio de reconocimiento del propio navegador: necesitan conexión y el audio no se procesa solo en el dispositivo. Safari (macOS e iOS) también lo ofrece y puede depender de los servicios de dictado de Apple. Firefox no tiene reconocimiento de voz: allí el micrófono aparece como no disponible. La calidad del español y la disponibilidad de `es-EC` dependen del navegador. En Chrome para Android el modo continuo puede comportarse distinto.

### Lectura en voz alta (texto a voz)

`lib/speech/synthesis.ts` implementa el `SpeechSynthesisAdapter` con `speechSynthesis`. Cada mensaje de la guía tiene «Escuchar respuesta», que pasa a «Detener lectura» mientras suena.

- Elige una voz en español: primero `es-EC`, luego otras de Latinoamérica, luego `es-ES`. Si el sistema no tiene voces en español, el navegador usa la que tenga.
- Nunca se reproduce sola y nunca suenan dos lecturas a la vez. Se detiene al salir del chat y al empezar a dictar.
- Si el navegador no tiene `speechSynthesis`, el botón no aparece y el texto sigue disponible.

No hay conversación de voz en tiempo real.

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
