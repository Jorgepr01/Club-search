import records from "@/data/catalogo-clubes.json";
import eventRecords from "@/data/eventos-clubes.json";
import media from "@/data/medios-clubes.json";
import type { BranchId, CatalogRecord, Club, ClubContact, ClubEvent, EventRecord } from "@/lib/types";
import { BRANCHES, CATEGORY_BRANCHES } from "./branches";

// Fotos y logos autorizados, por `id` del catálogo: { "38": { "foto": "/clubes/38.jpg", "logo": "/clubes/38-logo.png" } }.
// `npm run logos` descarga los logos de la plataforma y los registra aquí.
// Los archivos van en public/clubes/. Sin entrada, la interfaz usa un gráfico provisional.
const MEDIA = media as Record<string, { foto?: string; logo?: string }>;

// Punto único de acceso al catálogo. Para cambiar la fuente (otro JSON, una API o
// una base de datos), reemplaza `records` y conserva la normalización.

const TYPE_LABELS: Record<string, string> = {
  club: "Club",
  club_cultural: "Club cultural",
  agrupacion_cultural: "Agrupación cultural",
  capitulo_profesional: "Capítulo profesional",
  grupo_investigacion: "Grupo de investigación",
  asociacion_estudiantil: "Asociación estudiantil",
};

export function typeLabel(type: string | null): string | null {
  if (!type) return null;
  return TYPE_LABELS[type] ?? type.replaceAll("_", " ");
}

export function categoryLabel(category: string | null): string | null {
  return category ? category.replaceAll("_", " ") : null;
}

// Solo se crean enlaces cuando el catálogo trae una URL o un correo explícitos.
// Los usuarios de redes se muestran como texto: el catálogo no indica si están verificados.
export function parseContact(raw: string | null): ClubContact | null {
  if (!raw) return null;
  const value = raw.trim();
  if (/^https?:\/\//i.test(value)) return { kind: "web", raw: value, href: value };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { kind: "email", raw: value, href: `mailto:${value}` };
  if (/^instagram:/i.test(value)) return { kind: "instagram", raw: value, href: null };
  if (/^facebook:/i.test(value)) return { kind: "facebook", raw: value, href: null };
  if (value.startsWith("@")) return { kind: "handle", raw: value, href: null };
  return { kind: "text", raw: value, href: null };
}

function normalize(record: CatalogRecord): Club {
  const branches: BranchId[] = (record.categoria && CATEGORY_BRANCHES[record.categoria]) || ["otras"];
  return {
    id: `club-${record.id}`,
    name: record.nombre,
    type: record.tipo,
    faculty: record.facultad,
    category: record.categoria,
    description: record.descripcion,
    contact: parseContact(record.contacto),
    sourceUrl: record.fuente_url,
    extractedAt: record.fecha_extraccion,
    branches,
    acronym: record.sigla,
    location: record.ubicacion,
    facultyName: record.facultad_nombre,
    interestAreas: record.areas_interes,
    socialLinks: record.redes.map((r) => ({ label: r.red, href: r.url })),
    documents: record.documentos.map((d) => ({ label: d.titulo, href: d.url })),
    membersCount: record.miembros,
    statusLabel: record.estado === "Active" ? null : record.estado_etiqueta,
    hasLeader: record.estado !== "Pending Leader",
    activities: null,
    requirements: null,
    schedule: null,
    logoUrl: MEDIA[record.id]?.logo ?? null,
    imageUrl: MEDIA[record.id]?.foto ?? null,
  };
}

export const CLUBS: Club[] = (records as CatalogRecord[]).map(normalize);

export const CLUB_BY_ID = new Map(CLUBS.map((c) => [c.id, c]));

/** Ramas con al menos un club, en el orden editorial definido. */
export const ACTIVE_BRANCHES = BRANCHES.filter((b) => CLUBS.some((c) => c.branches.includes(b.id)));

export function clubsInBranch(branchId: BranchId): Club[] {
  return CLUBS.filter((c) => c.branches.includes(branchId));
}

export const CATALOG_EXTRACTED_AT = CLUBS.map((c) => c.extractedAt).find(Boolean) ?? null;

const EVENTS: ClubEvent[] = (eventRecords as EventRecord[]).map((e) => ({
  id: e.id,
  clubId: `club-${e.club_id}`,
  name: e.nombre,
  mode: e.modalidad,
  start: e.inicio,
  end: e.fin,
  place: e.lugar,
  membersOnly: e.solo_miembros,
  registrationOpen: e.inscripcion_abierta,
}));

/** Eventos que aún no terminaron, del más próximo al más lejano. Se evalúa al llamar, no al compilar. */
export function upcomingEvents(clubId: string, now: Date = new Date()): ClubEvent[] {
  return EVENTS.filter((e) => e.clubId === clubId && Date.parse(e.end) >= now.getTime());
}
