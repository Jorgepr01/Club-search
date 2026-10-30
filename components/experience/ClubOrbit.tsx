"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CLUBS, typeLabel } from "@/lib/catalog";
import { BRANCH_BY_ID } from "@/lib/catalog/branches";
import type { Club } from "@/lib/types";
import { BranchGlyph } from "./BranchGlyph";
import { monogram } from "./ClubArt";
import { WIDE_LAYOUT, useMediaQuery } from "./hooks";

// Órbita de la portada, según el video de referencia: solo se ve el cuadrante superior
// izquierdo de un anillo enorme cuyo centro queda fuera del encuadre, abajo a la derecha.
// Los clubes del catálogo entran por arriba a la derecha, recorren el arco en unos
// 3 segundos y salen por abajo, uno tras otro. Pasar el cursor, enfocar o tocar un club
// lo detiene y abre su ficha. Los controles de pausa y paso cumplen WCAG 2.2.2.

/** Segundos que tarda una burbuja en cruzar el tramo visible. */
const TRANSIT_SECONDS = 3;
/** Margen para pasar el cursor de la burbuja a la ficha sin que se cierre. */
const HOVER_GRACE_MS = 400;
const STEP_MS = 520;

interface Layout {
  wide: boolean;
  w: number;
  h: number;
  cx: number;
  cy: number;
  r: number;
  band: number;
  bubble: number;
  /** Ángulo de entrada (arriba a la derecha); el recorrido avanza en sentido antihorario. */
  thetaIn: number;
  /** Longitud del recorrido de borde a borde, en px. */
  length: number;
  /** Distancia entre burbujas consecutivas, en px. */
  spacing: number;
  /** px/s para que el centro de cada burbuja cruce el encuadre en TRANSIT_SECONDS. */
  speed: number;
  /** Cuántas burbujas se montan a la vez (visibles más la siguiente en entrar). */
  pool: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const mod = (n: number, m: number) => ((n % m) + m) % m;
const clubAt = (slot: number) => CLUBS[mod(slot, CLUBS.length)];

function computeLayout(w: number, h: number, wide: boolean): Layout {
  const bubble = wide ? clamp(w * 0.14, 100, 128) : clamp(w * 0.23, 76, 92);
  const labelHalf = wide ? 82 : 66;
  // Punto más a la izquierda y más alto del anillo; el centro queda fuera, abajo a la derecha.
  const left = labelHalf + 8;
  const top = bubble * 0.62 + 10;
  const r = Math.max((w - left) * 1.06, (h - top) * 1.08);
  const cx = left + r;
  const cy = top + r;
  const band = bubble * 1.25;
  // Entra con la burbuja completamente fuera por la derecha y sale con su nombre fuera por abajo.
  const thetaIn = -Math.acos(clamp((w + bubble * 0.7 - cx) / r, -1, 1));
  const thetaOut = -Math.PI - Math.asin(clamp((h + bubble * 0.6 + 56 - cy) / r, -1, 1));
  const length = r * (thetaIn - thetaOut);
  const spacing = Math.max(length / (wide ? 3.3 : 2.5), bubble * 2.2);
  // Tramo visible: desde que el centro cruza el borde derecho hasta que cruza el inferior.
  const visibleIn = -Math.acos(clamp((w - cx) / r, -1, 1));
  const visibleOut = -Math.PI - Math.asin(clamp((h - cy) / r, -1, 1));
  return {
    wide, w, h, cx, cy, r, band, bubble, thetaIn, length, spacing,
    speed: (r * (visibleIn - visibleOut)) / TRANSIT_SECONDS,
    pool: Math.floor(length / spacing) + 2,
  };
}

function pointAt(l: Layout, s: number) {
  const theta = l.thetaIn - s / l.r;
  return { x: l.cx + l.r * Math.cos(theta), y: l.cy + l.r * Math.sin(theta), theta };
}

interface Motion {
  /** Avance de la cinta en px: la burbuja `k` está en s = progress - k * spacing. */
  progress: number;
  /** 0 detenido, 1 a velocidad normal; se suaviza al arrancar. */
  velocity: number;
  moving: boolean;
  reduced: boolean;
  glide: { from: number; to: number; start: number } | null;
  first: number;
}

function placeItem(l: Layout, m: Motion, slot: number, item: HTMLLIElement) {
  const s = m.progress - slot * l.spacing;
  const inPath = s >= 0 && s <= l.length;
  const p = pointAt(l, clamp(s, 0, l.length));
  // Profundidad sutil: más grandes al entrar (cerca), algo menores al salir.
  const scale = 1.1 - 0.2 * clamp(s / l.length, 0, 1);
  const behind = pointAt(l, s - 24);
  item.style.transform = `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, 0)`;
  item.style.visibility = inPath ? "" : "hidden";
  item.style.setProperty("--s", scale.toFixed(4));
  item.style.setProperty("--trail-a", `${Math.atan2(behind.y - p.y, behind.x - p.x).toFixed(4)}rad`);
  item.style.setProperty("--trail-o", m.velocity.toFixed(3));
  // Solo las burbujas completamente dentro del encuadre reciben el foco del teclado.
  const half = (l.bubble * scale) / 2;
  const onScreen = inPath && p.x - half >= 0 && p.x + half <= l.w && p.y - half >= 0 && p.y + half <= l.h;
  const button = item.querySelector("button");
  if (button && button.tabIndex !== (onScreen ? 0 : -1)) button.tabIndex = onScreen ? 0 : -1;
  item.toggleAttribute("aria-hidden", !onScreen);
}

/** En escritorio la ficha se coloca junto al club, hacia el interior del arco, sin tapar su nombre. */
function placeCard(l: Layout, m: Motion, slot: number, card: HTMLElement, orbit: HTMLElement) {
  if (!l.wide) {
    card.style.transform = "";
    return;
  }
  const p = pointAt(l, clamp(m.progress - slot * l.spacing, 0, l.length));
  const cw = card.offsetWidth;
  const ch = card.offsetHeight;
  const half = Math.max(l.bubble * 0.6, 84);
  const box = { x0: p.x - half, x1: p.x + half, y0: p.y - l.bubble * 0.6, y1: p.y + l.bubble * 0.6 + 58 };
  const nx = l.cx - p.x;
  const ny = l.cy - p.y;
  const len = Math.hypot(nx, ny) || 1;
  let x = p.x - cw / 2;
  let y = p.y - ch / 2;
  for (let t = 0; t < 900; t += 6) {
    x = p.x + (nx / len) * t - cw / 2;
    y = p.y + (ny / len) * t - ch / 2;
    const apart = x > box.x1 + 14 || x + cw < box.x0 - 14 || y > box.y1 + 14 || y + ch < box.y0 - 14;
    if (apart) break;
  }
  x = clamp(x, 8, orbit.clientWidth - cw - 16);
  y = clamp(y, 8, orbit.clientHeight - ch - 64);
  card.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
}

export function ClubOrbit() {
  const wide = useMediaQuery(WIDE_LAYOUT);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [layout, setLayout] = useState<Layout | null>(null);
  const [firstSlot, setFirstSlot] = useState(0);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const [focusSlot, setFocusSlot] = useState<number | null>(null);
  const [pinnedSlot, setPinnedSlot] = useState<number | null>(null);
  const [userPaused, setUserPaused] = useState(false);

  const orbitRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const pauseRef = useRef<HTMLButtonElement>(null);
  const items = useRef(new Map<number, HTMLLIElement>());
  const layoutRef = useRef<Layout | null>(null);
  const activeRef = useRef<number | null>(null);
  const leaveTimer = useRef<number | undefined>(undefined);
  const motion = useRef<Motion>({ progress: 0, velocity: 0, moving: false, reduced: false, glide: null, first: 0 });

  function placeAll() {
    const l = layoutRef.current;
    if (!l) return;
    items.current.forEach((item, slot) => placeItem(l, motion.current, slot, item));
  }

  function positionCard() {
    const l = layoutRef.current;
    const slot = activeRef.current;
    if (l && slot !== null && cardRef.current && orbitRef.current) {
      placeCard(l, motion.current, slot, cardRef.current, orbitRef.current);
    }
  }

  const activeSlot = hoverSlot ?? focusSlot ?? pinnedSlot;
  const activeClub = activeSlot === null ? null : clubAt(activeSlot);
  const stopped = userPaused || pinnedSlot !== null;

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const next = computeLayout(stage.clientWidth, stage.clientHeight, wide);
      const prev = layoutRef.current;
      const m = motion.current;
      // Al cambiar de tamaño se conserva la posición relativa de cada burbuja.
      m.progress = prev ? (m.progress / prev.spacing) * next.spacing : next.length - next.spacing * 0.5;
      m.glide = null;
      m.first = Math.ceil((m.progress - next.length) / next.spacing);
      layoutRef.current = next;
      setFirstSlot(m.first);
      setLayout(next);
      placeAll();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [wide]);

