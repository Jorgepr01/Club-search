"use client";

import {
  ActionBarPrimitive,
  AssistantRuntimeProvider,
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
  useAuiEvent,
  useAuiState,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { AssistantTurn } from "@/lib/engine/types";
import { BrowserDictationAdapter, type DictationProblem } from "@/lib/speech/dictation";
import { SpanishSpeechAdapter } from "@/lib/speech/synthesis";
import type { ChatMessage } from "@/lib/types";

export const MAX_ANSWER_LENGTH = 500;
const ASSISTANT_NAME = "Guía de clubes";

interface ConversationProps {
  messages: ChatMessage[];
  turn: AssistantTurn | null;
  thinking: boolean;
  error: string | null;
  canReview: boolean;
  onSend: (text: string) => Promise<void>;
  onReviewProfile: () => void;
  /** En el panel del perfil se puede seguir respondiendo aunque el borrador ya esté listo. */
  allowReplies?: boolean;
  /** Si se pasa, el encabezado muestra un botón para cerrar el panel. */
  onClose?: () => void;
}

// Los mensajes siguen viviendo en Experience; assistant-ui solo los presenta.
const convertMessage = (m: ChatMessage): ThreadMessageLike => ({
  id: m.id,
  role: m.role,
  content: [{ type: "text", text: m.text }],
});

const noSubscribe = () => () => {};

/** Soporte del navegador; en el servidor siempre es false para no desajustar la hidratación. */
function useBrowserSupport(check: () => boolean) {
  return useSyncExternalStore(noSubscribe, check, () => false);
}

const DICTATION_MESSAGES: Record<DictationProblem, string> = {
  unsupported:
    "Este navegador no ofrece dictado por voz. Puedes escribir tu respuesta o probar con Chrome, Edge o Safari.",
  "not-allowed":
    "No hay permiso para usar el micrófono. Actívalo en la configuración del sitio en tu navegador o escribe tu respuesta.",
  "audio-capture": "No se encontró un micrófono disponible. Revisa que esté conectado o escribe tu respuesta.",
  network:
    "El reconocimiento de voz del navegador necesita conexión y no respondió. Intenta de nuevo o escribe tu respuesta.",
  "no-speech": "No se escuchó nada. Pulsa el micrófono y vuelve a intentarlo cuando estés listo.",
  language: "Tu navegador no ofrece reconocimiento de voz en español. Puedes escribir tu respuesta.",
  unknown: "El dictado se detuvo por un error. Lo que ya estaba en el cuadro se conserva; puedes seguir escribiendo.",
};

interface ChatUi {
  reportSpeechError: () => void;
}

const ChatUiContext = createContext<ChatUi>({ reportSpeechError: () => {} });

export function Conversation({
  messages,
  turn,
  thinking,
  error,
  canReview,
  onSend,
  onReviewProfile,
  allowReplies = false,
  onClose,
}: ConversationProps) {
  const done = (turn?.readyForProfile ?? false) && !allowReplies;
  const dictationSupported = useBrowserSupport(BrowserDictationAdapter.isSupported);
  const speechSupported = useBrowserSupport(SpanishSpeechAdapter.isSupported);
  const [speechFailed, setSpeechFailed] = useState(false);
  const [dictation] = useState(() => new BrowserDictationAdapter());
  const [speech] = useState(() => new SpanishSpeechAdapter(() => setSpeechFailed(true)));

  const suggestions = useMemo(
    () => (turn && !thinking && !done ? turn.suggestions.map((prompt) => ({ prompt })) : []),
    [turn, thinking, done],
  );

  const runtime = useExternalStoreRuntime<ChatMessage>({
    messages,
    convertMessage,
    isRunning: thinking,
    // Mientras llega la respuesta o al terminar se puede seguir escribiendo, pero no enviar.
    isSendDisabled: thinking || done,
    suggestions,
    onNew: async (message: AppendMessage) => {
      const text = message.content
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("")
        .trim()
        .slice(0, MAX_ANSWER_LENGTH);
      if (text) await onSend(text);
    },
    adapters: {
      speech: speechSupported ? speech : undefined,
      dictation: dictationSupported ? dictation : undefined,
    },
  });

  // Al salir del chat (o desmontar) se detienen el micrófono y la lectura.
  useEffect(
    () => () => {
      dictation.abort();
      speech.stop();
    },
    [dictation, speech],
  );

  useEffect(() => {
    if (done) dictation.abort();
  }, [done, dictation]);

  // Chrome carga las voces de forma diferida: pedirlas temprano evita leer con una voz en inglés.
  useEffect(() => {
    if (!speechSupported) return;
    const synth = window.speechSynthesis;
    const load = () => synth.getVoices();
    load();
    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, [speechSupported]);

  const ui = useMemo<ChatUi>(() => ({ reportSpeechError: () => setSpeechFailed(true) }), []);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatUiContext.Provider value={ui}>
        <section className="chat" aria-labelledby="chat-title">
          <header className="chat__intro">
            <h2 id="chat-title" className="chat__title" tabIndex={-1} data-step-heading>
              Cuéntanos de ti
            </h2>
            {onClose && (
              <button type="button" className="chat__close" onClick={onClose} aria-label="Cerrar conversación">
                <span aria-hidden="true">×</span>
              </button>
            )}
            <p className="chat__lede">Responde con tus palabras, con una sugerencia o dictando con el micrófono.</p>
          </header>

          <ThreadPrimitive.Root className="chat__panel">
            <div className="chat__bar">
              <span className="chat__avatar" aria-hidden="true" />
              <div className="chat__who">
                <p className="chat__name">{ASSISTANT_NAME}</p>
                <p className="chat__purpose">Tres preguntas para armar un borrador de tu perfil.</p>
              </div>
            </div>

            <ThreadPrimitive.Viewport
              className="chat__viewport"
              role="region"
              aria-label="Historial de la conversación"
              aria-busy={thinking}
              tabIndex={0}
            >
              <div className="chat__messages">
                <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
              </div>
            </ThreadPrimitive.Viewport>

            <LatestQuestionAnnouncer messages={messages} />

            <div className="chat__dock">
              {error && (
                <p className="alert chat__alert" role="alert">
                  {error}
                </p>
              )}
              {done ? (
                <DonePanel canReview={canReview} onReviewProfile={onReviewProfile} />
              ) : (
                <ChatComposer
                  dictation={dictation}
                  dictationSupported={dictationSupported}
                  speechFailed={speechFailed}
                  onDismissSpeechError={() => setSpeechFailed(false)}
                  onBeforeDictation={() => speech.stop()}
                />
              )}
            </div>
          </ThreadPrimitive.Root>
        </section>
      </ChatUiContext.Provider>
    </AssistantRuntimeProvider>
  );
}

/* ------------------------------------------------------------------
   Mensajes
   ------------------------------------------------------------------ */

function UserMessage() {
  return (
    <MessagePrimitive.Root className="msg msg--user">
      <div className="msg__bubble">
        <span className="sr-only">Tú: </span>
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="msg msg--assistant">
      <span className="msg__avatar" aria-hidden="true" />
      <div className="msg__body">
        <p className="msg__who">{ASSISTANT_NAME}</p>
        <div className="msg__bubble">
          <AuiIf condition={(s) => s.message.status?.type === "running" && s.message.content.length === 0}>
            <span className="dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="sr-only">Cargando la siguiente pregunta</span>
          </AuiIf>
          <MessagePrimitive.Parts />
        </div>
        <AuiIf condition={(s) => s.thread.capabilities.speech && s.message.content.length > 0}>
          <ActionBarPrimitive.Root className="msg__actions" hideWhenRunning autohide="never">
            <SpeakToggle />
          </ActionBarPrimitive.Root>
        </AuiIf>
      </div>
    </MessagePrimitive.Root>
  );
}

/** Un solo botón que alterna entre escuchar y detener, para no perder el foco al cambiar. */
function SpeakToggle() {
  const aui = useAui();
  const { reportSpeechError } = useContext(ChatUiContext);
  const speaking = useAuiState((s) => s.message.speech != null);

  const toggle = () => {
    try {
      if (speaking) aui.message.stopSpeaking();
      else aui.message.speak();
    } catch {
      reportSpeechError();
    }
  };

  return (
    <button type="button" className="msg__action" data-active={speaking || undefined} onClick={toggle}>
      {speaking ? <StopIcon /> : <SpeakerIcon />}
      {speaking ? "Detener lectura" : "Escuchar respuesta"}
    </button>
  );
}

/** Anuncia solo la pregunta nueva, una vez, en lugar de volver a leer todo el historial. */
function LatestQuestionAnnouncer({ messages }: { messages: ChatMessage[] }) {
  const latest = messages.findLast((m) => m.role === "assistant");
  const [initialId] = useState(latest?.id);
  const text = latest && latest.id !== initialId ? `${ASSISTANT_NAME}: ${latest.text}` : "";
  return (
    <p className="sr-only" aria-live="polite">
      {text}
    </p>
  );
}

/* ------------------------------------------------------------------
   Composer
   ------------------------------------------------------------------ */

interface ChatComposerProps {
  dictation: BrowserDictationAdapter;
  dictationSupported: boolean;
  speechFailed: boolean;
  onDismissSpeechError: () => void;
  onBeforeDictation: () => void;
}

function ChatComposer({
  dictation,
  dictationSupported,
  speechFailed,
  onDismissSpeechError,
  onBeforeDictation,
}: ChatComposerProps) {
  const aui = useAui();
  const length = useAuiState((s) => s.composer.text.length);
  const dictating = useAuiState((s) => s.composer.dictation != null);
  const sendBlocked = useAuiState((s) => s.thread.isSendDisabled);
  const snapshot = useSyncExternalStore(dictation.subscribe, dictation.getSnapshot, dictation.getSnapshot);
  const [notice, setNotice] = useState<string | null>(null);

  // El dictado puede sobrepasar el límite: se recorta y se detiene el micrófono.
  useAuiEvent("composer.textChange", ({ text, messageId }) => {
    if (messageId !== undefined || text.length <= MAX_ANSWER_LENGTH) return;
    aui.composer.setText(text.slice(0, MAX_ANSWER_LENGTH));
    if (aui.composer.getState().dictation) aui.composer.stopDictation();
    setNotice(`Llegaste al límite de ${MAX_ANSWER_LENGTH} caracteres; el dictado se detuvo.`);
  });

  const toggleDictation = () => {
    setNotice(null);
    onDismissSpeechError();
    if (!dictationSupported) {
      setNotice(DICTATION_MESSAGES.unsupported);
      return;
    }
    if (dictating) {
      aui.composer.stopDictation();
      return;
    }
    dictation.clearProblem();
    onBeforeDictation();
    try {
      aui.composer.startDictation();
    } catch {
      setNotice(DICTATION_MESSAGES.unknown);
    }
  };

  let status: string | null = null;
  if (dictating) {
    status = snapshot.listening
      ? "Escuchando… Habla con naturalidad y pulsa detener al terminar. El texto quedará en el cuadro para que lo revises antes de enviarlo."
      : "Activando el micrófono… Si el navegador lo pide, acepta el permiso.";
  } else if (snapshot.problem) {
    status = DICTATION_MESSAGES[snapshot.problem];
  } else if (notice) {
    status = notice;
  } else if (speechFailed) {
    status = "No se pudo leer la respuesta en voz alta en este navegador. El texto sigue disponible.";
  }
  const isProblem = !dictating && (snapshot.problem !== null || speechFailed || notice === DICTATION_MESSAGES.unsupported);

  return (
    <>
      <AuiIf condition={(s) => s.thread.suggestions.length > 0}>
        <div className="chat__suggestions" role="group" aria-label="Respuestas sugeridas">
          <ThreadPrimitive.Suggestions>
            {({ suggestion }) => (
              <ThreadPrimitive.Suggestion
                prompt={suggestion.prompt}
                send
                clearComposer={false}
                className="chip chip--suggest"
              >
                {suggestion.prompt}
              </ThreadPrimitive.Suggestion>
            )}
          </ThreadPrimitive.Suggestions>
        </div>
      </AuiIf>

      <div className="chat__status" role="status" data-tone={isProblem ? "problem" : dictating ? "live" : undefined}>
        {status && (
          <p className="chat__status-text">
            {dictating && <span className="chat__pulse" aria-hidden="true" />}
            {status}
          </p>
        )}
        {dictating && snapshot.interim && (
          <p className="chat__interim" aria-hidden="true">
            «{snapshot.interim}»
          </p>
        )}
      </div>

      <ComposerPrimitive.Root className="composer" data-dictating={dictating || undefined}>
        <label htmlFor="composer-input" className="sr-only">
          Tu respuesta
        </label>
        <ComposerPrimitive.Input
          id="composer-input"
          className="composer__input"
          placeholder="Escribe con tus palabras…"
          maxLength={MAX_ANSWER_LENGTH}
          minRows={1}
          maxRows={6}
          submitMode="enter"
          onKeyDown={(e) => {
            // Mientras llega la pregunta, Enter no envía ni inserta una línea por accidente.
            if (sendBlocked && e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) e.preventDefault();
          }}
          aria-describedby="composer-hint"
        />
        <div className="composer__tools">
          <button
            type="button"
            className="composer__icon"
            data-active={dictating || undefined}
            aria-disabled={!dictationSupported || undefined}
            aria-label={
              !dictationSupported
                ? "Dictar por voz (no disponible en este navegador)"
                : dictating
                  ? "Detener dictado"
                  : "Dictar por voz"
            }
            title={dictating ? "Detener dictado" : "Dictar por voz"}
            onClick={toggleDictation}
          >
            {dictating ? <StopIcon /> : <MicIcon />}
          </button>
          <ComposerPrimitive.Send className="composer__send" aria-label="Enviar respuesta" title="Enviar">
            <SendIcon />
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
      <p id="composer-hint" className="composer__hint">
        <span className="composer__keys">Enter envía · Shift + Enter agrega una línea</span>
        <span className="composer__count">
          <span aria-hidden="true">
            {length}/{MAX_ANSWER_LENGTH}
          </span>
          <span className="sr-only">Máximo {MAX_ANSWER_LENGTH} caracteres.</span>
        </span>
      </p>
    </>
  );
}

function DonePanel({ canReview, onReviewProfile }: { canReview: boolean; onReviewProfile: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);

  // El composer desaparece al terminar: el foco pasa al siguiente paso en lugar de perderse.
  useEffect(() => {
    if (!canReview) return;
    const active = document.activeElement;
    if (!active || active === document.body || active.closest(".chat")) ref.current?.focus({ preventScroll: true });
  }, [canReview]);

  return (
    <div className="chat__done">
      <div>
        <p className="chat__done-title">Tu borrador de perfil está listo</p>
        <p className="chat__done-text">
          {canReview
            ? "Revísalo y corrige lo que no encaje antes de elegir una rama."
            : "Preparando el borrador con tus respuestas…"}
        </p>
      </div>
      <button
        ref={ref}
        type="button"
        className="btn btn--primary btn--large chat__review"
        onClick={onReviewProfile}
        disabled={!canReview}
      >
        Revisar mi perfil
        <ArrowIcon />
      </button>
    </div>
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

function SendIcon() {
  return (
    <Icon>
      <path d="M12 19V5M5 12l7-7 7 7" />
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

function ArrowIcon() {
  return (
    <Icon>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  );
}
