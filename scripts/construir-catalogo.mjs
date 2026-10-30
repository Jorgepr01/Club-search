// Fusiona las fuentes de data/fuentes/ en el catálogo que lee la aplicación.
//   clubes-plataforma.json   fuente principal (40 clubes)
//   directorio-oe.json       directorio de Bienestar: aporta tipo, categoría, contacto y fuente
//   cruce-directorio.json    cruce manual id del directorio -> id de la plataforma
//   eventos-plataforma.json  eventos de los clubes
// Salida: data/catalogo-clubes.json y data/eventos-clubes.json.
// Uso: node scripts/construir-catalogo.mjs   (falla si hay errores de validación)
import { readFileSync, writeFileSync } from "node:fs";

const fuentes = new URL("../data/fuentes/", import.meta.url);
const salida = new URL("../data/", import.meta.url);
const leer = (nombre) => JSON.parse(readFileSync(new URL(nombre, fuentes), "utf8"));

const plataforma = leer("clubes-plataforma.json");
const directorio = leer("directorio-oe.json");
const cruce = leer("cruce-directorio.json");
delete cruce._nota;
const eventosFuente = leer("eventos-plataforma.json");
const categorias = leer("categorias-clubes.json");
delete categorias._nota;
delete categorias._pendientes;

const errores = [];
const avisos = [];
const error = (m) => errores.push(m);
const aviso = (m) => avisos.push(m);

// Fecha en que el equipo entregó los datos de la plataforma.
const FECHA_PLATAFORMA = "2026-10-30";

const DESCRIPCION_VACIA = /todav[ií]a no publica su descripci[oó]n/i;
const URL_HTTP = /^https?:\/\/\S+$/i;

const porDirectorio = new Map(directorio.map((d) => [d.id, d]));
const dirDePlataforma = new Map();
for (const [dirId, platId] of Object.entries(cruce)) {
  if (!porDirectorio.has(dirId)) error(`cruce: el id ${dirId} no existe en el directorio`);
  if (platId !== null) dirDePlataforma.set(platId, porDirectorio.get(dirId));
}
for (const d of directorio) if (!(d.id in cruce)) error(`cruce: falta el id ${d.id} (${d.nombre})`);

const idsPlataforma = new Set(plataforma.map((p) => String(p.id)));
for (const platId of dirDePlataforma.keys()) {
  if (!idsPlataforma.has(platId)) error(`cruce: el id ${platId} no existe en la plataforma`);
}

for (const id of Object.keys(categorias)) {
  if (!idsPlataforma.has(id)) error(`categorias-clubes: el id ${id} no existe en la plataforma`);
}

