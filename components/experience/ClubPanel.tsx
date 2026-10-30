"use client";

import { useEffect, useRef } from "react";
import { typeLabel, upcomingEvents } from "@/lib/catalog";
import type { BranchId, Club, ClubContact, ClubEvent, ClubLink } from "@/lib/types";
import { ClubArt } from "./ClubArt";
import { formatDate, formatEventStart, plural } from "./format";

interface ClubPanelProps {
  club: Club;
  branchId: BranchId;
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
// Tocar una complementaria la vuelve principal; tocar la principal la gira. El botón
// de la esquina hace lo mismo y es el control accesible por teclado. La cara oculta
// queda `inert`.
export function ClubPanel({ club, branchId, reasons, tone, active, flipped, onSelect }: ClubPanelProps) {
  const detailsId = `detalles-${club.id}`;
  const meta = [typeLabel(club.type), club.faculty].filter(Boolean).join(", ");
  // Solo se calcula con el reverso abierto; así "próximos" se evalúa al momento de mirarlo.
  const events = flipped ? upcomingEvents(club.id) : [];
  const frontButton = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const focusAfterFlip = useRef(false);

  // El botón que se pulsó queda en la cara oculta; el foco pasa al de la cara visible.
  useEffect(() => {
    if (!focusAfterFlip.current) return;
    focusAfterFlip.current = false;
    (flipped ? backButton : frontButton).current?.focus({ preventScroll: true });
  }, [flipped]);

  function selectFromButton() {
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
          <ClubArt club={club} branchId={branchId} />
          {active ? (
            <button
              ref={frontButton}
              type="button"
              className="club__flip"
              aria-expanded={flipped}
              aria-controls={detailsId}
              onClick={selectFromButton}
            >
              <FlipIcon />
              <span className="club__flip-label">Girar</span>
              <span className="sr-only"> para ver los detalles de {club.name}</span>
            </button>
          ) : (
            <button ref={frontButton} type="button" className="club__flip club__flip--open" onClick={selectFromButton}>
              <OpenIcon />
              <span className="sr-only">Abrir {club.name}</span>
            </button>
          )}

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
              {club.statusLabel && <p className="club__status">{club.statusLabel}: la plataforma aún no lo registra con líder.</p>}
            </div>
            <button ref={backButton} type="button" className="club__flip club__flip--back" onClick={selectFromButton}>
              <FlipIcon />
              Volver
              <span className="sr-only"> al frente de {club.name}</span>
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
              <Fact label="Facultad" value={club.facultyName ?? club.faculty} />
              <Fact label="Ubicación" value={club.location} />
              <Fact label="Áreas" value={club.interestAreas.length > 0 ? club.interestAreas.join(", ") : null} />
              <Fact
                label="Miembros"
                value={club.membersCount ? plural(club.membersCount, "miembro registrado", "miembros registrados") : null}
              />
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
                <dt>Redes</dt>
                <dd>
                  <LinkList links={club.socialLinks} empty="No hay enlaces en la plataforma" />
                </dd>
              </div>
              <div className="facts__row facts__row--wide">
                <dt>Documentos</dt>
                <dd>
                  <LinkList links={club.documents} empty="No hay documentos públicos" />
                </dd>
              </div>
              <div className="facts__row facts__row--wide">
                <dt>Próximos eventos</dt>
                <dd>
                  <EventList events={events} />
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
                    <span>Plataforma de clubes de ESPOL</span>
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

function FlipIcon() {
  return (
    <svg className="club__flip-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3.5 12a8.5 8.5 0 0 1 14.6-5.9L20.5 8.5" />
      <path d="M20.5 3.5v5h-5" />
      <path d="M20.5 12a8.5 8.5 0 0 1-14.6 5.9L3.5 15.5" />
      <path d="M3.5 20.5v-5h5" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg className="club__flip-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M14 4h6v6" />
      <path d="M20 4l-6.5 6.5" />
      <path d="M10 20H4v-6" />
      <path d="M4 20l6.5-6.5" />
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

function LinkList({ links, empty }: { links: ClubLink[]; empty: string }) {
  if (links.length === 0) return <span className="facts__missing">{empty}</span>;
  return (
    <ul className="linklist">
      {links.map((l) => (
        <li key={l.href}>
          <a href={l.href} target="_blank" rel="noopener noreferrer">
            {l.label}
            <span className="sr-only"> (se abre en otra pestaña)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

const MAX_EVENTS_SHOWN = 3;

function EventList({ events }: { events: ClubEvent[] }) {
  if (events.length === 0) return <span className="facts__missing">No hay eventos próximos registrados</span>;
  return (
    <>
      <ul className="events">
        {events.slice(0, MAX_EVENTS_SHOWN).map((e) => (
          <li key={e.id} className="events__item">
            <span className="events__name">{e.name}</span>
            <span className="events__when">
              {formatEventStart(e.start)} · {e.mode}
              {e.place ? ` · ${e.place}` : ""}
            </span>
            <span className="events__tags">
              {e.membersOnly && <span className="events__tag">Solo miembros</span>}
              <span className="events__tag">{e.registrationOpen ? "Inscripción abierta" : "Inscripción cerrada"}</span>
            </span>
          </li>
        ))}
      </ul>
      {events.length > MAX_EVENTS_SHOWN && (
        <span className="facts__aside">y {events.length - MAX_EVENTS_SHOWN} más en la plataforma de clubes</span>
      )}
    </>
  );
}
