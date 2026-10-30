import { ACTIVE_BRANCHES, CLUB_BY_ID } from "@/lib/catalog";
import { MAX_PROFILE_INTERESTS, type BranchId, type Profile } from "@/lib/types";
import type { Step } from "./steps";
import { captureTail, normalize } from "./voiceCommands";

// Acciones de voz de cada paso: lo que la guía puede hacer además de navegar.
// Para que la guía interactúe con algo nuevo, agrega una entrada en `actionsFor`
// con un ejemplo (se muestra en la guía) y una función `run`.

export interface VoiceAction {
  /** Ejemplo que se muestra en la guía, sin la palabra clave: «confirmar perfil». */
  example: string;
  /**
   * Recibe la orden tal como se dijo, sin «Guía». Si es para esta acción, la ejecuta
   * y devuelve lo que la guía responde; si no, devuelve null y se prueba la siguiente.
   */
  run: (said: string) => string | null;
}

export interface VoiceContext {
  profile: Profile | null;
  updateProfile: (profile: Profile) => void;
  confirmProfile: () => void;
  setConversationOpen: (open: boolean) => void;
  chooseBranch: (id: BranchId) => void;
  /** Clubes que se ven ahora, en orden. */
  clubIds: string[];
  openClub: (id: string) => void;
  flipClub: () => void;
  canShowOthers: boolean;
  showOthers: () => void;
}

// Palabras que no ayudan a reconocer un nombre de rama o de club.
const STOPWORDS = new Set([
  "y", "e", "de", "del", "la", "el", "los", "las", "en", "por", "para", "un", "una",
  "club", "clubes", "espol", "rama", "ramas", "otras", "organizaciones", "abre", "abrir",
  "elige", "elegir", "quiero", "ver", "muestra", "mostrar", "sobre", "cuentame",
]);

