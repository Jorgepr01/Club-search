"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { BrowserDictationAdapter, type DictationProblem } from "@/lib/speech/dictation";
import { SpanishSpeechAdapter } from "@/lib/speech/synthesis";
import { STEPS, type Step } from "./steps";
import { actionsFor, type VoiceContext } from "./voiceActions";
import { parseVoiceCommand, stripWakeWord, WAKE_WORD } from "./voiceCommands";
import "./VoiceGuide.css";

// Barra fija al pie: la forma principal de moverse por el recorrido.
// Lee la guía de cada paso, avanza o retrocede con botones o con la voz,
// y explica qué falta cuando un paso aún no está disponible.
// Un solo micrófono con dos usos: si la frase empieza con «Guía» es una orden
// de navegación; si no, en Conversación y Perfil se envía al chat.

const ORDER: Step[] = ["welcome", ...STEPS.map((s) => s.id)];
const COMMAND_TIMEOUT_MS = 10000;
const MESSAGE_TIMEOUT_MS = 60000;

const guidance: Record<Step, string> = {
  welcome:
    "Bienvenido a Comunidad ESPOL. Te haré tres preguntas para encontrar clubes afines a ti. Pulsa Empezar o di «Guía, siguiente».",
  chat: "Cuéntame tus intereses, objetivos y disponibilidad. Responde escribiendo o pulsa el micrófono de la guía y habla. Cuando tu perfil esté listo, pulsa Siguiente.",
  profile: "Revisa y edita tu perfil. Cuando esté bien, pulsa «Confirmar perfil» o di «Guía, confirmar perfil».",
  tree: "Elige la rama de intereses que quieras explorar. Tócala o di su nombre, por ejemplo «Guía, robótica».",
  clubs: "Estos son los clubes que mejor encajan contigo. Abre una tarjeta o di «Guía, abre el primero» para escuchar sus detalles.",
};

const HELP = `Para navegar, empieza con «${WAKE_WORD}»: por ejemplo «${WAKE_WORD}, siguiente», «${WAKE_WORD}, atrás», «${WAKE_WORD}, ir a ramas», «${WAKE_WORD}, vamos a clubes» o «${WAKE_WORD}, repite».`;
const COMMANDS = ["siguiente", "atrás", "ir a perfil", "vamos a ramas", "repite", "para"];

const problems: Record<DictationProblem, string> = {
  unsupported: "Tu navegador no admite comandos de voz. Usa los botones de la guía.",
  "not-allowed": "El navegador no tiene permiso para usar el micrófono.",
  "audio-capture": "No se encontró un micrófono disponible.",
  network: "El reconocimiento de voz necesita conexión. Inténtalo de nuevo.",
  "no-speech": "No te escuché. Pulsa el micrófono e inténtalo de nuevo.",
  language: "El reconocimiento en español no está disponible.",
  unknown: "El reconocimiento se detuvo. Inténtalo de nuevo.",
};

function stepName(step: Step) {
  return step === "welcome" ? "Bienvenida" : STEPS.find((s) => s.id === step)!.label;
}

function stepLabel(step: Step) {
  const index = STEPS.findIndex((s) => s.id === step);
  return index < 0 ? "Bienvenida" : `Paso ${index + 1} de ${STEPS.length} · ${STEPS[index].label}`;
}

/** Por qué todavía no se puede ir a un paso. */
function lockReason(target: Step, reachable: Record<Step, boolean>) {
  if (target === "profile") return "Responde las preguntas de la conversación para preparar tu perfil.";
  if (target === "tree") return "Confirma tu perfil para ver las ramas.";
  if (target === "clubs") return reachable.tree ? "Elige una rama para ver sus clubes." : "Confirma tu perfil para ver las ramas.";
  return "";
}

interface Props {
  step: Step;
  /** Estado y acciones de la página que la guía puede usar por voz (voiceActions.ts). */
  voice: VoiceContext;
  reachable: Record<Step, boolean>;
  onNavigate: (step: Step) => void;
  chatMessage: { id: string; text: string } | null;
  /** Si lo dicho sin la palabra clave puede enviarse al chat en este paso. */
  canConverse: boolean;
  /** El chat está preparando una respuesta. */
  busy: boolean;
  onSend: (text: string) => void;
}

