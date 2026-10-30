import { useState } from "react";
import type { Club } from "@/lib/types";

// Logo o foto del club cuando existen (data/medios-clubes.json); si no hay o no cargan,
// su sigla sobre el color de la rama.

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

/** El logo tiene prioridad sobre la foto; si uno falla al cargar se pasa al siguiente. */
export function ClubArt({ club }: { club: Club }) {
  const sources = [
    club.logoUrl && { src: club.logoUrl, kind: "logo" as const },
    club.imageUrl && { src: club.imageUrl, kind: "photo" as const },
  ].filter((m): m is { src: string; kind: "logo" | "photo" } => Boolean(m));
  const [failed, setFailed] = useState(0);
  const media = sources[failed];
  const text = club.acronym ?? monogram(club.name);

  return (
    <div className="club-art" data-media={media?.kind ?? "text"}>
      {media ? (
        // eslint-disable-next-line @next/next/no-img-element -- archivos locales de tamaño variable
        <img
          key={media.src}
          className="club-art__media"
          src={media.src}
          alt=""
          decoding="async"
          draggable={false}
          onError={() => setFailed((n) => n + 1)}
          ref={(img) => {
            // Un error anterior a la hidratación no dispara onError.
            if (img?.complete && img.naturalWidth === 0) setFailed((n) => n + 1);
          }}
        />
      ) : (
        <span
          className="club-art__mono"
          style={{ "--chars": Math.max(text.length, 2) } as React.CSSProperties}
          aria-hidden="true"
        >
          {text}
        </span>
      )}
    </div>
  );
}