function words(text: string) {
  return normalize(text)
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/** La opción cuyo nombre comparte más palabras con lo dicho; también reconoce siglas deletreadas. */
function bestMatch<T>(said: string, options: T[], name: (option: T) => string): T | null {
  const heard = new Set(words(said));
  const squashed = normalize(said).replace(/\s+/g, "");
  let best: T | null = null;
  let bestScore = 0;
  for (const option of options) {
    const nameWords = words(name(option));
    let score = nameWords.filter((w) => heard.has(w)).length;
    // «a s m e» o «asme» para ASME: siglas de 3 letras o más.
    if (nameWords.some((w) => w.length >= 3 && /^[a-z0-9]+$/.test(w) && name(option).includes(w.toUpperCase()) && squashed.includes(w)))
      score += 2;
    if (score > bestScore) {
      best = option;
      bestScore = score;
    }
  }
  return best;
}

const CONNECTORS = new Set(["de", "del", "en", "y", "e", "la", "las", "el", "los"]);

/** «ingeniería en computación» → «Ingeniería en Computación». */
function capitalize(text: string) {
  return text
    .split(/\s+/)
    .map((word, i) => (i > 0 && CONNECTORS.has(word.toLowerCase()) ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

const ORDINALS: [RegExp, number][] = [
  [/\b(primer[oa]?|uno|1)\b/, 0],
  [/\b(segund[oa]|dos|2)\b/, 1],
  [/\b(tercer[oa]?|tres|3)\b/, 2],
];

function profileActions(ctx: VoiceContext): VoiceAction[] {
  const profile = ctx.profile;
  if (!profile) return [];
  const set = (patch: Partial<Profile>) => ctx.updateProfile({ ...profile, ...patch });

  function addTo(field: "interests" | "goals", label: string, value: string) {
    const items = profile![field];
    if (items.some((i) => normalize(i) === normalize(value))) return `«${value}» ya está en tus ${label}.`;
    if (field === "interests" && items.length >= MAX_PROFILE_INTERESTS)
      return `Ya tienes ${MAX_PROFILE_INTERESTS} intereses. Quita uno para agregar otro.`;
    set({ [field]: [...items, value] });
    return `Agregué «${value}» a tus ${label}.`;
  }

  return [
    {
      example: "me llamo Ana",
      run: (said) => {
        const name = captureTail(said, /\b(?:mi nombre es|me llamo|llamame)\s+(.+)$/);
        if (!name) return null;
        set({ name: capitalize(name) });
        return `Listo, tu nombre es ${capitalize(name)}.`;
      },
    },
    {
      example: "mi carrera es Computación",
      run: (said) => {
        const career = captureTail(said, /\b(?:mi carrera es|estudio|estoy en)\s+(.+)$/);
        if (!career) return null;
        set({ career: capitalize(career) });
        return `Listo, tu carrera es ${capitalize(career)}.`;
      },
    },
    {
      example: "agrega interés fotografía",
      run: (said) => {
        const value = captureTail(said, /\b(?:agrega|agregar|anade|anadir|suma|pon)\s+(?:un\s+|el\s+|como\s+)?interes(?:es)?\s+(?:en\s+|de\s+|por\s+)?(.+)$/);
        return value ? addTo("interests", "intereses", value.toLowerCase()) : null;
      },
    },
    {
      example: "agrega objetivo hacer amigos",
      run: (said) => {
        const value = captureTail(said, /\b(?:agrega|agregar|anade|anadir|suma|pon)\s+(?:un\s+|el\s+|como\s+)?(?:objetivo|objetivos|meta|metas)\s+(?:de\s+)?(.+)$/);
        return value ? addTo("goals", "objetivos", value.toLowerCase()) : null;
      },
    },
    {
      example: "quita fotografía",
      run: (said) => {
        const value = captureTail(said, /\b(?:quita|quitar|borra|borrar|elimina|eliminar|saca)\s+(?:el\s+|la\s+)?(?:interes\s+|objetivo\s+)?(.+)$/);
        if (!value) return null;
        const target = normalize(value);
        const interest = profile.interests.find((i) => normalize(i) === target);
        const goal = profile.goals.find((g) => normalize(g) === target);
        if (interest) set({ interests: profile.interests.filter((i) => i !== interest) });
        else if (goal) set({ goals: profile.goals.filter((g) => g !== goal) });
        else return `No encontré «${value}» en tu perfil.`;
        return `Quité «${interest ?? goal}» de tu perfil.`;
      },
    },
    {
      example: "mi disponibilidad es cinco horas",
      run: (said) => {
        const value = captureTail(said, /\b(?:mi disponibilidad es|disponibilidad|tengo disponibles?)\s+(.+)$/);
        if (!value) return null;
        set({ availability: value });
        return `Listo, tu disponibilidad es ${value}.`;
      },
    },
    {
      example: "abre la conversación",
      run: (said) => {
        const text = normalize(said);
        if (!/\b(conversacion|chat)\b/.test(text)) return null;
        if (/\b(cierra|cerrar|oculta|ocultar)\b/.test(text)) {
          ctx.setConversationOpen(false);
          return "Cerré la conversación.";
        }
        if (!/\b(abre|abrir|muestra|mostrar)\b/.test(text)) return null;
        ctx.setConversationOpen(true);
        return "Abrí la conversación. Puedes seguir respondiendo con tu voz.";
      },
    },
    {
      example: "confirmar perfil",
      run: (said) => {
        if (!/\b(confirma|confirmar|confirmo|confirmalo|guarda|guardar|listo)\b/.test(normalize(said))) return null;
        if (profile.interests.length === 0 && profile.goals.length === 0)
          return "Antes agrega al menos un interés u objetivo. Por ejemplo: «Guía, agrega interés fotografía».";
        ctx.confirmProfile();
        return "Perfil confirmado. Ahora elige una rama: di su nombre, por ejemplo «Guía, robótica».";
      },
    },
  ];
}

function treeActions(ctx: VoiceContext): VoiceAction[] {
  const [first] = ACTIVE_BRANCHES;
  return [
    {
      example: first ? `elige ${first.name.toLowerCase()}` : "elige una rama",
      run: (said) => {
        const branch = bestMatch(said, ACTIVE_BRANCHES, (b) => b.name);
        if (!branch) return null;
        ctx.chooseBranch(branch.id);
        return `Abriendo ${branch.name}. Di «Guía, abre el primero» para conocer un club.`;
      },
    },
  ];
}

function clubActions(ctx: VoiceContext): VoiceAction[] {
  const clubs = ctx.clubIds.map((id) => CLUB_BY_ID.get(id)).filter((c) => c !== undefined);
  const describe = (index: number) => {
    const club = clubs[index];
    ctx.openClub(club.id);
    const about = club.description?.split(/(?<=\.)\s/)[0] ?? "No tenemos descripción de esta organización.";
    return `${club.name}. ${about}`;
  };

  return [
    {
      example: "ver otras organizaciones",
      run: (said) => {
        if (!/\b(otras|otros|mas opciones|ver mas|mas clubes|mas organizaciones)\b/.test(normalize(said))) return null;
        if (!ctx.canShowOthers) return "No hay más organizaciones en esta rama. Di «Guía, ir a ramas» para explorar otra.";
        ctx.showOthers();
        return "Te muestro otras organizaciones de esta rama.";
      },
    },
    {
      example: "voltea la tarjeta",
      run: (said) => {
        if (!/\b(voltea|voltear|gira|girar|da vuelta|cierra|cerrar)\b/.test(normalize(said))) return null;
        ctx.flipClub();
        return "Listo.";
      },
    },
    {
      example: "abre el primero",
      run: (said) => {
        const text = normalize(said);
        const ordinal = ORDINALS.find(([pattern]) => pattern.test(text));
        if (!ordinal || ordinal[1] >= clubs.length) return null;
        return describe(ordinal[1]);
      },
    },
    {
      example: clubs[0] ? `abre ${clubs[0].name}` : "abre un club por su nombre",
      run: (said) => {
        const club = bestMatch(said, clubs, (c) => c.name);
        return club ? describe(clubs.indexOf(club)) : null;
      },
    },
  ];
}

/** Acciones disponibles en un paso; la navegación general vive en voiceCommands.ts. */
export function actionsFor(step: Step, ctx: VoiceContext): VoiceAction[] {
  if (step === "profile") return profileActions(ctx);
  if (step === "tree") return treeActions(ctx);
  if (step === "clubs") return clubActions(ctx);
  return [];
}