  useEffect(() => {
    motion.current.moving = !reduced && !userPaused && activeSlot === null;
    motion.current.reduced = reduced;
    activeRef.current = activeSlot;
  }, [reduced, userPaused, activeSlot]);

  useLayoutEffect(() => {
    positionCard();
  });

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  // Un solo bucle escribe las posiciones en el DOM; React solo vuelve a renderizar
  // cuando entra una burbuja nueva (una vez por segundo, aproximadamente).
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const l = layoutRef.current;
      const m = motion.current;
      if (l) {
        const target = m.moving ? 1 : 0;
        // Arranca suave y se detiene casi en seco para que la burbuja no escape del cursor.
        const tau = target > m.velocity ? 0.35 : 0.05;
        m.velocity += (target - m.velocity) * (1 - Math.exp(-dt / tau));
        if (target === 0 && m.velocity < 0.01) m.velocity = 0;

        let changed = false;
        if (m.glide) {
          if (m.glide.start < 0) m.glide.start = now;
          const t = Math.min((now - m.glide.start) / STEP_MS, 1);
          const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
          m.progress = m.glide.from + (m.glide.to - m.glide.from) * eased;
          if (t === 1) m.glide = null;
          changed = true;
        } else if (m.velocity > 0) {
          m.progress += m.velocity * l.speed * dt;
          changed = true;
        }
        if (changed) {
          const first = Math.ceil((m.progress - l.length) / l.spacing);
          if (first !== m.first) {
            m.first = first;
            setFirstSlot(first);
          }
          placeAll();
          positionCard();
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  function step(direction: 1 | -1) {
    const l = layoutRef.current;
    if (!l) return;
    const m = motion.current;
    const to = (m.glide?.to ?? m.progress) + direction * l.spacing;
    if (m.reduced) {
      m.progress = to;
      m.glide = null;
      m.first = Math.ceil((to - l.length) / l.spacing);
      setFirstSlot(m.first);
      placeAll();
    } else {
      // El bucle fija el instante de inicio en su próximo cuadro.
      m.glide = { from: m.progress, to, start: -1 };
    }
  }

  function focusSlotLater(slot: number) {
    window.setTimeout(() => items.current.get(slot)?.querySelector("button")?.focus(), motion.current.reduced ? 30 : STEP_MS + 30);
  }

  function holdHover(slot: number) {
    window.clearTimeout(leaveTimer.current);
    setHoverSlot(slot);
  }

  function releaseHover() {
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setHoverSlot(null), HOVER_GRACE_MS);
  }

  function closeCard() {
    setPinnedSlot(null);
    setHoverSlot(null);
    setFocusSlot(null);
    setUserPaused(false);
    pauseRef.current?.focus();
  }

  const slots = layout ? Array.from({ length: layout.pool }, (_, i) => firstSlot + i) : [];
  const ringSize = layout ? 2 * (layout.r + layout.band / 2) + 4 : 0;

  return (
    <div
      ref={orbitRef}
      className="orbit"
      data-ready={layout ? true : undefined}
      data-active={activeClub ? true : undefined}
      style={layout ? ({ "--bubble": `${layout.bubble}px` } as React.CSSProperties) : undefined}
    >
      <div className="orbit__stage" ref={stageRef}>
        {layout && (
          <div className="orbit__band-shadow" aria-hidden="true">
            <div
              className="orbit__band"
              style={
                {
                  left: layout.cx - ringSize / 2,
                  top: layout.cy - ringSize / 2,
                  width: ringSize,
                  height: ringSize,
                  "--ri": `${layout.r - layout.band / 2}px`,
                  "--ro": `${layout.r + layout.band / 2}px`,
                  "--bw": `${layout.band}px`,
                } as React.CSSProperties
              }
            />
          </div>
        )}

        <ul
          className="orbit__track"
          aria-label="Clubes del catálogo"
          onKeyDown={(e) => {
            if (e.key === "Escape") closeCard();
          }}
        >
          {slots.map((slot) => {
            const club = clubAt(slot);
            const isActive = slot === activeSlot;
            return (
              <li
                key={slot}
                ref={(el) => {
                  if (el) {
                    items.current.set(slot, el);
                    if (layoutRef.current) placeItem(layoutRef.current, motion.current, slot, el);
                  } else {
                    items.current.delete(slot);
                  }
                }}
                className="orbit__item"
                data-active={isActive || undefined}
              >
                <span className="orbit__trail" aria-hidden="true" />
                <button
                  type="button"
                  className="orbit__bubble"
                  aria-pressed={pinnedSlot === slot}
                  aria-controls="orbit-card"
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") holdHover(slot);
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType === "mouse") releaseHover();
                  }}
                  onFocus={(e) => {
                    // Solo el foco de teclado; un clic también enfoca el botón en algunos navegadores.
                    if (e.currentTarget.matches(":focus-visible")) setFocusSlot(slot);
                  }}
                  onBlur={() => setFocusSlot((s) => (s === slot ? null : s))}
                  onClick={() => setPinnedSlot((s) => (s === slot ? null : slot))}
                  onKeyDown={(e) => {
                    const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
                    const back = e.key === "ArrowLeft" || e.key === "ArrowUp";
                    if (!forward && !back) return;
                    e.preventDefault();
                    // La cinta avanza un puesto y el foco pasa al club que ocupa ese lugar.
                    step(forward ? 1 : -1);
                    focusSlotLater(slot + (forward ? 1 : -1));
                  }}
                >
                  <BubbleFace club={club} />
                  <span className="orbit__label">{club.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div
        ref={cardRef}
        id="orbit-card"
        className="orbit__card"
        aria-live="polite"
        hidden={!activeClub}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse" && hoverSlot !== null) holdHover(hoverSlot);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") releaseHover();
        }}
      >
        {activeClub && <ClubCard club={activeClub} />}
        {activeClub && pinnedSlot !== null && (
          <button type="button" className="orbit__close" onClick={closeCard}>
            <span className="orbit__close-icon" aria-hidden="true" />
            Cerrar y continuar
          </button>
        )}
      </div>

      <div className="orbit__controls" role="group" aria-label="Movimiento de los clubes">
        <button type="button" className="orbit__control" aria-label="Clubes anteriores" onClick={() => step(-1)}>
          <span className="orbit__chevron" data-dir="back" aria-hidden="true" />
        </button>
        {!reduced && (
          <button
            ref={pauseRef}
            type="button"
            className="orbit__control orbit__control--pause"
            aria-pressed={stopped}
            onClick={() => {
              if (stopped) {
                setUserPaused(false);
                setPinnedSlot(null);
              } else {
                setUserPaused(true);
              }
            }}
          >
            <span className="orbit__pause-icon" data-state={stopped ? "play" : "pause"} aria-hidden="true" />
            {stopped ? "Reanudar" : "Pausar"}
          </button>
        )}
        <button type="button" className="orbit__control" aria-label="Clubes siguientes" onClick={() => step(1)}>
          <span className="orbit__chevron" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * Logo o foto del club si existen en data/medios-clubes.json; si no hay o no cargan,
 * el pictograma de su rama y sus siglas.
 */
function BubbleFace({ club }: { club: Club }) {
  const sources = [
    club.logoUrl && { src: club.logoUrl, kind: "logo" as const },
    club.imageUrl && { src: club.imageUrl, kind: "photo" as const },
  ].filter((m): m is { src: string; kind: "logo" | "photo" } => Boolean(m));
  const [failed, setFailed] = useState(0);
  const media = sources[failed];
  const branch = BRANCH_BY_ID[club.branches[0]];
  const text = monogram(club.name);

  return (
    <span className="orbit__disc" data-media={media?.kind}>
      {media ? (
        // eslint-disable-next-line @next/next/no-img-element -- archivos locales de tamaño variable
        <img
          key={media.src}
          src={media.src}
          alt=""
          draggable={false}
          onError={() => setFailed((n) => n + 1)}
          ref={(img) => {
            // Un error anterior a la hidratación no dispara onError.
            if (img?.complete && img.naturalWidth === 0) setFailed((n) => n + 1);
          }}
        />
      ) : (
        <>
          <BranchGlyph id={branch.id} className="orbit__glyph" />
          <span className="orbit__mono" data-long={text.length > 4 || undefined} aria-hidden="true">
            {text}
          </span>
        </>
      )}
    </span>
  );
}

function ClubCard({ club }: { club: Club }) {
  const branch = BRANCH_BY_ID[club.branches[0]];
  const kind = typeLabel(club.type);
  return (
    <div className="orbit__club" style={{ "--lacquer": branch.color, "--lacquer-ink": branch.ink } as React.CSSProperties}>
      <p className="orbit__club-branch">
        <span className="orbit__club-chip" aria-hidden="true">
          <BranchGlyph id={branch.id} />
        </span>
        {branch.name}
      </p>
      <p className="orbit__club-name">{club.name}</p>
      {kind && <p className="orbit__club-kind">{kind}</p>}
      {club.description && <p className="orbit__club-desc">{club.description}</p>}
    </div>
  );
}
