"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { AssistantTurn } from "@/lib/engine/types";
import type { ChatMessage } from "@/lib/types";

interface ConversationProps {
  messages: ChatMessage[];
  turn: AssistantTurn | null;
  thinking: boolean;
  error: string | null;
  canReview: boolean;
  onSend: (text: string) => void;
  onReviewProfile: () => void;
}

export function Conversation({
  messages,
  turn,
  thinking,
  error,
  canReview,
  onSend,
  onReviewProfile,
}: ConversationProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const done = turn?.readyForProfile ?? false;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, thinking]);

  const submit = (text: string) => {
    const value = text.trim();
    if (!value || thinking || done) return;
    onSend(value);
    setDraft("");
    inputRef.current?.focus();
  };

  return (
    <section className="chat" aria-labelledby="chat-title">
      <header className="section-head">
        <h2 id="chat-title" className="section-head__title" tabIndex={-1} data-step-heading>
          Cuéntanos de ti
        </h2>
        <p className="notice">
          Conversación simulada: las preguntas son fijas y el perfil se arma con reglas de palabras clave en tu
          navegador. No escribas contraseñas ni datos sensibles.
        </p>
      </header>

      <div className="chat__log" role="log" aria-live="polite" aria-relevant="additions">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              className={`bubble bubble--${m.role}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <span className="bubble__who">{m.role === "assistant" ? "Guía de la demo" : "Tú"}</span>
              <p>{m.text}</p>
            </motion.div>
          ))}
        </AnimatePresence>
        {thinking && (
          <div className="bubble bubble--assistant bubble--thinking">
            <span className="bubble__who">Guía de la demo</span>
            <p>
              <span className="dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="sr-only">Preparando la siguiente pregunta</span>
            </p>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      {done ? (
        <div className="chat__done">
          <button type="button" className="btn btn--primary btn--large" onClick={onReviewProfile} disabled={!canReview}>
            Revisar mi perfil
          </button>
        </div>
      ) : (
        <>
          {turn && turn.suggestions.length > 0 && !thinking && (
            <div className="chips" role="group" aria-label="Respuestas sugeridas">
              {turn.suggestions.map((s) => (
                <button key={s} type="button" className="chip chip--suggest" onClick={() => submit(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              submit(draft);
            }}
          >
            <label htmlFor="composer-input" className="sr-only">
              Tu respuesta
            </label>
            <textarea
              id="composer-input"
              ref={inputRef}
              className="composer__input"
              rows={2}
              placeholder="Escribe con tus palabras…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(draft);
                }
              }}
              maxLength={500}
            />
            <button type="submit" className="btn btn--primary" disabled={!draft.trim() || thinking}>
              Enviar
            </button>
          </form>
        </>
      )}
    </section>
  );
}
