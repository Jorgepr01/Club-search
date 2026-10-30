"use client";

import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { CLUB_BY_ID } from "@/lib/catalog";
import { BRANCH_BY_ID } from "@/lib/catalog/branches";
import type { BranchId, Recommendation } from "@/lib/types";
import { BranchGlyph } from "./BranchGlyph";
import { ClubPanel } from "./ClubPanel";
import { Connectors, type Anchor } from "./Connectors";
import { plural } from "./format";
import { useMediaQuery, WIDE_LAYOUT } from "./hooks";

interface ClubResultsProps {
  branchId: BranchId;
  recommendations: Recommendation[];
  totalInBranch: number;
  error: string | null;
  onRetry: () => void;
  onShowOthers: () => void;
  onBackToTree: () => void;
  onEditProfile: () => void;
  /** Control para la guía de voz: abrir los detalles de un club o voltear la tarjeta principal. */
  controls?: Ref<ClubResultsControls>;
}

export interface ClubResultsControls {
  open: (clubId: string) => void;
  flip: () => void;
}

const wideFrom: Anchor = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height });
const wideTo: Anchor = (r) => ({ x: r.x + r.width / 2, y: r.y });
const narrowFrom: Anchor = (r) => ({ x: r.x + 18, y: r.y + r.height });
const narrowTo: Anchor = (r) => ({ x: r.x, y: r.y + 44 });

export function ClubResults(props: ClubResultsProps) {
  const { branchId, recommendations, totalInBranch, error, onRetry, onShowOthers, onBackToTree, onEditProfile, controls } =
    props;
  const branch = BRANCH_BY_ID[branchId];
  const wide = useMediaQuery(WIDE_LAYOUT, true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{ batch: string; id: string; flipped: boolean } | null>(null);
  const batch = recommendations.map((r) => r.clubId).join(",");

  const shown = recommendations.filter((r) => CLUB_BY_ID.has(r.clubId));
  // Siempre hay una tarjeta principal; con un grupo nuevo es la primera y está al frente.
  const current = selection?.batch === batch ? selection : null;
  const activeId = current?.id ?? shown[0]?.clubId ?? null;
  const flipped = current?.flipped ?? false;

  // Tocar una complementaria la vuelve principal; tocar la principal la gira.
  function select(id: string) {
    setSelection({ batch, id, flipped: id === activeId ? !flipped : false });
  }

  useImperativeHandle(
    controls,
    () => ({
      open: (id) => setSelection({ batch, id, flipped: true }),
      flip: () => {
        if (activeId) setSelection({ batch, id: activeId, flipped: !flipped });
      },
    }),
    [batch, activeId, flipped],
  );

  return (
    <section
      className="results"
      aria-labelledby="results-title"
      style={{ "--lacquer": branch.color, "--lacquer-ink": branch.ink } as React.CSSProperties}
    >
      <div className="results__bar">
        <button type="button" className="btn btn--ghost btn--small" onClick={onBackToTree}>
          Volver a las ramas
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={onEditProfile}>
          Editar perfil
        </button>
      </div>

      <div className="results__canvas" ref={containerRef}>
        <Connectors
          containerRef={containerRef}
          targets={shown.map((r) => ({ id: r.clubId, active: activeId === r.clubId }))}
          fromAnchor={wide ? wideFrom : narrowFrom}
          toAnchor={wide ? wideTo : narrowTo}
          curve={wide ? "vertical" : "side"}
          color={() => branch.color}
          settleKey={`${activeId}-${wide}`}
        />

        <div className="results__branch" data-connect-from>
          <BranchGlyph id={branch.id} className="results__glyph" />
          <div>
            <h2 id="results-title" className="results__title" tabIndex={-1} data-step-heading>
              {branch.name}
            </h2>
            <p className="results__count">
              {plural(totalInBranch, "organización", "organizaciones")} en esta rama del catálogo.{" "}
              {totalInBranch > 3 ? "Mostramos tres a la vez." : ""}
            </p>
          </div>
        </div>

        {error ? (
          <div className="alert" role="alert">
            <p>{error}</p>
            <button type="button" className="btn btn--small" onClick={onRetry}>
              Intentar de nuevo
            </button>
          </div>
        ) : (
          <ul className="panels">
            {shown.map((r, i) => (
              <ClubPanel
                key={r.clubId}
                club={CLUB_BY_ID.get(r.clubId)!}
                reasons={r.reasons}
                tone={i}
                active={activeId === r.clubId}
                flipped={activeId === r.clubId && flipped}
                onSelect={() => select(r.clubId)}
              />
            ))}
          </ul>
        )}
      </div>

      {!error && totalInBranch < 3 && (
        <p className="results__note">
          Esta rama solo tiene {plural(totalInBranch, "organización", "organizaciones")} en el catálogo actual.
        </p>
      )}
      {!error && totalInBranch >= 3 && shown.length < 3 && (
        <p className="results__note">Estas son las últimas de la rama. Si pides otras, vuelves a las primeras.</p>
      )}

      <div className="actions">
        {totalInBranch > shown.length && (
          <button type="button" className="btn btn--ghost" onClick={onShowOthers}>
            Ver otras organizaciones de esta rama
          </button>
        )}
        <button type="button" className="btn btn--primary btn--large" onClick={onBackToTree}>
          Explorar otra rama
        </button>
      </div>

      <p className="source-note">
        Datos del catálogo inicial del equipo, tomados de los directorios públicos de ESPOL. La actividad de cada
        organización puede haber cambiado; confirma con ella antes de asistir. El orden y las explicaciones salen de
        reglas de palabras clave, no de un modelo de inteligencia artificial.
      </p>
    </section>
  );
}
