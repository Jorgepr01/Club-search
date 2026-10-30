"use client";

import { motion } from "motion/react";
import { useRef } from "react";
import { ACTIVE_BRANCHES, clubsInBranch } from "@/lib/catalog";
import { BRANCH_BY_ID } from "@/lib/catalog/branches";
import { suggestedBranches } from "@/lib/demo/engine";
import type { BranchId, Profile } from "@/lib/types";
import { BranchGlyph } from "./BranchGlyph";
import { Connectors, type Anchor } from "./Connectors";
import { plural } from "./format";
import { useMediaQuery, WIDE_LAYOUT } from "./hooks";

interface InterestTreeProps {
  profile: Profile;
  onChoose: (id: BranchId) => void;
  onEditProfile: () => void;
}

// Copa del árbol en escritorio: las ramas del centro quedan más altas.
function crownOffset(index: number, total: number): number {
  const center = (total - 1) / 2;
  const distance = Math.abs(index - center) / Math.max(center, 1);
  return Math.round(distance * distance * 64);
}

const wideFrom: Anchor = (r) => ({ x: r.x + r.width / 2, y: r.y });
const wideTo: Anchor = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height });
const narrowFrom: Anchor = (r) => ({ x: r.x + 18, y: r.y + r.height });
const narrowTo: Anchor = (r) => ({ x: r.x, y: r.y + r.height / 2 });

export function InterestTree({ profile, onChoose, onEditProfile }: InterestTreeProps) {
  const wide = useMediaQuery(WIDE_LAYOUT, true);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggested = new Set(suggestedBranches(profile));
  const branches = [
    ...ACTIVE_BRANCHES.filter((b) => suggested.has(b.id)),
    ...ACTIVE_BRANCHES.filter((b) => !suggested.has(b.id)),
  ];
  // En escritorio las sugeridas van al centro de la copa.
  const ordered = wide ? centerFirst(branches) : branches;

  return (
    <section className="tree" aria-labelledby="tree-title">
      <header className="section-head">
        <h2 id="tree-title" className="section-head__title" tabIndex={-1} data-step-heading>
          Elige una rama
        </h2>
        <p className="section-head__lede">
          {suggested.size > 0
            ? "Las ramas marcadas se relacionan con tu perfil. Puedes abrir cualquiera."
            : "No encontramos ramas relacionadas con tu perfil de forma directa. Explora cualquiera o edita tu perfil."}
        </p>
      </header>

      <div className="tree__canvas" ref={containerRef}>
        <Connectors
          containerRef={containerRef}
          targets={ordered.map((b) => ({ id: b.id, active: suggested.has(b.id) }))}
          fromAnchor={wide ? wideFrom : narrowFrom}
          toAnchor={wide ? wideTo : narrowTo}
          curve={wide ? "vertical" : "side"}
          color={(id) => BRANCH_BY_ID[id as BranchId].color}
          settleKey={wide}
        />

        <ul className="tree__crown">
          {ordered.map((b, i) => {
            const count = clubsInBranch(b.id).length;
            const isSuggested = suggested.has(b.id);
            return (
              <motion.li
                key={b.id}
                className="tree__slot"
                style={wide ? { marginTop: crownOffset(i, ordered.length) } : undefined}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.05 }}
              >
                <button
                  data-connect={b.id}
                  type="button"
                  className="branch"
                  data-suggested={isSuggested || undefined}
                  style={{ "--lacquer": b.color, "--lacquer-ink": b.ink } as React.CSSProperties}
                  onClick={() => onChoose(b.id)}
                >
                  <BranchGlyph id={b.id} className="branch__glyph" />
                  <span className="branch__name">{b.name}</span>
                  <span className="branch__meta">{plural(count, "organización", "organizaciones")}</span>
                  {isSuggested && <span className="branch__flag">Según tu perfil</span>}
                </button>
              </motion.li>
            );
          })}
        </ul>

        <div className="tree__root" data-connect-from>
          <p className="tree__root-title">Tu perfil</p>
          <p className="tree__root-terms">{[...profile.interests, ...profile.goals].slice(0, 5).join(", ")}</p>
          <button type="button" className="btn btn--small btn--ghost" onClick={onEditProfile}>
            Editar perfil
          </button>
        </div>
      </div>
    </section>
  );
}

function centerFirst<T>(items: T[]): T[] {
  // [a, b, c, d, e] -> [d, b, a, c, e]: el primero queda al centro y el resto se abre hacia los lados.
  const result: T[] = [];
  items.forEach((item, i) => {
    if (i % 2 === 0) result.push(item);
    else result.unshift(item);
  });
  return result;
}
