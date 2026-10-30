"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CLUB_BY_ID, clubsInBranch } from "@/lib/catalog";
import { demoEngine } from "@/lib/demo/engine";
import type { AssistantTurn, DiscoveryEngine } from "@/lib/engine/types";
import type { BranchId, ChatMessage, Profile, Recommendation } from "@/lib/types";
import { ClubResults, type ClubResultsControls } from "./ClubResults";
import { Conversation } from "./Conversation";
import { InterestTree } from "./InterestTree";
import { ProfileEditor } from "./ProfileEditor";
import type { Step } from "./steps";
import { Welcome } from "./Welcome";
import { VoiceGuide } from "./VoiceGuide";

// Para conectar Gemma, sustituye este motor por uno que implemente DiscoveryEngine
// llamando a rutas del servidor (ver lib/engine/types.ts y el README).
const engine: DiscoveryEngine = demoEngine;

let messageCounter = 0;
const newId = () => `m${++messageCounter}`;

export function Experience() {
  const [step, setStep] = useState<Step>("welcome");
  const [conversationOpen, setConversationOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [turn, setTurn] = useState<AssistantTurn | null>(null);
  const [thinking, setThinking] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileConfirmed, setProfileConfirmed] = useState(false);
  const [branchId, setBranchId] = useState<BranchId | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const clubsRef = useRef<ClubResultsControls>(null);
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
    setStep("chat");
  };

  // Un envío a la vez y ninguno después de cerrar la conversación, aunque lleguen dos clics seguidos.
  const sendingRef = useRef(false);

  const send = async (text: string) => {
    const value = text.trim();
    // Desde el panel del perfil se puede seguir conversando aunque el borrador ya esté listo.
    if (!value || sendingRef.current || (turn?.readyForProfile && step !== "profile")) return;
    sendingRef.current = true;
    const history: ChatMessage[] = [...messages, { id: newId(), role: "user", text: value }];
    setMessages(history);
    setThinking(true);
    setError(null);
    try {
      const next = await engine.reply(history);
      setMessages((m) => [...m, { id: newId(), role: "assistant", text: next.text }]);
      setTurn(next);
      if (next.readyForProfile) {
        const proposed = await engine.proposeProfile(history);
        // Conserva lo que la persona ya escribió o editó a mano en el perfil.
        setProfile((current) => ({
          ...proposed,
          name: current?.name || proposed.name,
          career: current?.career || proposed.career,
          interests: current?.interests.length ? current.interests : proposed.interests,
          goals: current?.goals.length ? current.goals : proposed.goals,
          availability: current?.availability ?? proposed.availability,
        }));
        setProfileConfirmed(false);
      }
    } catch {
      setError("No se pudo obtener la respuesta. Tu conversación sigue aquí; intenta enviar de nuevo.");
    } finally {
      sendingRef.current = false;
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
    if (!profile) return;
    setBranchId(id);
    setStep("clubs");
    void loadRecommendations(id, profile, []);
  };

  const showProfile = () => {
    setConversationOpen(false);
    setStep("profile");
  };

  const goTo = (target: Step) => {
    if (target === "chat" && messages.length === 0) return startConversation();
    if (target === "profile") return showProfile();
    setStep(target);
  };

  const confirmProfile = () => {
    setProfileConfirmed(true);
    setStep("tree");
  };

  const shownClubIds = recommendations.map((r) => r.clubId).filter((id) => CLUB_BY_ID.has(id));

  const reachable: Record<Step, boolean> = {
    welcome: true,
    chat: true,
    profile: profile !== null,
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
            {/* eslint-disable-next-line @next/next/no-img-element -- logo local de Kokoa */}
            <img className="brand__kokoa" src="/Kokoa.svg" alt="Kokoa" />
            Comunidad ESPOL
          </button>
          <p className="demo-tag">Demo sin IA</p>
        </header>

        <main id="contenido" ref={mainRef} className="stage">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              className="stage__inner"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {step === "welcome" && <Welcome onStart={startConversation} />}
              {step === "chat" && (
                <Conversation
                  messages={messages}
                  turn={turn}
                  thinking={thinking}
                  error={error}
                  onSend={send}
                  onReviewProfile={() => showProfile()}
                  canReview={profile !== null}
                />
              )}
              {step === "profile" && profile && (
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
                  <ProfileEditor
                    profile={profile}
                    onChange={(p) => {
                      setProfile(p);
                      setProfileConfirmed(false);
                    }}
                    onOpenConversation={() => setConversationOpen(true)}
                    onConfirm={confirmProfile}
                  />
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
                      canReview
                      allowReplies
                    />
                  </motion.aside>
                </div>
              )}
              {step === "tree" && profile && (
                <InterestTree profile={profile} onChoose={chooseBranch} onEditProfile={() => showProfile()} />
              )}
              {step === "clubs" && profile && branchId && (
                <ClubResults
                  branchId={branchId}
                  recommendations={recommendations}
                  error={error}
                  onRetry={() => void loadRecommendations(branchId, profile, [])}
                  onShowOthers={() => void loadRecommendations(branchId, profile, seenIds)}
                  totalInBranch={clubsInBranch(branchId).length}
                  onBackToTree={() => setStep("tree")}
                  onEditProfile={() => showProfile()}
                  controls={clubsRef}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <VoiceGuide
          step={step}
          voice={{
            profile,
            updateProfile: (p) => {
              setProfile(p);
              setProfileConfirmed(false);
            },
            confirmProfile,
            setConversationOpen,
            chooseBranch,
            clubIds: shownClubIds,
            openClub: (id) => clubsRef.current?.open(id),
            flipClub: () => clubsRef.current?.flip(),
            canShowOthers: branchId !== null && clubsInBranch(branchId).length > shownClubIds.length,
            showOthers: () => {
              if (branchId && profile) void loadRecommendations(branchId, profile, seenIds);
            },
          }}
          reachable={reachable}
          onNavigate={goTo}
          chatMessage={messages.findLast((message) => message.role === "assistant") ?? null}
          canConverse={step === "profile" || (step === "chat" && !(turn?.readyForProfile ?? false))}
          busy={thinking}
          onSend={(text) => {
            // En el perfil, la respuesta aparece en el panel de conversación.
            if (step === "profile") setConversationOpen(true);
            void send(text);
          }}
        />
      </div>
    </MotionConfig>
  );
}
