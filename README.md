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
2. **Conversación:** pantalla amplia con respuestas sugeridas, texto libre o dictado por voz si el navegador lo admite. El primer envío abre el perfil propuesto; desde allí se puede volver al chat y seguir respondiendo.
3. **Perfil:** intereses y objetivos como etiquetas editables y disponibilidad como texto. Hay que confirmarlo para seguir.
4. **Ramas:** árbol con conexiones SVG desde «Tu perfil». Las ramas relacionadas con el perfil aparecen marcadas.
5. **Clubes:** hasta tres paneles por rama. Al abrir uno, el panel se expande y muestra por qué aparece, los datos del catálogo (facultad, ubicación, áreas, miembros), contacto, redes, documentos públicos, próximos eventos (calculados al abrir el panel) y la fuente. Si el club tiene un evento abierto con inscripción, también aparece como razón.
6. **Navegación:** «Volver a las ramas», «Explorar otra rama», «Ver otras organizaciones de esta rama» y los pasos de la barra superior.

## Qué está simulado y qué es real

| Parte | Estado |
| --- | --- |
| Catálogo de clubes | **Real**: 43 organizaciones (40 de la plataforma de clubes, entregada el 30-10-2026, más 3 del directorio de Bienestar de ESPOL extraído el 29-10-2026) y 194 eventos. |
| Conversación | **Simulada**: preguntas fijas en `lib/demo/engine.ts`. |
| Perfil propuesto | **Reglas**: detección de palabras clave (`lib/demo/vocabulary.ts`). Si no reconoce nada, conserva el texto del estudiante para que lo corrija. |
| Ramas | **Agrupación editorial** del equipo (`lib/catalog/branches.ts`), basada en el campo `categoria`. No es un dato oficial. |
| Orden y explicaciones | **Reglas**: cuentan las coincidencias entre el perfil y la descripción o categoría del catálogo. Cada explicación cita la palabra exacta del catálogo que coincidió. No se muestran puntajes. |
| Logos e imágenes | **Gráficos provisionales** (sigla sobre el color de la rama) hasta que se registren fotos en `data/medios-clubes.json`. |

Los datos ausentes (actividades, requisitos, horario y, a veces, contacto) se muestran como «Información no disponible». Los usuarios de Instagram y Facebook se muestran como texto y se marcan como «sin verificar»: solo se enlazan las URL y los correos que vienen explícitos en el catálogo.

## Estructura

```
app/                      layout, página y estilos globales (tokens y componentes)
components/experience/    pasos del recorrido, paneles, árbol y conexiones SVG
data/                     catálogo fusionado, eventos y fuentes (data/fuentes/)
lib/types.ts              tipos compartidos (Club, Profile, Recommendation…)
lib/catalog/              carga y normalización del catálogo, ramas
lib/engine/               contrato DiscoveryEngine y validación de recomendaciones
lib/demo/                 motor de demostración por reglas
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

## Accesibilidad y diseño

- Botones semánticos, foco visible, navegación completa con teclado y foco movido al título de cada paso.
- `prefers-reduced-motion`: Motion usa `reducedMotion="user"` y el CSS desactiva transiciones. Las conexiones SVG se dibujan sin animación.
- Las conexiones SVG son decorativas (`aria-hidden`): la relación rama → club también está en el texto.
- Diseño para escritorio (paneles lado a lado que se expanden) y teléfono (lectura vertical).
- Portada basada en el video de referencia: anillo con insignias en órbita. Los paneles de clubes mantienen las lacas de color y las placas tipo museo.

## Pendientes

- Cargar las fotos de los clubes.
- Conectar Gemma y registrar el modelo realmente probado y sus límites.
- Revisar contactos y vigencia de cada organización. Conseguir logos y fotos con permiso.
- Elegir licencia.
