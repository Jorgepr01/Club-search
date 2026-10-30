import type { DictationAdapter } from "@assistant-ui/react";

// Dictado con el reconocimiento de voz del navegador (Web Speech API), expuesto como
// DictationAdapter de assistant-ui. Se implementa aquí en lugar de usar
// WebSpeechDictationAdapter porque necesitamos:
// - español con respaldo (es-EC → es-419 → es-ES) si el navegador no admite el primero;
// - el motivo de cada error (permiso, micrófono, red…) para explicarlo en la interfaz;
// - que el composer reciba solo frases finales: el texto provisional se muestra aparte,
//   así el estudiante puede seguir escribiendo sin que se dupliquen transcripciones parciales.
// En Chrome y Edge el audio se envía a un servicio del navegador; no es procesamiento local.

const LANGUAGES = ["es-EC", "es-419", "es-ES"] as const;
const STOP_TIMEOUT_MS = 4000;

export type DictationProblem =
  | "unsupported"
  | "not-allowed"
  | "audio-capture"
  | "network"
  | "no-speech"
  | "language"
  | "unknown";

export interface DictationSnapshot {
  listening: boolean;
  /** Texto provisional que aún puede cambiar; nunca se escribe en el composer. */
  interim: string;
  problem: DictationProblem | null;
}

interface RecognitionAlternative {
  transcript: string;
}

interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: RecognitionAlternative | undefined;
}

interface RecognitionResultEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [index: number]: RecognitionResult | undefined };
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

function problemFrom(error: string): DictationProblem {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "not-allowed";
    case "audio-capture":
      return "audio-capture";
    case "network":
      return "network";
    case "no-speech":
      return "no-speech";
    case "language-not-supported":
      return "language";
    default:
      return "unknown";
  }
}

type Listener<T> = (value: T) => void;

export class BrowserDictationAdapter implements DictationAdapter {
  // El estudiante puede seguir escribiendo mientras dicta.
  disableInputDuringDictation = false;

  private snapshot: DictationSnapshot = { listening: false, interim: "", problem: null };
  private readonly listeners = new Set<() => void>();
  private cancelActive: (() => void) | null = null;

  static isSupported(): boolean {
    return recognitionConstructor() !== undefined;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  clearProblem() {
    if (this.snapshot.problem) this.update({ problem: null });
  }

  /** Detiene cualquier sesión en curso sin conservar lo que aún no era definitivo. */
  abort() {
    this.cancelActive?.();
  }

  private update(patch: Partial<DictationSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }

  listen(): DictationAdapter.Session {
    const speechListeners = new Set<Listener<DictationAdapter.Result>>();
    const startListeners = new Set<() => void>();
    const endListeners = new Set<Listener<DictationAdapter.Result>>();
    const on =
      <T>(set: Set<T>) =>
      (callback: T) => {
        set.add(callback);
        return () => {
          set.delete(callback);
        };
      };

    let recognition: Recognition | null = null;
    let languageIndex = 0;
    let retryLanguage = false;
    let problem: DictationProblem | null = null;
    let settled = false;
    let stopping = false;
    let transcript = "";

    const session: DictationAdapter.Session = {
      status: { type: "starting" },
      stop: () => {
        if (settled) return Promise.resolve();
        stopping = true;
        recognition?.stop();
        return new Promise<void>((resolve) => {
          const deadline = Date.now() + STOP_TIMEOUT_MS;
          const check = () => {
            if (settled) return resolve();
            if (Date.now() >= deadline) {
              recognition?.abort();
              finish("cancelled");
              return resolve();
            }
            window.setTimeout(check, 50);
          };
          check();
        });
      },
      cancel: () => {
        stopping = true;
        recognition?.abort();
        finish("cancelled");
      },
      onSpeechStart: on(startListeners),
      onSpeechEnd: on(endListeners),
      onSpeech: on(speechListeners),
    };

    const finish = (reason: "stopped" | "cancelled" | "error") => {
      if (settled) return;
      settled = true;
      session.status = { type: "ended", reason };
      if (this.cancelActive === session.cancel) this.cancelActive = null;
      this.update({ listening: false, interim: "", problem });
      endListeners.forEach((l) => l({ transcript }));
    };

    const begin = (Constructor: RecognitionConstructor) => {
      const rec = new Constructor();
      recognition = rec;
      rec.lang = LANGUAGES[languageIndex];
      rec.continuous = true;
      rec.interimResults = true;
      let nextFinal = 0;

      rec.onstart = () => {
        if (settled) return;
        session.status = { type: "running" };
        this.update({ listening: true, problem: null });
      };
      rec.onspeechstart = () => startListeners.forEach((l) => l());
      rec.onresult = (event) => {
        if (settled) return;
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result) continue;
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) {
            if (i < nextFinal) continue;
            nextFinal = i + 1;
            const phrase = text.trim();
            if (!phrase) continue;
            transcript = transcript ? `${transcript} ${phrase}` : phrase;
            speechListeners.forEach((l) => l({ transcript: phrase, isFinal: true }));
          } else {
            interim += text;
          }
        }
        this.update({ interim: interim.trim() });
      };
      rec.onerror = (event) => {
        if (event.error === "aborted") return;
        if (event.error === "language-not-supported" && languageIndex < LANGUAGES.length - 1) {
          retryLanguage = true;
          return;
        }
        problem = problemFrom(event.error);
      };
      rec.onend = () => {
        if (retryLanguage && !stopping && !settled) {
          retryLanguage = false;
          languageIndex += 1;
          begin(Constructor);
          return;
        }
        finish(problem ? "error" : "stopped");
      };

      try {
        rec.start();
      } catch {
        problem = "unknown";
        finish("error");
      }
    };

    const Constructor = recognitionConstructor();
    this.update({ problem: null, interim: "" });
    if (!Constructor) {
      problem = "unsupported";
      finish("error");
      return session;
    }
    this.cancelActive = session.cancel;
    begin(Constructor);
    return session;
  }
}
