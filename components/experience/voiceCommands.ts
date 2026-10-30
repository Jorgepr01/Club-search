import type { Step } from "./steps";

// Comandos de voz generales de la guía: moverse entre pasos y controlar la lectura.
// Lo propio de cada paso (confirmar el perfil, elegir una rama…) está en voiceActions.ts.

export type VoiceCommand =
  | { type: "go"; step: Step }
  | { type: "next" }
  | { type: "back" }
  | { type: "repeat" }
  | { type: "stop" }
  | { type: "help" };

// Primero los destinos: «volver a ramas» debe ir a Ramas, no al paso anterior.
// Basta con nombrar el paso, así sirve cualquier verbo: «ir a ramas», «vamos a ramas», «llévame a ramas».
const TARGETS: [Step, RegExp][] = [
  ["welcome", /\b(inicio|bienvenida|portada|principio)\b/],
  ["chat", /\b(conversacion|chat|preguntas)\b/],
  ["profile", /\bperfil\b/],
  ["tree", /\b(ramas?|intereses)\b/],
  ["clubs", /\b(clubes|clubs|club|organizaciones)\b/],
];

const ACTIONS: [Exclude<VoiceCommand["type"], "go">, RegExp][] = [
  ["next", /\b(siguiente|adelante|continuar?|continua|continuemos|avanzar?|avanza|avancemos|sigue|seguir|sigamos|empezar|empieza|empecemos|comenzar|comienza|comencemos)\b/],
  ["back", /\b(atras|anterior|volver|vuelve|volvamos|regresar?|regresa|regresemos|retroceder?|retrocede|retrocedamos)\b/],
  // «vamos» o «vámonos» a secas es avanzar; «vamos atrás» ya lo tomó la línea anterior.
  ["next", /^\s*(vamos|vamonos|dale)\s*$/],
  ["repeat", /\b(repite|repetir|otra vez|lee|leer|escuchar)\b/],
  ["help", /\b(ayuda|que puedo decir|comandos|opciones)\b/],
  ["stop", /\b(para|parar|detente|deten|silencio|callate|calla|basta|stop)\b/],
];

/**
 * Minúsculas, sin tildes ni signos. Conserva la longitud de un texto en NFC, así una
 * posición encontrada en el texto normalizado sirve para recortar el original.
 */
export function normalize(text: string) {
  return text
    .normalize("NFC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ");
}

/** Palabra clave que convierte una frase en orden: «Guía, siguiente». Sin ella, la frase va al chat. */
export const WAKE_WORD = "Guía";
const WAKE = /^\s*(?:(?:oye|hola|ok|okay)\s+)?guia\b\s*(.*)$/;

/**
 * Devuelve la orden sin la palabra clave, tal como se dijo (con mayúsculas y tildes,
 * para guardar nombres), o null si la frase no empieza con ella.
 */
export function stripWakeWord(text: string): string | null {
  const raw = text.normalize("NFC");
  const match = WAKE.exec(normalize(raw));
  return match ? raw.slice(match[0].length - match[1].length).trim() : null;
}

/**
 * Busca `pattern` en la frase normalizada y devuelve, del texto original, lo que
 * captura su último grupo (que debe llegar hasta el final de la frase).
 */
export function captureTail(said: string, pattern: RegExp): string | null {
  const raw = said.normalize("NFC");
  const match = pattern.exec(normalize(raw));
  if (!match) return null;
  const tail = match[match.length - 1] ?? "";
  const start = match.index + match[0].length - tail.length;
  return raw.slice(start).replace(/[.,;:!?¡¿]+$/g, "").trim() || null;
}

export function parseVoiceCommand(text: string): VoiceCommand | null {
  const said = normalize(text);
  for (const [step, pattern] of TARGETS) if (pattern.test(said)) return { type: "go", step };
  for (const [type, pattern] of ACTIONS) if (pattern.test(said)) return { type };
  return null;
}
