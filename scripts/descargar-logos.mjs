// Descarga los logos de data/fuentes/clubes-plataforma.json a public/clubes/ y los registra
// en data/medios-clubes.json. Requiere acceso a los hosts de ESPOL (oe.espol.edu.ec y los
// sitios de cada facultad). Los que fallen se omiten y la interfaz usa la sigla.
// Uso: node scripts/descargar-logos.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const data = new URL("../data/", import.meta.url);
const destino = new URL("../public/clubes/", import.meta.url);
mkdirSync(destino, { recursive: true });

const clubes = JSON.parse(readFileSync(new URL("fuentes/clubes-plataforma.json", data), "utf8"));
const EXTENSIONES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
};
const MAX_BYTES = 2 * 1024 * 1024;

let medios = {};
try {
  medios = JSON.parse(readFileSync(new URL("medios-clubes.json", data), "utf8"));
} catch {}

const fallidos = [];
for (const club of clubes) {
  if (!club.image) continue;
  const id = String(club.id);
  try {
    const res = await fetch(club.image, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const tipo = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const ext = EXTENSIONES[tipo];
    if (!ext) throw new Error(`tipo no admitido: ${tipo || "desconocido"}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES) throw new Error(`tamaño inválido: ${bytes.length} bytes`);
    const archivo = `${id}-logo.${ext}`;
    writeFileSync(new URL(archivo, destino), bytes);
    medios[id] = { ...medios[id], logo: `/clubes/${archivo}` };
    console.log(`ok   ${id} ${club.acronym} -> ${archivo}`);
  } catch (e) {
    fallidos.push(`${id} ${club.acronym}: ${e.cause?.code ?? e.message}`);
    console.warn(`fallo ${id} ${club.acronym}: ${e.cause?.code ?? e.message}`);
  }
}

writeFileSync(new URL("medios-clubes.json", data), JSON.stringify(medios, null, 2) + "\n");
console.log(`\n${Object.keys(medios).length} logos registrados, ${fallidos.length} fallidos.`);
if (fallidos.length) process.exitCode = 1;