export function VoiceGuide({ step, voice, reachable, onNavigate, chatMessage, canConverse, busy, onSend }: Props) {
  const [speech] = useState(() => new SpanishSpeechAdapter());
  const [dictation] = useState(() => new BrowserDictationAdapter());
  const snapshot = useSyncExternalStore(dictation.subscribe, dictation.getSnapshot, dictation.getSnapshot);
  const [enabled, setEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState("");
  // Qué se está dictando: aún no se sabe, una orden o un mensaje para el chat.
  const [listeningAs, setListeningAs] = useState<"command" | "message" | null>(null);
  const [heard, setHeard] = useState("");
  const utterance = useRef<ReturnType<SpanishSpeechAdapter["speak"]> | null>(null);
  const session = useRef<ReturnType<BrowserDictationAdapter["listen"]> | null>(null);
  const discard = useRef(false);
  const speakReply = useRef(false);
  // Una acción que cambia de paso ya respondió: la llegada al paso no la interrumpe.
  const quietArrival = useRef(false);
  const previousStep = useRef(step);
  const lastMessage = useRef<string | null>(null);
  const speakOnArrive = useRef(false);
  const actions = actionsFor(step, voice);
  const latest = useRef({ step, actions, reachable, onNavigate, canConverse, busy, onSend });
  const root = useRef<HTMLElement>(null);
  const ids = useId();
  const panelId = `${ids}-panel`;
  const autoId = `${ids}-auto`;

  useEffect(() => {
    latest.current = { step, actions, reachable, onNavigate, canConverse, busy, onSend };
  });

  const index = ORDER.indexOf(step);
  const prev = index > 0 ? ORDER[index - 1] : null;
  const next = index < ORDER.length - 1 ? ORDER[index + 1] : null;
  const nextLocked = next !== null && !reachable[next];

  function stopAudio() {
    utterance.current?.cancel();
    utterance.current = null;
    speech.stop();
    setSpeaking(false);
  }

  function say(text: string) {
    if (!SpanishSpeechAdapter.isSupported()) {
      setNotice("La lectura en voz alta no está disponible en este navegador.");
      return;
    }
    stopAudio();
    setSpokenText(text);
    const current = speech.speak(text);
    utterance.current = current;
    setSpeaking(true);
    // Si el chat empieza a leer o a dictar, cancela esta lectura y el estado se actualiza aquí.
    current.subscribe(() => {
      if (current.status.type === "ended" && utterance.current === current) {
        utterance.current = null;
        setSpeaking(false);
        // Sin audio, lo que se iba a decir sigue en pantalla: el aviso no lo reemplaza.
        if (current.status.reason === "error")
          setNotice((shown) => shown || "No se pudo reproducir el audio. La guía sigue disponible en texto.");
      }
    });
  }

  function navigate(target: Step, byVoice = false) {
    const { step: current, reachable: canReach, onNavigate: go } = latest.current;
    if (target === current) {
      if (byVoice) say(guidance[current]);
      return;
    }
    if (!canReach[target]) {
      const reason = lockReason(target, canReach);
      setNotice(reason);
      if (byVoice) say(reason);
      return;
    }
    speakOnArrive.current = byVoice;
    setExpanded(false);
    go(target);
  }

  function runCommand(text: string, said: string) {
    const { step: current } = latest.current;
    const position = ORDER.indexOf(current);
    // Primero lo propio del paso (confirmar el perfil, elegir una rama…), luego la navegación.
    for (const action of text ? latest.current.actions : []) {
      quietArrival.current = true;
      const reply = action.run(text);
      if (reply === null) continue;
      window.setTimeout(() => (quietArrival.current = false), 600);
      setNotice(reply);
      say(reply);
      return;
    }
    quietArrival.current = false;
    const parsed = text ? parseVoiceCommand(text) : { type: "help" as const };
    if (!parsed) {
      const reply = `No entendí «${said}». ${HELP}`;
      setNotice(reply);
      say(reply);
      return;
    }
    switch (parsed.type) {
      case "go":
        return navigate(parsed.step, true);
      case "next":
        if (position === ORDER.length - 1) return say("Ya estás en el último paso.");
        return navigate(ORDER[position + 1], true);
      case "back":
        if (position === 0) return say("Ya estás en el inicio.");
        return navigate(ORDER[position - 1], true);
      case "repeat":
        return say(guidance[current]);
      case "help":
        setNotice(HELP);
        return say(HELP);
      case "stop":
        return stopAudio();
    }
  }

  function toggleMic() {
    if (session.current) {
      void session.current.stop();
      return;
    }
    stopAudio();
    setNotice("");
    setHeard("");
    discard.current = false;
    const conversing = latest.current.canConverse;
    let kind: "command" | "message" | null = null;
    let message = "";
    const current = dictation.listen();
    session.current = current;
    setListeningAs(null);
    const timer = window.setTimeout(() => void current.stop(), conversing ? MESSAGE_TIMEOUT_MS : COMMAND_TIMEOUT_MS);

    // La primera frase decide: con «Guía» es una orden y se ejecuta al instante;
    // sin ella es un mensaje para el chat, que se envía al pulsar detener.
    current.onSpeech(({ transcript, isFinal }) => {
      const phrase = transcript.trim();
      if (isFinal === false || !phrase || kind === "command") return;
      if (kind === null) {
        const order = stripWakeWord(phrase);
        if (order !== null || !latest.current.canConverse) {
          kind = "command";
          setListeningAs("command");
          void current.stop();
          if (order !== null) runCommand(order, phrase);
          else {
            const reply = `Para navegar, empieza con «${WAKE_WORD}». Por ejemplo: «${WAKE_WORD}, siguiente».`;
            setNotice(reply);
            say(reply);
          }
          return;
        }
        kind = "message";
        setListeningAs("message");
      }
      message = message ? `${message} ${phrase}` : phrase;
      setHeard(message);
    });

    current.onSpeechEnd(() => {
      window.clearTimeout(timer);
      if (session.current === current) session.current = null;
      setListeningAs(null);
      setHeard("");
      const problem = dictation.getSnapshot().problem;
      if (discard.current) return setNotice("Mensaje descartado.");
      if (kind === "message" && message && !problem) {
        if (latest.current.busy) return setNotice("Espera la respuesta del chat y vuelve a intentarlo.");
        speakReply.current = true;
        latest.current.onSend(message.slice(0, 500));
        return;
      }
      if (problem) setNotice(problems[problem]);
      else if (kind === null) setNotice(problems["no-speech"]);
    });
    // listen puede fallar de forma síncrona si el navegador no admite la API.
    if (current.status.type === "ended") session.current = null;
  }

  function discardMessage() {
    discard.current = true;
    session.current?.cancel();
  }

  // Cada cambio de paso detiene la escucha; la guía se lee si está activada o si se llegó por voz.
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    lastMessage.current = chatMessage?.id ?? null;
    const quiet = quietArrival.current;
    quietArrival.current = false;
    session.current = null;
    dictation.abort();
    if (quiet) return;
    const timer = window.setTimeout(() => {
      setNotice("");
      if (enabled || speakOnArrive.current) say(step === "chat" && chatMessage ? chatMessage.text : guidance[step]);
      speakOnArrive.current = false;
    }, 400);
    return () => window.clearTimeout(timer);
    // La guía solo se reproduce al cambiar de etapa, no al cambiar el estado del audio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Las respuestas nuevas del chat se leen si la lectura está activada o si se le habló por voz.
  useEffect(() => {
    if ((step !== "chat" && step !== "profile") || !chatMessage || lastMessage.current === chatMessage.id) return;
    lastMessage.current = chatMessage.id;
    const byVoice = speakReply.current;
    speakReply.current = false;
    if (!enabled && !byVoice) return;
    const timer = window.setTimeout(() => say(chatMessage.text), 0);
    return () => window.clearTimeout(timer);
    // Solo los mensajes nuevos activan lectura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessage?.id, step]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 8000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(
    () => () => {
      dictation.abort();
      speech.stop();
    },
    [dictation, speech],
  );

  // El panel se cierra con Escape o al pulsar fuera de la guía.
  useEffect(() => {
    if (!expanded) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setExpanded(false);
    }
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setExpanded(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [expanded]);

  function toggleAuto() {
    if (enabled) {
      setEnabled(false);
      stopAudio();
    } else {
      setEnabled(true);
      say(guidance[step]);
    }
  }

  const listening = snapshot.listening;
  const state = listening ? "listening" : speaking ? "speaking" : "idle";
  let line = nextLocked ? lockReason(next!, reachable) : guidance[step];
  if (speaking) line = spokenText;
  if (busy && canConverse) line = "El chat está preparando su respuesta…";
  if (notice) line = notice;
  if (listening) {
    const live = [heard, snapshot.interim].filter(Boolean).join(" ");
    if (live) line = `«${live}»`;
    else if (canConverse) line = `Habla para responder al chat, o di «${WAKE_WORD}, …» para navegar.`;
    else line = `Te escucho. Di «${WAKE_WORD}, siguiente» o «${WAKE_WORD}, ir a ramas».`;
  }
  const showLock = nextLocked && !speaking && !listening && !notice && !(busy && canConverse);
  let eyebrow = stepLabel(step);
  if (listening) eyebrow = listeningAs === "message" ? "Mensaje para el chat · pulsa ■ para enviar" : listeningAs === "command" ? "Orden de navegación" : "Escuchando…";
  const micLabel = listening
    ? listeningAs === "message"
      ? "Enviar mensaje al chat"
      : "Dejar de escuchar"
    : canConverse
      ? "Hablar con el chat o dar una orden"
      : "Dar una orden por voz";

  return (
    <nav className="guide" ref={root} data-state={state} aria-label="Guía del recorrido">
      <div className="guide__inner">
        {expanded && (
          <section id={panelId} className="guide__panel" aria-label="Detalles de la guía">
            <header className="guide__head">
              <div>
                <p className="guide__eyebrow">{stepLabel(step)}</p>
                <h2 className="guide__title">Guía de voz</h2>
              </div>
              <button type="button" className="guide__icon-btn" onClick={() => setExpanded(false)} aria-label="Cerrar detalles" title="Cerrar">
                <CloseIcon />
              </button>
            </header>

            <div className="guide__card">
              <p className="guide__label">Qué hacer aquí</p>
              <p className="guide__text">{guidance[step]}</p>
              <button type="button" className="guide__pill" onClick={() => (speaking ? stopAudio() : say(guidance[step]))}>
                {speaking ? <StopIcon /> : <SpeakerIcon />}
                {speaking ? "Detener" : "Escuchar"}
              </button>
              <label className="guide__switch" htmlFor={autoId}>
                <span>
                  <span className="guide__switch-title">Leer guía y respuestas</span>
                  <span className="guide__hint">Al cambiar de paso se lee la guía, y en la conversación cada respuesta nueva.</span>
                </span>
                <input id={autoId} type="checkbox" role="switch" checked={enabled} onChange={toggleAuto} />
                <span className="guide__switch-track" aria-hidden="true" />
              </label>
            </div>

            <div>
              <p className="guide__label">Pasos</p>
              <ol className="guide__steps">
                {ORDER.map((id, i) => {
                  const current = id === step;
                  const locked = !reachable[id] && !current;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className="guide__step"
                        aria-current={current ? "step" : undefined}
                        aria-disabled={locked || undefined}
                        onClick={() => navigate(id)}
                      >
                        <span className="guide__step-num" aria-hidden="true">
                          {locked ? <LockIcon /> : i === 0 ? <HomeIcon /> : i}
                        </span>
                        <span className="guide__step-name">{stepName(id)}</span>
                        <span className="guide__step-state">
                          {current ? "Estás aquí" : locked ? lockReason(id, reachable) : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="guide__modes">
              <p className="guide__label">Habla con el micrófono de la guía</p>
              <div className="guide__mode">
                <span className="guide__mode-icon" aria-hidden="true">
                  <CompassIcon />
                </span>
                <div>
                  <p className="guide__mode-title">Navegar</p>
                  <p className="guide__hint">Empieza la frase con «{WAKE_WORD}»:</p>
                  <ul className="guide__chips">
                    {COMMANDS.map((c) => (
                      <li key={c}>
                        «{WAKE_WORD}, {c}»
                      </li>
                    ))}
                  </ul>
                  {actions.length > 0 && (
                    <>
                      <p className="guide__hint guide__hint--gap">En este paso también puedes decir:</p>
                      <ul className="guide__chips">
                        {actions.map((a) => (
                          <li key={a.example} data-step-action>
                            «{WAKE_WORD}, {a.example}»
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
              <div className="guide__mode" data-off={!canConverse || undefined}>
                <span className="guide__mode-icon" aria-hidden="true">
                  <ChatIcon />
                </span>
                <div>
                  <p className="guide__mode-title">Conversar con el chat</p>
                  <p className="guide__hint">
                    {canConverse
                      ? "Habla normal, sin «Guía». Pulsa ■ para enviar y la respuesta se lee en voz alta."
                      : "Disponible en Conversación y Perfil."}
                  </p>
                </div>
              </div>
            </div>

            <p className="guide__foot">Guía por pasos, sin IA. Usa las voces y el reconocimiento de voz del navegador.</p>
          </section>
        )}

        <div className="guide__bar">
          <button
            type="button"
            className="guide__round guide__round--speak"
            onClick={() => (speaking ? stopAudio() : say(guidance[step]))}
            aria-label={speaking ? "Detener lectura" : "Escuchar la guía"}
            title={speaking ? "Detener lectura" : "Escuchar la guía"}
          >
            {speaking ? <Bars /> : <SpeakerIcon />}
            {enabled && <span className="guide__badge" aria-hidden="true" />}
          </button>

          <button
            type="button"
            className="guide__summary"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded(!expanded)}
          >
            <span className="guide__summary-text">
              <span className="guide__eyebrow">{eyebrow}</span>
              <span className="guide__line" data-tone={notice && !listening ? "notice" : showLock ? "locked" : undefined}>
                {showLock && <LockIcon />}
                <span className="guide__line-text">{line}</span>
              </span>
            </span>
            <ChevronIcon />
          </button>

          <button
            type="button"
            className="guide__round guide__round--mic"
            onClick={toggleMic}
            aria-pressed={listening}
            aria-label={micLabel}
            title={micLabel}
          >
            {listening ? <StopIcon /> : <MicIcon />}
          </button>

          {listeningAs === "message" && (
            <button type="button" className="guide__icon-btn guide__discard" onClick={discardMessage} aria-label="Descartar mensaje" title="Descartar">
              <CloseIcon />
            </button>
          )}

          {prev && (
            <button type="button" className="guide__nav guide__nav--back" onClick={() => navigate(prev)} aria-label={`Atrás: ${stepName(prev)}`}>
              <BackIcon />
              <span className="guide__nav-text">Atrás</span>
            </button>
          )}
          {next && (
            <button
              type="button"
              className="guide__nav guide__nav--next"
              aria-disabled={nextLocked || undefined}
              onClick={() => navigate(next)}
              aria-label={`${step === "welcome" ? "Empezar" : "Siguiente"}: ${stepName(next)}`}
            >
              <span className="guide__nav-text">{step === "welcome" ? "Empezar" : "Siguiente"}</span>
              <NextIcon />
            </button>
          )}
        </div>

        <p className="sr-only" aria-live="polite">
          {notice || (listening ? "Escuchando una orden de voz." : "")}
        </p>
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------
   Iconos (decorativos: el nombre accesible está en el botón)
   ------------------------------------------------------------------ */

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function MicIcon() {
  return (
    <Icon>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </Icon>
  );
}

function StopIcon() {
  return (
    <Icon>
      <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
    </Icon>
  );
}

function SpeakerIcon() {
  return (
    <Icon>
      <path d="M4 10v4h4l5 4V6L8 10H4z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
    </Icon>
  );
}

function CloseIcon() {
  return (
    <Icon>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}

function ChevronIcon() {
  return (
    <Icon>
      <path d="M6 15l6-6 6 6" />
    </Icon>
  );
}

function BackIcon() {
  return (
    <Icon>
      <path d="M15 6l-6 6 6 6" />
    </Icon>
  );
}

function NextIcon() {
  return (
    <Icon>
      <path d="M9 6l6 6-6 6" />
    </Icon>
  );
}

function LockIcon() {
  return (
    <Icon>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Icon>
  );
}

function HomeIcon() {
  return (
    <Icon>
      <path d="M4 11l8-7 8 7M6 10v10h12V10" />
    </Icon>
  );
}

function CompassIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
    </Icon>
  );
}

function ChatIcon() {
  return (
    <Icon>
      <path d="M5 5h14v10H9l-4 4V5z" />
    </Icon>
  );
}

/** Barras de audio animadas mientras se lee. */
function Bars() {
  return (
    <span className="guide__bars" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}
