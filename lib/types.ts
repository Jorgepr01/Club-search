// Tipos compartidos por la interfaz, el catálogo y los motores (demo o Gemma).

/** Registro tal como llega del catálogo del equipo (data/catalogo-clubes.json). */
export interface CatalogRecord {
  id: string;
  nombre: string;
  tipo: string | null;
  facultad: string | null;
  categoria: string | null;
  descripcion: string | null;
  contacto: string | null;
  fuente_url: string | null;
  fecha_extraccion: string | null;
}

export type BranchId =
  | "programacion"
  | "robotica"
  | "tierra"
  | "industria"
  | "arte"
  | "cultura"
  | "comunidad"
  | "otras";

export type ContactKind = "web" | "email" | "instagram" | "facebook" | "handle" | "text";

export interface ClubContact {
  kind: ContactKind;
  /** Texto original del catálogo, sin modificar. */
  raw: string;
  /** Solo se llena cuando el catálogo trae una URL o un correo explícitos. */
  href: string | null;
}

/** Club normalizado. Los campos ausentes en el catálogo quedan en null. */
export interface Club {
  id: string;
  name: string;
  type: string | null;
  faculty: string | null;
  category: string | null;
  description: string | null;
  contact: ClubContact | null;
  sourceUrl: string | null;
  extractedAt: string | null;
  branches: BranchId[];
  /** El catálogo actual no incluye estos campos; se mantienen para el futuro. */
  activities: string[] | null;
  requirements: string | null;
  schedule: string | null;
  logoUrl: string | null;
  imageUrl: string | null;
}

export interface Branch {
  id: BranchId;
  name: string;
  blurb: string;
  /** Laca del panel y color de texto legible sobre ella. */
  color: string;
  ink: string;
}

export interface Profile {
  name: string;
  career: string;
  interests: string[];
  goals: string[];
  availability: string | null;
}

export const MAX_PROFILE_INTERESTS = 4;

export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
}

/** Recomendación que el motor devuelve; el texto de la explicación nunca es un puntaje. */
export interface Recommendation {
  clubId: string;
  reasons: string[];
}
