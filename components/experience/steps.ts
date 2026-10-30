export type Step = "welcome" | "chat" | "profile" | "tree" | "clubs";

/** Pasos numerados del recorrido; la bienvenida queda fuera de la cuenta. */
export const STEPS: { id: Exclude<Step, "welcome">; label: string }[] = [
  { id: "chat", label: "Conversación" },
  { id: "profile", label: "Perfil" },
  { id: "tree", label: "Ramas" },
  { id: "clubs", label: "Clubes" },
];
