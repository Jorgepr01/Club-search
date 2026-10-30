// Convierte data/fuentes/directorio-oe.csv en data/fuentes/directorio-oe.json sin alterar los valores.
// Uso: node scripts/csv-a-json.mjs
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../data/", import.meta.url);
const text = readFileSync(new URL("fuentes/directorio-oe.csv", root), "utf8").trim();

// Parser CSV mínimo con soporte de comillas dobles.
function parseLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const [header, ...rows] = text.split(/\r?\n/).map(parseLine);
const records = rows.map((cells) => {
  if (cells.length !== header.length) {
    throw new Error(`Fila con ${cells.length} columnas (se esperaban ${header.length}): ${cells.join(",")}`);
  }
  return Object.fromEntries(header.map((key, i) => [key, cells[i].trim() === "" ? null : cells[i].trim()]));
});

writeFileSync(new URL("fuentes/directorio-oe.json", root), JSON.stringify(records, null, 2) + "\n");
console.log(`${records.length} registros escritos en data/fuentes/directorio-oe.json`);
