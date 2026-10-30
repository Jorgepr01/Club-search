"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import type { AssistantTurn } from "@/lib/engine/types";
import type { ChatMessage } from "@/lib/types";

interface VoiceRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface VoiceRecognitionErrorEvent {
  error: string;
}

interface VoiceRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: VoiceRecognitionEvent) => void) | null;
  onerror: ((event: VoiceRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type VoiceRecognitionConstructor = new () => VoiceRecognition;
type VoiceRecognitionWindow = Window & {
  SpeechRecognition?: VoiceRecognitionConstructor;
  webkitSpeechRecognition?: VoiceRecognitionConstructor;
};

interface ConversationProps {
  messages: ChatMessage[];
  turn: AssistantTurn | null;
  thinking: boolean;
  error: string | null;
  canReview: boolean;
  allowReplies: boolean;
  onSend: (text: string) => void;
  onReviewProfile: () => void;
  onClose: () => void;
}

export function Conversation({
  messages,
  turn,
  thinking,
  error,
  canReview,
  allowReplies,
  onSend,
  onReviewProfile,
  onClose,
}: ConversationProps) {
  const [draft, setDraft] = useState("");
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const id = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<VoiceRecognition | null>(null);
  const done = (turn?.readyForProfile ?? false) && !allowReplies;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, thinking]);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
    },
    [],
  );

  const submit = (text: string) => {
    const value = text.trim();
    if (!value || thinking || done) return;
    onSend(value);
    setDraft("");
    inputRef.current?.focus();
  };

  const toggleVoiceRecording = () => {
    if (recordingVoice) {
      recognitionRef.current?.stop();
      return;
    }

    const speechWindow = window as VoiceRecognitionWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceStatus(
        "El reconocimiento por voz no está disponible en este navegador. Escribe tu respuesta en el campo de texto.",
      );
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "es-EC";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (!transcript) return;
      setDraft((current) => [current.trim(), transcript].filter(Boolean).join(" "));
      setVoiceStatus("Respuesta registrada por voz. Revísala y pulsa «Enviar».");
      inputRef.current?.focus();
    };
    recognition.onerror = (event) => {
      setVoiceStatus(
        event.error === "not-allowed"
          ? "No se concedió permiso para usar el micrófono."
          : "No se pudo registrar la respuesta por voz. Puedes escribirla en el campo de texto.",
      );
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setRecordingVoice(false);
    };
    recognitionRef.current = recognition;
    setVoiceStatus("Escuchando. Se está registrando tu respuesta por voz.");
    setRecordingVoice(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setRecordingVoice(false);
      setVoiceStatus("No se pudo iniciar el micrófono. Puedes escribir tu respuesta.");
    }
  };

  return (
    <section className="chat" aria-labelledby={`${id}-title`}>
      <header className="section-head chat__head">
        <div className="chat__heading">
          <h2 id={`${id}-title`} className="section-head__title" tabIndex={-1} data-step-heading>
            Cuéntanos de ti
          </h2>
          <button type="button" className="chat__close" onClick={onClose} aria-label="Cerrar conversación">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <p className="notice">
          Conversación simulada: el perfil se arma con reglas de palabras clave en tu navegador. El reconocimiento
          por voz depende del navegador y podría procesar el audio mediante su servicio. No escribas contraseñas ni
          datos sensibles.
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
            Ver mi perfil
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
            <label htmlFor={`${id}-composer-input`} className="sr-only">
              Tu respuesta
            </label>
            <textarea
              id={`${id}-composer-input`}
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
            <div className="composer__actions">
              <button
                type="button"
                className="btn btn--microphone"
                onClick={toggleVoiceRecording}
                aria-label={recordingVoice ? "Detener grabación de voz" : "Registrar respuesta por voz"}
                aria-pressed={recordingVoice}
                disabled={thinking}
              >
                {recordingVoice ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="7" y="7" width="10" height="10" rx="2" />
                  </svg>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- micrófono SVG local de la aplicación
                  <img src="/microphone.svg" alt="" aria-hidden="true" />
                )}
              </button>
              <button type="submit" className="btn btn--primary" disabled={!draft.trim() || thinking}>
                Enviar
              </button>
            </div>
          </form>
          {voiceStatus && (
            <p className="composer__voice-status" role="status">
              {voiceStatus}
            </p>
          )}
        </>
      )}
    </section>
  );
}
