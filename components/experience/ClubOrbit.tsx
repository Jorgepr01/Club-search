"use client";

import { useState } from "react";
import { ACTIVE_BRANCHES, clubsInBranch } from "@/lib/catalog";
import { BRANCH_BY_ID } from "@/lib/catalog/branches";
import type { Club } from "@/lib/types";
import { ClubMark } from "./ClubArt";

// Anillo de la portada: las fotos de los clubes entran por arriba con impulso, se frenan
// al pasar frente al texto y salen por abajo. Es decorativo; el botón de pausa detiene
// el movimiento (WCAG 2.2.2).

// Con más insignias se encimarían en el tramo lento del arco.
const SLOTS = 6;
// Ángulos de reposo cuando el movimiento está reducido: repartidos sobre el arco visible.
const REST_FROM = -35;
const REST_TO = -150;

/** Clubes con foto primero; el resto se alterna por rama para que el anillo tenga variedad. */
function pickClubs(): Club[] {
  const queues = ACTIVE_BRANCHES.map((b) => clubsInBranch(b.id));
  const seen = new Set<string>();
  const roundRobin: Club[] = [];
  for (let i = 0; roundRobin.length < SLOTS && queues.some((q) => q.length > i); i++) {
    for (const q of queues) {
      const club = q[i];
      if (club && !seen.has(club.id) && roundRobin.length < SLOTS) {
        seen.add(club.id);
        roundRobin.push(club);
      }
    }
  }
  const withPhoto = roundRobin.filter((c) => c.imageUrl);
  return [...withPhoto, ...roundRobin.filter((c) => !c.imageUrl)];
}

const ORBIT_CLUBS = pickClubs();

export function ClubOrbit() {
  const [paused, setPaused] = useState(false);

  return (
    <div className="orbit" data-paused={paused || undefined}>
      <div className="orbit__ring" aria-hidden="true" />
      <div className="orbit__track" aria-hidden="true">
        {ORBIT_CLUBS.map((club, i) => {
          const branch = BRANCH_BY_ID[club.branches[0]];
          return (
            <div
              key={club.id}
              className="orbit__arm"
              style={
                {
                  "--delay": `calc(var(--period) * ${-i / ORBIT_CLUBS.length})`,
                  "--rest": `${REST_FROM + ((REST_TO - REST_FROM) * i) / Math.max(ORBIT_CLUBS.length - 1, 1)}deg`,
                  "--lacquer": branch.color,
                  "--lacquer-ink": branch.ink,
                } as React.CSSProperties
              }
            >
              <span className="orbit__trail" />
              <span className="orbit__badge" data-photo={club.imageUrl ? true : undefined}>
                {club.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- archivos locales de tamaño variable
                  <img src={club.imageUrl} alt="" />
                ) : (
                  <ClubMark club={club} className="orbit__mark" />
                )}
              </span>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="orbit__pause"
        aria-pressed={paused}
        onClick={() => setPaused((p) => !p)}
      >
        {paused ? "Reanudar movimiento" : "Pausar movimiento"}
      </button>
    </div>
  );
}
