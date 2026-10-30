// Tipos compartidos por la interfaz, el catálogo y los motores (demo o Gemma).

/** Registro tal como lo genera scripts/construir-catalogo.mjs (data/catalogo-clubes.json). */
export interface CatalogRecord {
  id: string;
  /** "plataforma" (fuente principal) o "directorio" (solo figura en el directorio de Bienestar). */
  origen: "plataforma" | "directorio";
  nombre: string;
  sigla: string | null;
  descripcion: string | null;
  ubicacion: string | null;
  facultad: string | null;
  facultad_nombre: string | null;
  areas_interes: string[];
  logo_origen: string | null;
  redes: { red: string; url: string }[];
  documentos: { titulo: string; url: string }[];
  miembros: number | null;
  estado: string | null;
  estado_etiqueta: string | null;
  tipo: string | null;
  categoria: string | null;
  contacto: string | null;
  fuente_url: string | null;
  fecha_extraccion: string | null;
}

/** Evento tal como lo genera scripts/construir-catalogo.mjs (data/eventos-clubes.json). */
export interface EventRecord {
  id: string;
  club_id: string;
  nombre: string;
  modalidad: string;
  /** ISO 8601 con zona horaria. */
  inicio: string;
  fin: string;
  lugar: string | null;
  solo_miembros: boolean;
  inscripcion_abierta: boolean;
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

export interface ClubLink {
  label: string;
  href: string;
}

export interface ClubEvent {
  id: string;
  clubId: string;
  name: string;
  mode: string;
  start: string;
  end: string;
  place: string | null;
  membersOnly: boolean;
  registrationOpen: boolean;
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
  acronym: string | null;
  location: string | null;
  /** Nombre completo de la facultad; `faculty` conserva el código (FIEC, FICT…). */
  facultyName: string | null;
  interestAreas: string[];
  socialLinks: ClubLink[];
  documents: ClubLink[];
  membersCount: number | null;
  /** Texto de estado de la plataforma (p. ej. «Sin líder»); null si no aplica. */
  statusLabel: string | null;
  hasLeader: boolean;
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
