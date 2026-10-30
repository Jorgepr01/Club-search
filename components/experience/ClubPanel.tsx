"use client";

import { useEffect, useId, useRef } from "react";
import { categoryLabel, typeLabel } from "@/lib/catalog";
import type { Club, ClubContact } from "@/lib/types";
import { ClubArt } from "./ClubArt";
import "./ClubPanel.css";
import { formatDate } from "./format";

interface ClubPanelProps {
  club: Club;
  reasons: string[];
  tone: number;
  /** Tarjeta principal (más ancha); las otras dos son complementarias. */
  active: boolean;
  flipped: boolean;
  /** En una complementaria la vuelve principal; en la principal la gira. */
  onSelect: () => void;
}

const UNAVAILABLE = "Información no disponible";

// Tarjeta de dos caras: el frente presenta al club y el reverso trae los detalles.
// Tocar una complementaria la vuelve principal; tocar la principal la gira. El pliegue
// de la esquina hace lo mismo y es el control accesible por teclado. La cara oculta
// queda `inert`.
export function ClubPanel({ club, reasons, tone, active, flipped, onSelect }: ClubPanelProps) {
  const detailsId = `detalles-${club.id}`;
  const meta = [typeLabel(club.type), club.faculty].filter(Boolean).join(", ");
  const frontButton = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const focusAfterFlip = useRef(false);

  // El botón que se pulsó queda en la cara oculta; el foco pasa al de la cara visible.
  useEffect(() => {
    if (!focusAfterFlip.current) return;
    focusAfterFlip.current = false;
    (flipped ? backButton : frontButton).current?.focus({ preventScroll: true });
  }, [flipped]);

  function selectFromButton(event: React.MouseEvent) {
    // La tarjeta también escucha el clic; sin esto la acción se ejecutaría dos veces.
    event.stopPropagation();
    focusAfterFlip.current = active;
    onSelect();
  }

  function flipFromCard(event: React.MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest("a, button")) return;
    // No girar si la persona está seleccionando texto del reverso.
    if (window.getSelection()?.toString()) return;
    onSelect();
  }

  return (
    <li
      className="club"
      data-connect={club.id}
      data-active={active || undefined}
      data-flipped={flipped || undefined}
      data-tone={tone % 3}
      onClick={flipFromCard}
    >
      <div className="club__flipper">
        <div className="club__face club__face--front" inert={flipped}>
          <ClubArt club={club} />
          <button
            ref={frontButton}
            type="button"
            className="club-fold"
            aria-label={active ? `Girar para ver los detalles de ${club.name}` : `Ampliar ${club.name}`}
            aria-expanded={active ? flipped : undefined}
            aria-controls={detailsId}
            onClick={selectFromButton}
          >
            <CornerFold />
            {active ? <FlipIcon /> : <ExpandIcon />}
          </button>

          <div className="club__body">
            <h3 className="club__name">{club.name}</h3>
            {meta && <p className="club__meta">{meta}</p>}
            <p className="club__teaser">{reasons[0]}</p>
          </div>
        </div>

        <div id={detailsId} className="club__face club__face--back" inert={!flipped}>
          <div className="club__back-head">
            <div className="club__back-title">
              {meta && <p className="club__back-meta">{meta}</p>}
              <h3 className="club__back-name">{club.name}</h3>
            </div>
            <button
              ref={backButton}
              type="button"
              className="club-fold club-fold--back"
              aria-label={`Volver al frente de ${club.name}`}
              aria-expanded={flipped}
              aria-controls={detailsId}
              onClick={selectFromButton}
            >
              <CornerFold />
              <FlipIcon />
            </button>
          </div>

          <div className="club__back-body">
            <h4 className="club__subhead">Por qué aparece</h4>
            <ul className="club__reasons">
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>

            <h4 className="club__subhead">Lo que dice el catálogo</h4>
            <dl className="facts">
              <Fact label="Descripción" value={club.description} wide />
              <Fact label="Tipo" value={typeLabel(club.type)} />
              <Fact label="Facultad" value={club.faculty} />
              <Fact label="Categoría" value={categoryLabel(club.category)} />
              <Fact label="Actividades" value={club.activities?.join(", ") ?? null} />
              <Fact label="Requisitos" value={club.requirements} />
              <Fact label="Horario" value={club.schedule} />
              <div className="facts__row facts__row--wide">
                <dt>Contacto</dt>
                <dd>
                  <Contact contact={club.contact} />
                </dd>
              </div>
              <div className="facts__row facts__row--wide">
                <dt>Fuente</dt>
                <dd>
                  {club.sourceUrl ? (
                    <a href={club.sourceUrl} target="_blank" rel="noopener noreferrer">
                      {new URL(club.sourceUrl).hostname}
                      <span className="sr-only"> (se abre en otra pestaña)</span>
                    </a>
                  ) : (
                    <span className="facts__missing">{UNAVAILABLE}</span>
                  )}
                  {club.extractedAt && <span className="facts__aside">Consultado el {formatDate(club.extractedAt)}</span>}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </li>
  );
}

