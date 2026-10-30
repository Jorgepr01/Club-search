# Descubrimiento de clubes ESPOL: especificación MVP

Estado: borrador de trabajo para Claude. Basado en el resumen del equipo; el catálogo original y la referencia visual aún no están en este directorio.

## Objetivo

Ayudar a un estudiante a descubrir hasta tres clubes afines mediante una conversación, un perfil corregible y un árbol de intereses. Cada recomendación debe explicar su relación con el perfil y sustentarse en datos disponibles del catálogo.

## Recorrido

1. **Bienvenida:** «Encuentra tu comunidad en ESPOL» y acción para empezar.
2. **Conversación:** texto en español; preguntar por intereses, objetivos y disponibilidad sin convertir el recorrido en un formulario. Voz opcional mediante reconocimiento del navegador, con escritura siempre disponible.
3. **Contexto opcional:** permitir omitir GitHub o imágenes. GitHub tiene prioridad sobre imágenes si el tiempo es limitado; procesar imágenes solo después de probar la integración. Explicar qué se enviará al proveedor antes de compartir datos.
4. **Perfil:** mostrar intereses, objetivos y disponibilidad como información editable; no deducir datos personales sensibles ni presentar inferencias como hechos confirmados. Continuar después de confirmar.
5. **Árbol:** presentar ramas derivadas del perfil. Al elegir una, conectar visualmente la rama con las recomendaciones.
6. **Resultados:** mostrar hasta tres clubes distintos con nombre y una explicación concreta basada en el perfil y el catálogo. Si no hay tres candidatos sustentados, mostrar los disponibles y decirlo; no inventar clubes ni porcentajes.
7. **Detalle:** panel expansible con descripción, actividades, requisitos y contacto disponibles; indicar «Información no disponible» donde falten datos. Ofrecer volver al árbol y explorar alternativas.

## Dirección visual e interacción

- Next.js + React + Motion; paneles HTML/CSS y conexiones SVG. No se necesita Canvas ni React Flow.
- Inspiración acordada: paneles de guitarras con colores, imágenes grandes y expansión; tarjetas de museo con profundidad suave. El video original hace falta para validar el diseño final.
- En escritorio, los paneles comparten el espacio y el seleccionado se expande. En teléfono, priorizar lectura vertical y objetivos táctiles cómodos. Usar logo o foto solo si están disponibles y autorizados; emplear una alternativa gráfica cuando falten.
- Botones semánticos, foco visible, operación por teclado, nombres accesibles y `prefers-reduced-motion`. Las conexiones SVG son decorativas y no transmiten información exclusiva.

## Datos y recomendaciones

Usar el JSON real del equipo como fuente inicial, conservando sus campos y fuentes. No reconstruirlo desde la lista parcial del resumen. Añadir identificadores estables si faltan; representar datos desconocidos como `null` y separar verificación de Instagram de verificación general. Mostrar que el catálogo es una selección inicial y que la actividad puede haber cambiado.

Perfil mínimo: intereses (lista editable), objetivos (lista editable), disponibilidad (texto o `null`) y contexto opcional proporcionado por el usuario. Las ramas se derivan del perfil confirmado. Enviar a Gemma solo el contexto necesario y los datos del catálogo pertinentes; pedir identificadores existentes y una justificación vinculada a datos concretos. Validar la respuesta en el servidor: JSON válido, IDs existentes y únicos, máximo tres, texto no vacío. Ante respuesta inválida, reintentar una vez y luego mostrar un error recuperable; no inventar resultados. La calidad de las explicaciones requiere revisión manual: la validación de formato no garantiza veracidad.

## Integración y manejo de fallos

- Gemma interpreta la conversación, propone el perfil y participa en la selección y explicación. El servidor conserva la clave; nunca incluirla en el cliente ni en el repositorio. Configurar el identificador del modelo por variable de entorno.
- La documentación de Google enumera `gemma-4-26b-a4b-it` y `gemma-4-31b-it` en Gemini API y documenta entrada de imágenes. Usar el primero como candidato, sujeto a una prueba con la cuenta del equipo. [Documentación oficial](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api).
- Las cuotas dependen del proyecto y nivel; revisarlas en AI Studio. No asumir una cuota concreta. [Límites oficiales](https://ai.google.dev/gemini-api/docs/rate-limits).
- Mostrar estados de carga, error de red y límite de cuota con opción de reintentar, conservando la conversación y el perfil en la sesión. Si Gemma falla, no presentar contenido simulado como si proviniera del modelo. Cualquier modo de demostración debe estar identificado explícitamente.
- No solicitar contraseña institucional. Evitar almacenamiento persistente de conversaciones e imágenes para el MVP; informar al usuario antes de enviar información a servicios externos.

## Criterios de aceptación

- En móvil y escritorio se puede completar el recorrido con teclado y texto, corregir el perfil, elegir una rama, abrir un club y regresar.
- Los resultados contienen como máximo tres IDs distintos presentes en el catálogo, explicaciones relacionadas con el perfil y campos desconocidos claramente señalados.
- Una caída de API o cuota agotada produce un mensaje recuperable sin pérdida del perfil; no se exponen secretos.
- La interfaz sigue siendo usable con movimiento reducido y sin imágenes o voz.
- README del repositorio final documenta instalación, variables de entorno, ejecución, modelo Gemma realmente probado, limitaciones, fuentes del catálogo y licencia elegida.

## Pendientes antes de implementar y ensayar

1. Incorporar el JSON original de 31 organizaciones y revisar contactos, fuentes y fecha; obtener logos y fotos con permiso.
2. Probar texto con la clave y proyecto reales; registrar modelo, resultado y límites activos. Probar imagen por separado si se incluye.
3. Compartir el video de referencia y aprobar el diseño visual antes de pulir animaciones.
4. Confirmar responsables y registro de los cinco participantes; verificar por separado las condiciones del evento y premios.
5. Ensayar un recorrido real con datos incompletos, API no disponible y pantalla móvil.
