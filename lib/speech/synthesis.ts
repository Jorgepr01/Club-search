import type { SpeechSynthesisAdapter } from "@assistant-ui/react";

// Lectura en voz alta con speechSynthesis del navegador, expuesta como
// SpeechSynthesisAdapter de assistant-ui. A diferencia de WebSpeechSynthesisAdapter,
// elige una voz en español (preferiblemente de Ecuador o Latinoamérica) y cancela
// cualquier lectura previa para que nunca suenen dos a la vez.
// Las voces disponibles dependen del sistema operativo y del navegador.

const LATAM = /^es-(419|ec|us|mx|co|pe|cl|ar|ve|bo|uy|py|cr|pa|do|gt|hn|ni|sv|pr|cu)$/;

function normalizedLang(voice: SpeechSynthesisVoice) {
  return voice.lang.replace("_", "-").toLowerCase();
}

export function pickSpanishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const spanish = voices.filter((v) => normalizedLang(v).startsWith("es"));
  return (
    spanish.find((v) => normalizedLang(v) === "es-ec") ??
    spanish.find((v) => LATAM.test(normalizedLang(v))) ??
    spanish.find((v) => normalizedLang(v) === "es-es") ??
    spanish[0] ??
    null
  );
}

export class SpanishSpeechAdapter implements SpeechSynthesisAdapter {
  constructor(private readonly onError?: () => void) {}

  static isSupported(): boolean {
    return (
      typeof window !== "undefined" && Boolean(window.speechSynthesis) && typeof SpeechSynthesisUtterance !== "undefined"
    );
  }

  /** Detiene cualquier lectura en curso. */
  stop() {
    if (SpanishSpeechAdapter.isSupported()) window.speechSynthesis.cancel();
  }

  speak(text: string): SpeechSynthesisAdapter.Utterance {
    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickSpanishVoice(synth.getVoices());
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang.replace("_", "-") ?? "es-EC";

    const subscribers = new Set<() => void>();
    const notify = () => subscribers.forEach((s) => s());
    const end = (reason: "finished" | "cancelled" | "error", error?: unknown) => {
      if (result.status.type === "ended") return;
      result.status = { type: "ended", reason, error };
      notify();
    };

    const result: SpeechSynthesisAdapter.Utterance = {
      status: { type: "starting" },
      cancel: () => {
        if (result.status.type === "ended") return;
        synth.cancel();
        end("cancelled");
      },
      subscribe: (callback) => {
        if (result.status.type === "ended") {
          queueMicrotask(callback);
          return () => {};
        }
        subscribers.add(callback);
        return () => {
          subscribers.delete(callback);
        };
      },
    };

    utterance.onstart = () => {
      if (result.status.type !== "starting") return;
      result.status = { type: "running" };
      notify();
    };
    utterance.onend = () => end("finished");
    utterance.onerror = (event) => {
      if (event.error === "interrupted" || event.error === "canceled") return end("cancelled");
      end("error", event.error);
      this.onError?.();
    };

    synth.speak(utterance);
    return result;
  }
}
