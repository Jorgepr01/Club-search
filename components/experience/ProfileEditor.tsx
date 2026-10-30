"use client";

import { useId, useState } from "react";
import { MAX_PROFILE_INTERESTS, type Profile } from "@/lib/types";

interface ProfileEditorProps {
  profile: Profile;
  onChange: (profile: Profile) => void;
  onOpenConversation: () => void;
  onConfirm: () => void;
}

export function ProfileEditor({ profile, onChange, onOpenConversation, onConfirm }: ProfileEditorProps) {
  const empty = profile.interests.length === 0 && profile.goals.length === 0;

  return (
    <section className="profile" aria-labelledby="profile-title">
      <header className="section-head">
        <h2 id="profile-title" className="section-head__title" tabIndex={-1} data-step-heading>
          Tu perfil
        </h2>
        <p className="section-head__lede">
          Completa tu perfil aquí o cuéntanos sobre ti en la conversación. Puedes editar estos datos cuando quieras.
        </p>
      </header>

      <div className="profile__identity placard">
        <div className="profile__identity-fields">
          <label className="profile__field">
            <span>Nombre</span>
            <input
              className="field field--profile-name"
              autoComplete="name"
              maxLength={80}
              value={profile.name}
              placeholder="¿Cómo te llamas?"
              onChange={(e) => onChange({ ...profile, name: e.target.value })}
            />
          </label>
          <label className="profile__field profile__field--career">
            <span>Carrera</span>
            <input
              className="field field--profile-career"
              autoComplete="organization-title"
              maxLength={100}
              value={profile.career}
              placeholder="¿Qué carrera estudias?"
              onChange={(e) => onChange({ ...profile, career: e.target.value })}
            />
          </label>
        </div>
        <hr className="profile__divider" />
        <TermList
          title="Intereses"
          hint={`Temas o actividades que te llaman la atención. Puedes añadir hasta ${MAX_PROFILE_INTERESTS}.`}
          items={profile.interests}
          placeholder="Ej.: fotografía"
          maxItems={MAX_PROFILE_INTERESTS}
          addIcon
          className="profile__interests"
          onChange={(interests) => onChange({ ...profile, interests })}
        />
      </div>

      <div className="profile__secondary">
        <TermList
          title="Objetivos"
          hint="Lo que te gustaría lograr en un club."
          items={profile.goals}
          placeholder="Ej.: conocer gente"
          onChange={(goals) => onChange({ ...profile, goals })}
        />
        <div className="placard">
          <h3 className="placard__title">
            <label htmlFor="availability">Disponibilidad</label>
          </h3>
          <p className="placard__hint" id="availability-hint">
            Cuándo podrías participar. Opcional.
          </p>
          <textarea
            id="availability"
            className="field field--area"
            aria-describedby="availability-hint"
            rows={3}
            value={profile.availability ?? ""}
            placeholder="Ej.: martes y jueves después de las 16:00"
            onChange={(e) => onChange({ ...profile, availability: e.target.value.trim() ? e.target.value : null })}
          />
        </div>
      </div>

      {empty && (
        <p className="alert" role="status">
          Añade al menos un interés u objetivo para que las ramas y las explicaciones tengan de dónde partir.
        </p>
      )}

      <div className="actions">
        <button type="button" className="btn btn--ghost" onClick={onOpenConversation}>
          Abrir conversación
        </button>
        <button type="button" className="btn btn--primary btn--large" onClick={onConfirm} disabled={empty}>
          Confirmar perfil
        </button>
      </div>
    </section>
  );
}

interface TermListProps {
  title: string;
  hint: string;
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
  maxItems?: number;
  addIcon?: boolean;
  className?: string;
}

function TermList({
  title,
  hint,
  items,
  placeholder,
  onChange,
  maxItems,
  addIcon = false,
  className = "placard",
}: TermListProps) {
  const [draft, setDraft] = useState("");
  const id = useId();
  const visibleItems = maxItems === undefined ? items : items.slice(0, maxItems);

  const add = () => {
    const value = draft.trim();
    if (!value || (maxItems !== undefined && visibleItems.length >= maxItems)) return;
    if (!visibleItems.some((i) => i.toLowerCase() === value.toLowerCase())) onChange([...visibleItems, value]);
    setDraft("");
  };

  return (
    <div className={className}>
      <h3 className="placard__title" id={`${id}-title`}>
        {title}
      </h3>
      <p className="placard__hint">{hint}</p>
      {visibleItems.length > 0 ? (
        <ul className="chips" aria-labelledby={`${id}-title`}>
          {visibleItems.map((item) => (
            <li key={item} className="chip chip--term">
              <span>{item}</span>
              <button
                type="button"
                className="chip__remove"
                aria-label={`Quitar ${item}`}
                onClick={() => onChange(visibleItems.filter((i) => i !== item))}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="placard__empty">Nada todavía.</p>
      )}
      {maxItems === undefined || visibleItems.length < maxItems ? (
        <form
          className="inline-add"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label htmlFor={`${id}-input`} className="sr-only">
            Añadir a {title.toLowerCase()}
          </label>
          <input
            id={`${id}-input`}
            className="field"
            value={draft}
            placeholder={placeholder}
            maxLength={60}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            type="submit"
            className={`btn btn--small${addIcon ? " btn--plus" : ""}`}
            aria-label={addIcon ? "Añadir interés" : undefined}
            disabled={!draft.trim()}
          >
            {addIcon ? <span aria-hidden="true">+</span> : "Añadir"}
          </button>
        </form>
      ) : (
        <p className="placard__hint">Ya añadiste el máximo de {maxItems} intereses.</p>
      )}
    </div>
  );
}