/** El dorso y el borde curvado de la propia esquina de la tarjeta. */
function CornerFold() {
  const foldId = useId();
  const paperId = `${foldId}-paper`;
  const creaseId = `${foldId}-crease`;
  const shadowId = `${foldId}-shadow`;

  // La curva sobresale de la diagonal: es el borde de papel levantado, no un triángulo plano.
  const liftedEdge = "M0 0C4 2 8 7 12 19C17 41 50 33 52 52";

  return (
    <svg className="club-fold__corner" viewBox="0 0 52 52" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={paperId} gradientUnits="userSpaceOnUse" x1="12" y1="48" x2="42" y2="8">
          <stop stopColor="var(--corner-shade)" />
          <stop offset="0.45" stopColor="var(--corner-paper)" />
          <stop offset="1" stopColor="var(--plaque)" />
        </linearGradient>
        <linearGradient id={creaseId} gradientUnits="userSpaceOnUse" x1="14" y1="36" x2="29" y2="19">
          <stop stopColor="var(--corner-shade)" />
          <stop offset="0.35" stopColor="var(--corner-shade)" />
          <stop offset="0.7" stopColor="var(--plaque)" />
          <stop offset="0.88" stopColor="var(--corner-paper)" />
          <stop offset="1" stopColor="var(--plaque)" />
        </linearGradient>
        <filter id={shadowId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <path
        className="club-fold__shadow"
        d={liftedEdge}
        transform="translate(-1 3)"
        filter={`url(#${shadowId})`}
      />
      <path d="M0 0H52V52C50 33 17 41 12 19C8 7 4 2 0 0Z" fill={`url(#${paperId})`} />
      <path
        d="M0 0C15 7 28 34 52 52C50 33 17 41 12 19C8 7 4 2 0 0Z"
        fill={`url(#${creaseId})`}
      />
      <path className="club-fold__edge" d={liftedEdge} />
    </svg>
  );
}

function FlipIcon() {
  return (
    <svg className="club-fold__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3.5 12a8.5 8.5 0 0 1 14.6-5.9L20.5 8.5" />
      <path d="M20.5 3.5v5h-5" />
      <path d="M20.5 12a8.5 8.5 0 0 1-14.6 5.9L3.5 15.5" />
      <path d="M3.5 20.5v-5h5" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg className="club-fold__icon club-fold__icon--expand" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M14 4h6v6M20 4l-6.5 6.5" />
      <path d="M10 20H4v-6M4 20l6.5-6.5" />
    </svg>
  );
}

function Fact({ label, value, wide }: { label: string; value: string | null; wide?: boolean }) {
  return (
    <div className={`facts__row${wide ? " facts__row--wide" : ""}`}>
      <dt>{label}</dt>
      <dd>{value ?? <span className="facts__missing">{UNAVAILABLE}</span>}</dd>
    </div>
  );
}

const UNVERIFIED: Partial<Record<ClubContact["kind"], string>> = {
  instagram: "Cuenta indicada en el catálogo, sin verificar.",
  facebook: "Página indicada en el catálogo, sin verificar.",
  handle: "El catálogo no indica la red social.",
  text: "Dato del catálogo, sin verificar.",
};

function Contact({ contact }: { contact: ClubContact | null }) {
  if (!contact) return <span className="facts__missing">No hay contacto en el catálogo</span>;
  return (
    <>
      {contact.href ? (
        <a
          href={contact.href}
          {...(contact.kind === "web" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {contact.raw}
          {contact.kind === "web" && <span className="sr-only"> (se abre en otra pestaña)</span>}
        </a>
      ) : (
        <span>{contact.raw}</span>
      )}
      {UNVERIFIED[contact.kind] && <span className="facts__aside">{UNVERIFIED[contact.kind]}</span>}
    </>
  );
}
