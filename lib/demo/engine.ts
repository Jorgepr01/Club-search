import { BRANCH_BY_ID } from "@/lib/catalog/branches";
import type { DiscoveryEngine, AssistantTurn } from "@/lib/engine/types";
import { validateRecommendations, MAX_RECOMMENDATIONS } from "@/lib/engine/validate";
import {
  MAX_PROFILE_INTERESTS,
  type BranchId,
  type ChatMessage,
  type Club,
  type Profile,
  type Recommendation,
} from "@/lib/types";
import {
  GOALS,
  INTERESTS,
  detect,
  findEvidence,
  normalizeText,
  patternsForTerm,
  type Evidence,
  type VocabEntry,
} from "./vocabulary";

// Motor de demostración: preguntas fijas y reglas de palabras clave en el navegador.
// No usa inteligencia artificial y la interfaz lo indica en todo momento.

const SCRIPT: AssistantTurn[] = [
  {
    text: "Hola. Para empezar, cuéntame qué te gusta hacer, dentro o fuera de clases.",
    suggestions: ["Programar y hacer apps", "Robótica y electrónica", "Cine, fotografía y dibujo"],
    readyForProfile: false,
  },
  {
    text: "Buenísimo. ¿Qué te gustaría lograr al unirte a un club?",
    suggestions: ["Conocer gente", "Ganar experiencia profesional", "Aprender en talleres y crear proyectos"],
    readyForProfile: false,
  },
  {
    text: "Última pregunta: ¿cuánto tiempo libre tienes y en qué momentos?",
    suggestions: ["Un par de horas entre semana", "Sábados por la mañana", "Todavía no lo sé"],
    readyForProfile: false,
  },
  {
    text: "Listo. Armé un borrador de tu perfil con lo que escribiste. Revísalo y corrige lo que no encaje antes de seguir.",
    suggestions: [],
    readyForProfile: true,
  },
];

function userAnswers(history: ChatMessage[]): string[] {
  return history.filter((m) => m.role === "user").map((m) => m.text.trim());
}

function shorten(text: string, max = 80): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function quoteList(items: string[]): string {
  const quoted = items.map((i) => `«${i}»`);
  if (quoted.length <= 1) return quoted.join("");
  return `${quoted.slice(0, -1).join(", ")} y ${quoted.at(-1)}`;
}

interface Match {
  term: string;
  evidence: Evidence;
}

function matchTerms(terms: string[], entries: VocabEntry[], club: Club): Match[] {
  return terms.flatMap((term) => {
    const patterns = patternsForTerm(term, entries);
    const evidence =
      findEvidence(club.description, patterns, "descripción") ?? findEvidence(club.category, patterns, "categoría");
    return evidence ? [{ term, evidence }] : [];
  });
}

function describe(kind: "interés" | "objetivo", matches: Match[]): string[] {
  const plural = kind === "interés" ? "intereses" : "objetivos";
  // Agrupamos por palabra del catálogo para no repetir la misma evidencia.
  const byWord = new Map<string, Match[]>();
  for (const m of matches) {
    const key = `${m.evidence.field}:${m.evidence.word.toLowerCase()}`;
    byWord.set(key, [...(byWord.get(key) ?? []), m]);
  }
  return [...byWord.values()].slice(0, 3).map((group) => {
    const { word, field } = group[0].evidence;
    const terms = group.map((g) => g.term);
    const subject = terms.length === 1 ? `Tu ${kind}` : `Tus ${plural}`;
    return `${subject} ${quoteList(terms)} ${terms.length === 1 ? "coincide" : "coinciden"} con «${word}» en su ${field} del catálogo.`;
  });
}

export function explainClub(club: Club, profile: Profile, branchId: BranchId) {
  const interests = matchTerms(profile.interests, INTERESTS, club);
  const goals = matchTerms(profile.goals, GOALS, club);
  const reasons = [...describe("interés", interests), ...describe("objetivo", goals)];

  if (reasons.length === 0) {
    reasons.push(
      `Aparece porque pertenece a la rama «${BRANCH_BY_ID[branchId].name}». Su descripción no menciona tus intereses ni tus objetivos de forma directa.`,
    );
  }
  reasons.push(
    profile.availability
      ? `El catálogo no incluye horarios: confirma con el club si encaja con «${shorten(profile.availability, 60)}».`
      : "El catálogo no incluye horarios.",
  );
  return { reasons, score: interests.length * 2 + goals.length };
}

export function suggestedBranches(profile: Profile): BranchId[] {
  const ids = new Set<BranchId>();
  for (const term of profile.interests) {
    for (const entry of detect(INTERESTS, term)) entry.branches?.forEach((b) => ids.add(b));
  }
  return [...ids];
}

const UNKNOWN_AVAILABILITY = /^(todavia |aun )?no (lo )?se\b|^no estoy segur|^depende\b|^ni idea\b/;

export function profileFromAnswers(answers: string[]): Profile {
  const all = answers.join(" \n ");
  const interests = detect(INTERESTS, all).map((e) => e.label);
  const goals = detect(GOALS, answers.slice(1).join(" \n ") || all).map((e) => e.label);
  const [interestAnswer = "", goalAnswer = "", availabilityAnswer = ""] = answers;

  return {
    name: "",
    career: "",
    // Si no reconocemos nada, conservamos lo que escribió para que pueda corregirlo.
    interests: (interests.length > 0 ? interests : interestAnswer ? [shorten(interestAnswer, 60)] : []).slice(
      0,
      MAX_PROFILE_INTERESTS,
    ),
    goals: goals.length > 0 ? goals : goalAnswer ? [shorten(goalAnswer, 60)] : [],
    availability:
      availabilityAnswer && !UNKNOWN_AVAILABILITY.test(normalizeText(availabilityAnswer))
        ? shorten(availabilityAnswer, 120)
        : null,
  };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const demoEngine: DiscoveryEngine = {
  mode: "demo",

  start() {
    return SCRIPT[0];
  },

  async reply(history) {
    await wait(450);
    const answered = userAnswers(history).length;
    return SCRIPT[Math.min(answered, SCRIPT.length - 1)];
  },

  async proposeProfile(history) {
    return profileFromAnswers(userAnswers(history));
  },

  async recommend({ profile, branchId, candidates, exclude }) {
    const ranked = candidates
      .filter((c) => !exclude.includes(c.id))
      .map((club, index) => ({ club, index, ...explainClub(club, profile, branchId) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, MAX_RECOMMENDATIONS);

    const result: Recommendation[] = ranked.map((r) => ({ clubId: r.club.id, reasons: r.reasons }));
    const checked = validateRecommendations(result, new Set(candidates.map((c) => c.id)));
    if (!checked.ok) throw new Error(checked.error);
    return checked.recommendations;
  },
};
