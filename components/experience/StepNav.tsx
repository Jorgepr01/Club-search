"use client";

import { STEPS, type Step } from "./steps";

interface StepNavProps {
  current: Step;
  reachable: Record<Step, boolean>;
  onSelect: (step: Step) => void;
}

export function StepNav({ current, reachable, onSelect }: StepNavProps) {
  return (
    <nav className="steps" aria-label="Pasos del recorrido">
      <ol>
        {STEPS.map((s, i) => {
          const isCurrent = s.id === current;
          return (
            <li key={s.id}>
              <button
                type="button"
                className="steps__item"
                aria-current={isCurrent ? "step" : undefined}
                disabled={!reachable[s.id] && !isCurrent}
                onClick={() => onSelect(s.id)}
              >
                <span className="steps__num" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="steps__label">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
