import records from "@/data/catalogo-clubes.json";
import media from "@/data/medios-clubes.json";
import type { BranchId, CatalogRecord, Club, ClubContact } from "@/lib/types";
import { BRANCHES, CATEGORY_BRANCHES } from "./branches";

// Fotos y logos autorizados, por `id` del catálogo: { "22": { "foto": "/clubes/22.jpg", "logo": "/clubes/22-logo.png" } }.
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
