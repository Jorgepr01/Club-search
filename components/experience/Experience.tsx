"use client";

import { MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { clubsInBranch } from "@/lib/catalog";
import { demoEngine } from "@/lib/demo/engine";
import type { AssistantTurn, DiscoveryEngine } from "@/lib/engine/types";
import type { BranchId, ChatMessage, Profile, Recommendation } from "@/lib/types";
import { ClubResults } from "./ClubResults";
import { Conversation } from "./Conversation";
import { InterestTree } from "./InterestTree";
import { ProfileEditor } from "./ProfileEditor";
import { StepNav, type Step } from "./StepNav";
import { Welcome } from "./Welcome";

// Para conectar Gemma, sustituye este motor por uno que implemente DiscoveryEngine
// llamando a rutas del servidor (ver lib/engine/types.ts y el README).
const engine: DiscoveryEngine = demoEngine;

let messageCounter = 0;
const newId = () => `m${++messageCounter}`;
const emptyProfile: Profile = {
  name: "",
  career: "",
  interests: [],
  goals: [],
  availability: null,
};

export function Experience() {
  const [step, setStep] = useState<Step>("welcome");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [turn, setTurn] = useState<AssistantTurn | null>(null);
  const [thinking, setThinking] = useState(false);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [profileConfirmed, setProfileConfirmed] = useState(false);
  const [branchId, setBranchId] = useState<BranchId | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // Al cambiar de paso, el foco va al título del nuevo paso para lectores de pantalla y teclado.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      mainRef.current?.querySelector<HTMLElement>("[data-step-heading]")?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    }, 60);
    return () => window.clearTimeout(id);
  }, [step]);

  const startConversation = () => {
    if (messages.length === 0) {
      const first = engine.start();
      setMessages([{ id: newId(), role: "assistant", text: first.text }]);
      setTurn(first);
    }
    setConversationOpen(true);
    setStep("conversation");
  };

  const send = async (text: string) => {
    const history: ChatMessage[] = [...messages, { id: newId(), role: "user", text }];
    setMessages(history);
    setThinking(true);
    setError(null);
    try {
      if (step === "conversation") {
        const [proposed, next] = await Promise.all([engine.proposeProfile(history), engine.reply(history)]);
        setMessages([...history, { id: newId(), role: "assistant", text: next.text }]);
        setProfile((current) => ({
          ...proposed,
          name: current.name || proposed.name,
          career: current.career || proposed.career,
          interests: current.interests.length ? current.interests : proposed.interests,
          goals: current.goals.length ? current.goals : proposed.goals,
          availability: current.availability ?? proposed.availability,
        }));
        setTurn(next);
        setProfileConfirmed(false);
        if (step === "conversation") setConversationOpen(false);
        setStep("profile");
        return;
      }

      const next = await engine.reply(history);
      setMessages((m) => [...m, { id: newId(), role: "assistant", text: next.text }]);
      if (next.readyForProfile) {
        const proposed = await engine.proposeProfile(history);
        setProfile((current) => ({
          ...proposed,
          name: current.name || proposed.name,
          career: current.career || proposed.career,
          interests: current.interests.length ? current.interests : proposed.interests,
          goals: current.goals.length ? current.goals : proposed.goals,
          availability: current.availability ?? proposed.availability,
        }));
        setProfileConfirmed(false);
      }
      setTurn(next);
    } catch {
      setError("No se pudo obtener la respuesta. Tu conversación sigue aquí; intenta enviar de nuevo.");
    } finally {
      setThinking(false);
    }
  };

  const loadRecommendations = useCallback(
    async (branch: BranchId, currentProfile: Profile, exclude: string[]) => {
      setError(null);
      const candidates = clubsInBranch(branch);
      // Si ya se mostraron todas, se vuelve a empezar por las más relacionadas.
      const pending = candidates.filter((c) => !exclude.includes(c.id));
      const effectiveExclude = pending.length === 0 ? [] : exclude;
      try {
        const result = await engine.recommend({
          profile: currentProfile,
          branchId: branch,
          candidates,
          exclude: effectiveExclude,
        });
        setRecommendations(result);
        setSeenIds([...effectiveExclude, ...result.map((r) => r.clubId)]);
      } catch {
        setRecommendations([]);
        setError("No se pudieron preparar las recomendaciones. Tu perfil se conserva; intenta de nuevo.");
      }
    },
    [],
  );

  const chooseBranch = (id: BranchId) => {
    setBranchId(id);
    setStep("clubs");
    void loadRecommendations(id, profile, []);
  };

  const goTo = (target: Step) => {
    if (target === "profile") setConversationOpen(false);
    setStep(target);
  };

  const reachable: Record<Step, boolean> = {
    welcome: true,
    conversation: true,
    profile: true,
    tree: profileConfirmed,
    clubs: profileConfirmed && branchId !== null,
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="app" data-step={step}>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        <header className="topbar">
          <button type="button" className="brand" onClick={() => setStep("welcome")}>
            <span className="brand__identity">
              <span className="brand__mark" aria-hidden="true" />
              Comunidad ESPOL
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element -- logo local de Kokoa */}
            <img className="brand__kokoa" src="/Kokoa.svg" alt="Kokoa" />
          </button>
          {step !== "welcome" && <StepNav current={step} reachable={reachable} onSelect={goTo} />}
          <p className="demo-tag">Demo sin IA</p>
        </header>

        <main id="contenido" ref={mainRef} className="stage">
          <motion.div
            key={step}
            className="stage__inner"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === "welcome" && <Welcome onStart={startConversation} />}
            {step === "conversation" && (
              <section className="conversation-page" aria-label="Conversación para descubrir clubes">
                <Conversation
                  messages={messages}
                  turn={turn}
                  thinking={thinking}
                  error={error}
                  onSend={send}
                  onReviewProfile={() => goTo("profile")}
                  onClose={() => {
                    setConversationOpen(false);
                    setStep("welcome");
                  }}
                  canReview={profile !== null}
                  allowReplies={false}
                />
              </section>
            )}
            {step === "profile" && (
              <div className="profile-workspace" data-conversation-open={conversationOpen}>
                {!conversationOpen && (
                  <button
                    type="button"
                    className="btn btn--ghost profile-conversation-toggle"
                    aria-expanded={false}
                    aria-controls="conversation-drawer"
                    onClick={() => setConversationOpen(true)}
                  >
                    Abrir conversación
                  </button>
                )}
                <motion.aside
                  id="conversation-drawer"
                  className="conversation-drawer"
                  data-open={conversationOpen}
                  aria-label="Conversación"
                  aria-hidden={!conversationOpen}
                  inert={!conversationOpen}
                  initial={false}
                  animate={{ opacity: conversationOpen ? 1 : 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Conversation
                    messages={messages}
                    turn={turn}
                    thinking={thinking}
                    error={error}
                    onSend={send}
                    onReviewProfile={() => setConversationOpen(false)}
                    onClose={() => setConversationOpen(false)}
                    canReview={profile !== null}
                    allowReplies
                  />
                </motion.aside>
                <ProfileEditor
                  profile={profile}
                  onChange={(p) => {
                    setProfile(p);
                    setProfileConfirmed(false);
                  }}
                  onOpenConversation={() => setConversationOpen(true)}
                  onConfirm={() => {
                    setProfileConfirmed(true);
                    setStep("tree");
                  }}
                />
              </div>
            )}
            {step === "tree" && (
              <InterestTree profile={profile} onChoose={chooseBranch} onEditProfile={() => setStep("profile")} />
            )}
            {step === "clubs" && branchId && (
              <ClubResults
                branchId={branchId}
                recommendations={recommendations}
                error={error}
                onRetry={() => void loadRecommendations(branchId, profile, [])}
                onShowOthers={() => void loadRecommendations(branchId, profile, seenIds)}
                totalInBranch={clubsInBranch(branchId).length}
                onBackToTree={() => setStep("tree")}
                onEditProfile={() => setStep("profile")}
              />
            )}
          </motion.div>
        </main>
      </div>
    </MotionConfig>
  );
}
