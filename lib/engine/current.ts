import { demoEngine } from "@/lib/demo/engine";
import { remoteEngine } from "./remote";
import type { DiscoveryEngine } from "./types";

// Motor activo para toda la interfaz. NEXT_PUBLIC_ENGINE=ia usa Gemma; si no, la demo por reglas.
export const engine: DiscoveryEngine = process.env.NEXT_PUBLIC_ENGINE === "ia" ? remoteEngine : demoEngine;
export const usesModel = engine.mode !== "demo";
