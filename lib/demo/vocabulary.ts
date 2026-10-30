import type { BranchId } from "@/lib/types";

// Vocabulario de la demo. Reemplaza la interpretación que hará Gemma: detecta palabras
// clave en lo que escribe el estudiante y en el texto del catálogo. Es deliberadamente simple.

export interface VocabEntry {
  label: string;
  /** Fuentes de expresiones regulares sobre texto sin tildes y en minúsculas; se anclan al inicio de palabra. */
  patterns: string[];
  branches?: BranchId[];
}

export const INTERESTS: VocabEntry[] = [
  { label: "programación", patterns: ["program", "codig", "codear", "software", "desarroll", "python", "javascript", "java\\b"], branches: ["programacion"] },
  { label: "apps y web", patterns: ["apps?\\b", "aplicaciones? (web|movil)", "web\\b", "pagina web", "movil"], branches: ["programacion"] },
  { label: "inteligencia artificial y datos", patterns: ["ia\\b", "inteligencia artificial", "machine learning", "datos", "data\\b"], branches: ["programacion"] },
  { label: "videojuegos", patterns: ["videojuego", "juegos", "gaming", "gamer"], branches: ["programacion", "arte"] },
  { label: "código abierto", patterns: ["libre", "open source", "linux", "codigo abierto"], branches: ["programacion"] },
  { label: "robótica", patterns: ["robot"], branches: ["robotica"] },
  { label: "electrónica", patterns: ["electron", "circuit", "arduino", "hardware", "sensor"], branches: ["robotica"] },
  { label: "IoT", patterns: ["iot\\b", "internet de las cosas", "domotic"], branches: ["robotica"] },
  { label: "mecatrónica y automatización", patterns: ["mecatron", "automatiz", "dron", "impresion 3d", "manufactura"], branches: ["robotica"] },
  { label: "construcción", patterns: ["civil", "construc", "hormig", "cemento", "puente", "estructura"], branches: ["tierra"] },
  { label: "geología y minería", patterns: ["geolog", "miner", "roca", "volcan", "petrol"], branches: ["tierra"] },
  { label: "agua y ambiente", patterns: ["agua", "hidro", "ambient", "rios?\\b", "mar\\b", "clima", "naturaleza"], branches: ["tierra"] },
  { label: "mapas y GIS", patterns: ["mapa", "gis\\b", "teledetec", "satel"], branches: ["tierra"] },
  { label: "mecánica", patterns: ["mecanic", "motor", "autos?\\b", "carros?\\b"], branches: ["industria"] },
  { label: "industria y procesos", patterns: ["industri", "proceso", "fabrica", "produccion"], branches: ["industria"] },
  { label: "alimentos", patterns: ["aliment", "comida", "cocina", "gastronom"], branches: ["industria", "cultura"] },
  { label: "logística", patterns: ["logist", "transport"], branches: ["industria"] },
  { label: "ilustración y animación", patterns: ["dibuj", "ilustr", "anima", "comic"], branches: ["arte"] },
  { label: "cine", patterns: ["cine", "pelicul", "series?\\b"], branches: ["arte"] },
  { label: "fotografía y video", patterns: ["foto", "video", "audiovisual", "camara", "grabar"], branches: ["arte"] },
  { label: "diseño", patterns: ["disen", "creativ"], branches: ["arte"] },
  { label: "cultura asiática", patterns: ["asia", "anime", "manga", "k-?pop", "japon", "corea", "china"], branches: ["cultura"] },
  { label: "arqueología e historia", patterns: ["arqueolog", "antropolog", "histori", "patrimonio"], branches: ["cultura"] },
  { label: "música y artes escénicas", patterns: ["music", "cantar", "guitarra", "banda", "danza", "bail", "teatro"], branches: ["cultura"] },
  { label: "debate y oratoria", patterns: ["debat", "orator", "hablar en publico", "argument"], branches: ["comunidad"] },
  { label: "liderazgo", patterns: ["lider"], branches: ["comunidad"] },
  { label: "voluntariado y fe", patterns: ["voluntar", "ayudar", "fe\\b", "catolic", "iglesia", "pastoral"], branches: ["comunidad"] },
  { label: "deporte", patterns: ["deport", "futbol", "basket", "correr", "gym", "entrenar"], branches: ["comunidad"] },
];

export const GOALS: VocabEntry[] = [
  { label: "conocer gente", patterns: ["amig", "gente", "conocer", "compañer", "companer", "comunidad"] },
  { label: "ganar experiencia profesional", patterns: ["experien", "cv\\b", "curricul", "practica", "profesional", "trabajo", "empleo"] },
  { label: "aprender en talleres y cursos", patterns: ["aprend", "cursos?\\b", "taller", "capacit", "charla"] },
  { label: "investigar", patterns: ["investig", "ciencia", "paper"] },
  { label: "crear proyectos", patterns: ["proyect", "crear", "construir", "prototip"] },
  { label: "emprender", patterns: ["emprend", "negocio", "startup"] },
  { label: "competir", patterns: ["competir", "competicion", "concurso", "hackat", "torneo"] },
  { label: "liderar", patterns: ["lider", "organizar"] },
  { label: "expresarme", patterns: ["expres", "creativ"] },
];

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/_/g, " ");
}

const compiled = new Map<string, RegExp>();
function toRegExp(pattern: string): RegExp {
  let re = compiled.get(pattern);
  if (!re) {
    re = new RegExp(`(?:^|[^a-z0-9])(?:${pattern})`);
    compiled.set(pattern, re);
  }
  return re;
}

export function entryMatches(entry: VocabEntry, normalized: string): boolean {
  return entry.patterns.some((p) => toRegExp(p).test(normalized));
}

export function detect(entries: VocabEntry[], text: string): VocabEntry[] {
  const normalized = normalizeText(text);
  return entries.filter((e) => entryMatches(e, normalized));
}

/**
 * Patrones para buscar un término del perfil en el catálogo. Si el término no está en el
 * vocabulario (porque el estudiante lo escribió a mano), se usan sus palabras largas como prefijos.
 */
export function patternsForTerm(term: string, entries: VocabEntry[]): string[] {
  const known = detect(entries, term);
  if (known.length > 0) return known.flatMap((e) => e.patterns);
  return normalizeText(term)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4)
    .map((w) => w.slice(0, Math.max(4, w.length - 2)));
}

export interface Evidence {
  /** Palabra tal como aparece en el catálogo, con tildes. */
  word: string;
  field: "descripción" | "categoría";
}

/** Busca la primera palabra del texto original que coincide con alguno de los patrones. */
export function findEvidence(
  original: string | null,
  patterns: string[],
  field: Evidence["field"],
): Evidence | null {
  if (!original) return null;
  // Normalizamos carácter por carácter para que los índices coincidan con el original.
  const chars = [...original];
  const normalized = chars.map((c) => normalizeText(c).charAt(0) || " ").join("");
  for (const p of patterns) {
    const match = new RegExp(`(^|[^a-z0-9])((?:${p})[a-z0-9]*)`).exec(normalized);
    if (match) {
      const start = match.index + match[1].length;
      const word = chars.slice(start, start + match[2].length).join("");
      return { word: field === "categoría" ? word.replaceAll("_", " ") : word, field };
    }
  }
  return null;
}
