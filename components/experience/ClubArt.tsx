import type { BranchId, Club } from "@/lib/types";
import { BranchGlyph } from "./BranchGlyph";

// Foto y logo del club cuando existen (data/medios-clubes.json); si no, un gráfico
// provisional generado a partir del ID del club.

function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const STOPWORDS = new Set(["de", "del", "la", "el", "en", "y"]);

/** Sigla del club si la tiene (IEEE, ASME, D-PRO); si no, iniciales. "ESPOL" se omite por repetirse. */
export function monogram(name: string): string {
  const words = name.split(/\s+/).filter((w) => !STOPWORDS.has(w.toLowerCase()));
  const acronym = words.find(
    (w) => w !== "ESPOL" && w.length <= 8 && w.replace(/[^A-ZÁÉÍÓÚÑ]/g, "").length >= 2,
  );
  if (acronym) return acronym.replace(/[^\p{L}-]/gu, "");
  // Nombres de una sola palabra (Alucine, Kokoa, Breik) se muestran completos.
  if (words.length === 1 && words[0].length <= 10) return words[0];
  return words
    .filter((w) => w !== "ESPOL")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function ClubMark({ club, className }: { club: Club; className?: string }) {
  const text = monogram(club.name);
  return (
    <span className={className} data-long={text.length > 5 || undefined} aria-hidden="true">
      {club.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- archivos locales de tamaño variable
        <img src={club.logoUrl} alt="" />
      ) : (
        text
      )}
    </span>
  );
}

export function ClubArt({ club, branchId }: { club: Club; branchId: BranchId }) {
  if (club.imageUrl) {
    return (
      <div className="club-art club-art--photo">
        {/* eslint-disable-next-line @next/next/no-img-element -- archivos locales de tamaño variable */}
        <img className="club-art__photo" src={club.imageUrl} alt="" />
        <ClubMark club={club} className="club-art__monogram" />
      </div>
    );
  }

  const seed = seedFrom(club.id);
  const rotate = (seed % 50) - 25;
  const rings = 3 + (seed % 3);
  const cx = 30 + (seed % 40);
  const cy = 35 + ((seed >> 4) % 30);
  const stripeAngle = ((seed >> 8) % 4) * 22.5;
  const patternId = `stripes-${club.id}`;

  return (
    <div className="club-art">
      <svg className="club-art__field" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <defs>
          <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform={`rotate(${stripeAngle})`}>
            <rect width="2" height="6" fill="currentColor" opacity="0.12" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill={`url(#${patternId})`} />
        {Array.from({ length: rings }, (_, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={14 + i * 11}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.22 - i * 0.03}
            strokeWidth={0.8}
          />
        ))}
      </svg>
      <span className="club-art__glyph" style={{ transform: `rotate(${rotate}deg)` }} aria-hidden="true">
        <BranchGlyph id={branchId} />
      </span>
      <ClubMark club={club} className="club-art__monogram" />
    </div>
  );
}
