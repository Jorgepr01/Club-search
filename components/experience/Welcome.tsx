"use client";

import { ClubOrbit } from "./ClubOrbit";

export function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <section className="welcome" aria-labelledby="welcome-title">
      <div className="welcome__copy">
        <h1 id="welcome-title" className="welcome__title" tabIndex={-1} data-step-heading>
          Encuentra tu comunidad en ESPOL
        </h1>
        <p className="welcome__lede">
          Cuéntanos qué te gusta, qué quieres lograr y cuánto tiempo tienes. Te mostramos hasta tres clubes u
          organizaciones estudiantiles que encajan, con lo que sabemos de cada uno.
        </p>
        <button type="button" className="btn btn--primary btn--large" onClick={onStart}>
          Empezar conversación
        </button>
      </div>

      <ClubOrbit />
    </section>
  );
}
