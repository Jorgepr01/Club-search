"use client";

import { motion, useReducedMotion } from "motion/react";
import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";

// Conexiones curvas en SVG entre un nodo de origen y varios destinos. Son decorativas:
// la misma relación se expresa en el texto y en la estructura del HTML.
// El origen se marca con `data-connect-from` y cada destino con `data-connect="<id>"`
// dentro del contenedor.

type Point = { x: number; y: number };
export type Anchor = (rect: DOMRect) => Point;

interface ConnectorsProps {
  containerRef: RefObject<HTMLElement | null>;
  targets: { id: string; active?: boolean }[];
  fromAnchor: Anchor;
  toAnchor: Anchor;
  /** "vertical": curva en S de arriba abajo. "side": baja por un costado y gira hacia el destino. */
  curve: "vertical" | "side";
  color: (id: string) => string;
  /** Cambia este valor para seguir midiendo durante una transición de tamaño. */
  settleKey?: unknown;
}

function pathFor(from: Point, to: Point, curve: ConnectorsProps["curve"]): string {
  if (curve === "vertical") {
    const midY = (from.y + to.y) / 2;
    return `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
  }
  return `M ${from.x} ${from.y} C ${from.x} ${to.y}, ${from.x} ${to.y}, ${to.x} ${to.y}`;
}

export function Connectors({ containerRef, targets, fromAnchor, toAnchor, curve, color, settleKey }: ConnectorsProps) {
  const [paths, setPaths] = useState<{ id: string; d: string; active?: boolean }[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const latest = useRef({ targets, fromAnchor, toAnchor, curve });
  useLayoutEffect(() => {
    latest.current = { targets, fromAnchor, toAnchor, curve };
  });
  const reduceMotion = useReducedMotion();
  const targetKey = targets.map((t) => `${t.id}:${t.active ?? ""}`).join("|");

  const measure = useCallback(() => {
    const container = containerRef.current;
    const from = container?.querySelector<HTMLElement>("[data-connect-from]");
    if (!container || !from) return;
    const { targets: list, fromAnchor: fa, toAnchor: ta, curve: c } = latest.current;
    const base = container.getBoundingClientRect();
    const rel = (r: DOMRect) => new DOMRect(r.x - base.x, r.y - base.y, r.width, r.height);
    const start = fa(rel(from.getBoundingClientRect()));
    const next = list.flatMap((t) => {
      const el = container.querySelector<HTMLElement>(`[data-connect="${t.id}"]`);
      return el ? [{ id: t.id, active: t.active, d: pathFor(start, ta(rel(el.getBoundingClientRect())), c) }] : [];
    });
    setSize((s) => (s.width === base.width && s.height === base.height ? s : { width: base.width, height: base.height }));
    setPaths(next);
  }, [containerRef]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    container.querySelectorAll("[data-connect-from], [data-connect]").forEach((el) => observer.observe(el));
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, containerRef, targetKey, curve]);

  // Durante una expansión el tamaño cambia en cada cuadro: seguimos midiendo un momento.
  useLayoutEffect(() => {
    let frame = 0;
    const until = performance.now() + 900;
    const tick = () => {
      measure();
      if (performance.now() < until) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [settleKey, targetKey, measure]);

  return (
    <svg
      className="connectors"
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width || 1} ${size.height || 1}`}
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((p, i) => (
        <motion.path
          key={p.id}
          d={p.d}
          fill="none"
          stroke={color(p.id)}
          strokeWidth={p.active ? 4 : 2.25}
          strokeLinecap="round"
          initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: p.active === false ? 0.4 : 1 }}
          transition={{ duration: 0.7, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
    </svg>
  );
}
