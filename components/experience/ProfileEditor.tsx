"use client";

import { useId, useState } from "react";
import type { Profile } from "@/lib/types";

interface ProfileEditorProps {
  profile: Profile;
  onChange: (profile: Profile) => void;
  onBack: () => void;
  onConfirm: () => void;
}

export function ProfileEditor({ profile, onChange, onBack, onConfirm }: ProfileEditorProps) {
  const empty = profile.interests.length === 0 && profile.goals.length === 0;

  return (
    <section className="profile" aria-labelledby="profile-title">
      <header className="section-head">
        <h2 id="profile-title" className="section-head__title" tabIndex={-1} data-step-heading>
          Tu perfil
        </h2>
        <p className="section-head__lede">
          Lo armamos con lo que escribiste. Puede estar incompleto: quita, añade o corrige lo que haga falta.
        </p>
      </header>

      <div className="placards">
        <TermList
          title="Intereses"
          hint="Temas o actividades que te llaman la atención."
          items={profile.interests}
          placeholder="Ej.: fotografía"
          onChange={(interests) => onChange({ ...profile, interests })}
        />
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
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          Volver a la conversación
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
}

function TermList({ title, hint, items, placeholder, onChange }: TermListProps) {
  const [draft, setDraft] = useState("");
  const id = useId();

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (!items.some((i) => i.toLowerCase() === value.toLowerCase())) onChange([...items, value]);
    setDraft("");
  };

  return (
    <div className="placard">
      <h3 className="placard__title" id={`${id}-title`}>
        {title}
      </h3>
      <p className="placard__hint">{hint}</p>
      {items.length > 0 ? (
        <ul className="chips" aria-labelledby={`${id}-title`}>
          {items.map((item) => (
            <li key={item} className="chip chip--term">
              <span>{item}</span>
              <button
                type="button"
                className="chip__remove"
                aria-label={`Quitar ${item}`}
                onClick={() => onChange(items.filter((i) => i !== item))}
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
        <button type="submit" className="btn btn--small" disabled={!draft.trim()}>
          Añadir
        </button>
      </form>
    </div>
  );
}
