<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Conectar modelos de IA

Si tu tarea es conectar modelos de IA a la interfaz, empieza por [`docs/integracion-ia/README.md`](docs/integracion-ia/README.md). El contrato HTTP que la interfaz espera está en [`docs/integracion-ia/contrato-api.md`](docs/integracion-ia/contrato-api.md) (esquemas en `esquemas.json`, instrucciones en `prompts.md`, pasos en `guia-implementacion.md`). No cambies el diseño (CSS ni marcado de `components/experience/`): la integración se hace detrás de la interfaz `DiscoveryEngine` (`lib/engine/types.ts`).