// El contacto del directorio solo se conserva si aporta algo que la plataforma no trae.
function contactoUtil(contacto, redes) {
  if (!contacto) return null;
  const c = contacto.trim();
  const tieneRed = (nombre) => redes.some((r) => r.red.toLowerCase() === nombre);
  if (/^instagram:/i.test(c) && tieneRed("instagram")) return null;
  if (/^facebook:/i.test(c) && tieneRed("facebook")) return null;
  if (/^https?:\/\//i.test(c) && redes.some((r) => r.url.replace(/\/$/, "") === c.replace(/\/$/, ""))) return null;
  return c;
}

const clubes = plataforma.map((p) => {
  const id = String(p.id);
  const dir = dirDePlataforma.get(id) ?? null;
  const redes = p.social_media.map((s) => ({ red: s.network, url: s.link }));
  const documentos = p.documents
    .filter((d) => d.is_public)
    .map((d) => ({ titulo: d.title, url: d.file_url }));
  return {
    id,
    origen: "plataforma",
    nombre: p.name,
    sigla: p.acronym || null,
    descripcion: p.description && !DESCRIPCION_VACIA.test(p.description) ? p.description : null,
    ubicacion: p.location || null,
    facultad: p.faculty_code ?? dir?.facultad ?? null,
    facultad_nombre: p.faculty_name ?? null,
    areas_interes: p.interest_areas.map((a) => a.name),
    logo_origen: p.image || null,
    redes,
    documentos,
    miembros: p.members_count,
    estado: p.status,
    estado_etiqueta: p.status_label,
    tipo: dir?.tipo ?? null,
    categoria: categorias[id] ?? dir?.categoria ?? null,
    contacto: contactoUtil(dir?.contacto ?? null, redes),
    fuente_url: dir?.fuente_url ?? null,
    fecha_extraccion: dir?.fecha_extraccion ?? FECHA_PLATAFORMA,
  };
});

// Organizaciones que solo están en el directorio de Bienestar: se conservan tal cual.
for (const d of directorio) {
  if (cruce[d.id] !== null) continue;
  clubes.push({
    id: `oe-${d.id}`,
    origen: "directorio",
    nombre: d.nombre,
    sigla: null,
    descripcion: d.descripcion,
    ubicacion: null,
    facultad: d.facultad,
    facultad_nombre: null,
    areas_interes: [],
    logo_origen: null,
    redes: [],
    documentos: [],
    miembros: null,
    estado: null,
    estado_etiqueta: null,
    tipo: d.tipo,
    categoria: d.categoria,
    contacto: d.contacto,
    fuente_url: d.fuente_url,
    fecha_extraccion: d.fecha_extraccion,
  });
}

// Validación de clubes.
const vistos = new Set();
for (const c of clubes) {
  if (vistos.has(c.id)) error(`club duplicado: ${c.id}`);
  vistos.add(c.id);
  if (!c.nombre?.trim()) error(`club ${c.id} sin nombre`);
  if (!c.descripcion) aviso(`club ${c.id} (${c.nombre}) sin descripción publicada`);
  if (!c.categoria) aviso(`club ${c.id} (${c.nombre}) sin categoría (cae en «Otras» hasta asignarla)`);
  for (const r of c.redes) if (!URL_HTTP.test(r.url)) error(`club ${c.id}: URL de red inválida ${r.url}`);
  for (const d of c.documentos) if (!URL_HTTP.test(d.url)) error(`club ${c.id}: URL de documento inválida ${d.url}`);
  if (c.logo_origen && !URL_HTTP.test(c.logo_origen)) error(`club ${c.id}: URL de logo inválida`);
}

// Eventos.
const CLUBES_CON_ID = new Set(clubes.map((c) => c.id));
const eventos = eventosFuente
  .map((e) => {
    const clubId = String(e.club);
    if (!CLUBES_CON_ID.has(clubId)) error(`evento ${e.id}: club ${clubId} no existe`);
    if (Number.isNaN(Date.parse(e.start_datetime)) || Number.isNaN(Date.parse(e.end_datetime))) {
      error(`evento ${e.id}: fechas inválidas`);
    } else if (Date.parse(e.end_datetime) < Date.parse(e.start_datetime)) {
      error(`evento ${e.id}: termina antes de empezar`);
    }
    return {
      id: String(e.id),
      club_id: clubId,
      nombre: e.event_name,
      modalidad: e.mode_label,
      inicio: e.start_datetime,
      fin: e.end_datetime,
      lugar: e.planned_place || null,
      solo_miembros: e.visibility === "MembersOnly",
      inscripcion_abierta: Boolean(e.registration_is_open),
    };
  })
  .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));

if (new Set(eventos.map((e) => e.id)).size !== eventos.length) error("hay eventos con id repetido");

writeFileSync(new URL("catalogo-clubes.json", salida), JSON.stringify(clubes, null, 2) + "\n");
writeFileSync(new URL("eventos-clubes.json", salida), JSON.stringify(eventos, null, 2) + "\n");

const hoy = new Date().toISOString();
const futuros = eventos.filter((e) => e.fin >= hoy).length;
console.log(`${clubes.length} clubes (${plataforma.length} de la plataforma, ${clubes.length - plataforma.length} solo del directorio)`);
console.log(`${eventos.length} eventos (${futuros} por venir hoy) en ${new Set(eventos.map((e) => e.club_id)).size} clubes`);
for (const a of avisos) console.warn(`aviso: ${a}`);
if (errores.length) {
  for (const e of errores) console.error(`ERROR: ${e}`);
  process.exit(1);
}
console.log("Validación correcta.");
