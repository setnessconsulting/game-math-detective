import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  initialEngineState,
  summarizeCase,
  type Effect,
} from "@/lib/mathDetective/engine";
import {
  createMathDetectiveHostAdapter,
  createPhaserRuntime,
  worldCanvasSize,
  type HostAdapter,
} from "@/lib/mathDetective/phaser";
import { generateCase, TIERS } from "@/lib/mathDetective/solver";
import { initialTier } from "@/lib/mathDetective/adaptivity";
import { projectScene } from "@/lib/mathDetective/scene";
import type { LayoutMode, SceneIntent, SceneModel } from "@/lib/mathDetective/scene";
import type {
  CaseMode,
  DifficultyTier,
  GeneratedEvidence,
  PresentationPayload,
} from "@/lib/mathDetective/types";
import { TIER_META } from "@/lib/mathDetective/skills";

const SESSION_ID = "md-game-245-preview";
const AUTO_TIER = initialTier(null);

type RankSelection = "auto" | DifficultyTier;

type LocalIntent =
  | { t: "continue" }
  | { t: "enterStation"; evidenceId: string }
  | { t: "inspectEvidence"; evidenceId: string }
  | { t: "openChallenge"; evidenceId: string }
  | { t: "closeChallenge" }
  | { t: "openDeduction" }
  | { t: "chooseSuspect"; suspectId: string }
  | { t: "linkEvidence"; suspectId: string; constraintId: string }
  | { t: "requestHint"; evidenceId: string; level: 1 | 2 | 3 | 4 }
  | { t: "submitAnswer"; evidenceId: string; value: number }
  | { t: "accuse"; suspectId: string; linkedCount: number }
  | { t: "presentationComplete"; token: string };

type FeedbackEffect = Extract<Effect, { kind: "feedback" }>;

function initialScene(): SceneModel {
  return projectScene(initialEngineState(), {
    sessionId: SESSION_ID,
    generation: 1,
  });
}

function readableTag(tag: string): string {
  return tag.replaceAll("-", " ");
}

function clockLabel(hour: number, minute: number): string {
  return `${hour}:${String(minute).padStart(2, "0")}`;
}

function renderPresentation(presentation: PresentationPayload): ReactNode {
  switch (presentation.kind) {
    case "ruler":
      {
        const rulerMax = Math.max(100, Math.ceil(presentation.shelfTopCm / 50) * 50);
        const rulerTicks = Array.from({ length: rulerMax / 10 + 1 }, (_, index) => index * 10);
        return (
          <div className="md-object md-ruler-object" role="img" aria-label={`Ruler marked at ${presentation.shelfTopCm} centimeters`}>
            <div className="md-ruler-track">
              <span className="md-ruler-marker" style={{ left: `${(presentation.shelfTopCm / rulerMax) * 100}%` }} />
              {rulerTicks.map((tick) => (
                <span className="md-ruler-tick" key={tick}>{tick}</span>
              ))}
            </div>
            <strong>{presentation.shelfTopCm} cm mark</strong>
          </div>
        );
      }
    case "clockPair":
      return (
        <div className="md-object md-clock-pair" role="group" aria-label="Two clocks showing the start and end times">
          <div className="md-clock-card"><span>{presentation.startLabel}</span><strong>{clockLabel(presentation.startH, presentation.startM)}</strong></div>
          <span className="md-arrow" aria-hidden="true">→</span>
          <div className="md-clock-card"><span>{presentation.endLabel}</span><strong>{clockLabel(presentation.endH, presentation.endM)}</strong></div>
        </div>
      );
    case "dataTable":
      return (
        <div className="md-object md-table-wrap">
          <table aria-label={presentation.title}>
            <caption>{presentation.title}</caption>
            <thead><tr><th scope="col">Name</th><th scope="col">{presentation.unitNoun}</th></tr></thead>
            <tbody>{presentation.rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.value ?? "?"}</td></tr>)}</tbody>
            <tfoot><tr><th scope="row">Total</th><td>{presentation.total}</td></tr></tfoot>
          </table>
        </div>
      );
    case "receipt":
      return (
        <div className="md-object md-table-wrap">
          <table aria-label={`${presentation.place} receipt`}>
            <caption>{presentation.place} receipt</caption>
            <thead><tr><th scope="col">Item</th><th scope="col">Each</th><th scope="col">Qty</th><th scope="col">Line</th></tr></thead>
            <tbody>{presentation.lines.map((line) => <tr key={line.label}><th scope="row">{line.label}</th><td>{line.unitCents}¢</td><td>{line.qty}</td><td>{line.unitCents * line.qty}¢</td></tr>)}</tbody>
          </table>
        </div>
      );
    case "fractionBar":
      return (
        <div className="md-object md-fraction-object" role="img" aria-label={`${presentation.label}; ${presentation.totalSlices} total slices`}>
          <div className="md-slice-grid">{Array.from({ length: presentation.totalSlices }, (_, index) => <span className={index < (presentation.totalSlices * presentation.eatenN) / presentation.eatenD ? "md-slice md-slice-eaten" : "md-slice"} key={index} />)}</div>
          <strong>{presentation.label}</strong>
        </div>
      );
    case "gridMap":
      return (
        <div className="md-object md-grid-object" role="img" aria-label={`${presentation.rows} by ${presentation.cols} map; the witness points to row ${presentation.markedRow}, column ${presentation.markedCol}`}>
          <div className="md-grid-map" style={{ gridTemplateColumns: `repeat(${presentation.cols}, minmax(2.2rem, 1fr))` }}>
            {Array.from({ length: presentation.rows * presentation.cols }, (_, index) => {
              const row = Math.floor(index / presentation.cols) + 1;
              const col = (index % presentation.cols) + 1;
              const marked = row === presentation.markedRow && col === presentation.markedCol;
              return <span className={marked ? "md-grid-cell md-grid-cell-marked" : "md-grid-cell"} key={`${row}-${col}`}>{marked ? "★" : `${row}${col}`}</span>;
            })}
          </div>
          <strong>{presentation.witnessText}</strong>
        </div>
      );
    case "expressionCode":
      return <div className="md-object md-code-object" role="img" aria-label={`Badge code ${presentation.a} ${presentation.firstOp} ${presentation.b} ${presentation.secondOp} ${presentation.c}`}><span>{presentation.label}</span><strong>{presentation.a} {presentation.firstOp} {presentation.b} {presentation.secondOp} {presentation.c} = ?</strong></div>;
    case "tileEquation":
      return <div className="md-object md-code-object" role="group" aria-label={`Build an equation that equals ${presentation.target}`}><span>Badge code target</span><strong>{presentation.target}</strong><div className="md-tile-row" role="group" aria-label="Available equation tiles">{presentation.tiles.map((tile, index) => <span className="md-tile" key={`${tile}-${index}`}>{tile}</span>)}</div></div>;
    case "statList":
      return <div className="md-object md-stat-object" role="group" aria-label={`Readings in ${presentation.unit}`}><span>Step readings</span><div className="md-stat-list">{presentation.readings.map((reading, index) => <span key={`${reading}-${index}`}>{reading}</span>)}</div></div>;
    case "recipeScale":
      return <div className="md-object md-code-object" role="group" aria-label="Recipe scaling problem"><span>{presentation.ingredient}</span><strong>{presentation.amountPerBase} {presentation.unit} for {presentation.baseServings} servings</strong><p>How much for {presentation.targetServings} servings?</p></div>;
    case "claimCard":
      return <div className="md-object md-claim-object" role="group" aria-label="Probability claim"><span>Witness claim</span><strong>{presentation.claim}</strong><p>{presentation.flips} flips means count every possible outcome.</p></div>;
  }
}

function stationLabel(station: SceneModel["stations"][number] | undefined): string {
  return station?.objectFamily ?? (station ? station.skillId.replaceAll("-", " ") : "Evidence station");
}

function detectLayoutMode(width: number): LayoutMode {
  if (width < 620) return "phonePortrait";
  if (width < 960) return "tablet";
  return "desktop";
}

export default function MathDetective() {
  const [caseMode, setCaseMode] = useState<CaseMode>("mini");
  const [rankSelection, setRankSelection] = useState<RankSelection>("auto");
  const [caseSeed, setCaseSeed] = useState(42);
  const selectedTier = rankSelection === "auto" ? AUTO_TIER : rankSelection;
  const run = useMemo(() => generateCase({ seed: caseSeed, tier: selectedTier, mode: caseMode }), [caseMode, caseSeed, selectedTier]);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() =>
    detectLayoutMode(typeof window === "undefined" ? 1200 : window.innerWidth),
  );
  const [scene, setScene] = useState<SceneModel>(initialScene);
  const [hostReady, setHostReady] = useState(false);
  const [answer, setAnswer] = useState("");
  const [selectedSuspect, setSelectedSuspect] = useState<string | null>(null);
  const [stationReady, setStationReady] = useState(false);
  const [accusationCandidate, setAccusationCandidate] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackEffect | null>(null);
  const [hintPanel, setHintPanel] = useState<{ itemId: string; level: number; text: string } | null>(null);
  const [pendingHintLevel, setPendingHintLevel] = useState<3 | 4 | null>(null);
  const [hintDismissed, setHintDismissed] = useState<Record<string, boolean>>({});
  const [reducedMotion, setReducedMotion] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [notice, setNotice] = useState("Preparing the case file…");
  const hostRef = useRef<HostAdapter | null>(null);
  const phaserParentRef = useRef<HTMLDivElement>(null);
  const answerInputRef = useRef<HTMLInputElement>(null);
  const beginRef = useRef<HTMLButtonElement>(null);
  const revealRef = useRef<HTMLButtonElement>(null);
  const soundEnabledRef = useRef(soundEnabled);
  const presentationRef = useRef({ layoutMode, reducedMotion, captionsEnabled });

  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  useEffect(() => {
    const nextPresentation = { layoutMode, reducedMotion, captionsEnabled };
    presentationRef.current = nextPresentation;
    hostRef.current?.setPresentationOptions(nextPresentation);
  }, [captionsEnabled, layoutMode, reducedMotion]);

  useEffect(() => {
    const handleResize = () => setLayoutMode(detectLayoutMode(window.innerWidth));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const parent = phaserParentRef.current;
    if (!parent) return;
    let disposed = false;
    setHostReady(false);
    setStationReady(false);
    setSelectedSuspect(null);
    setAccusationCandidate(null);
    setFeedback(null);
    setHintPanel(null);
    setPendingHintLevel(null);
    setNotice("Preparing the case file…");

    const presentation = presentationRef.current;
    const canvasSize = worldCanvasSize(presentation.layoutMode);
    createPhaserRuntime({ ...canvasSize, backgroundColor: "#081522" })
      .then((runtime) => {
        if (disposed) { runtime.destroy(); return; }
        const host = createMathDetectiveHostAdapter({
          sessionId: SESSION_ID,
          runtime,
          parent,
          onScene: setScene,
          onEffects: (effects) => effects.forEach((effect) => {
            if (effect.kind === "feedback") setFeedback(effect);
            if (effect.kind === "announce") setNotice(effect.text);
            if (effect.kind === "cue" && soundEnabledRef.current) setNotice(`Sound cue: ${effect.name}`);
          }),
          layoutMode: presentation.layoutMode,
          reducedMotion: presentation.reducedMotion,
          captionsEnabled: presentation.captionsEnabled,
        });
        hostRef.current = host;
        setHostReady(true);
        host.startCase(run);
      })
      .catch((error: unknown) => setNotice(error instanceof Error ? `The case file could not open: ${error.message}` : "The case file could not open."));

    return () => {
      disposed = true;
      hostRef.current?.destroy();
      hostRef.current = null;
      setHostReady(false);
    };
  }, [run]);

  const currentEvidence: GeneratedEvidence | undefined = run.evidences.find((evidence) => evidence.id === scene.clue.evidenceId);
  const currentStation = scene.stations.find((station) => station.evidenceId === scene.clue.evidenceId);
  const linkedCountFor = (suspectId: string | null) => suspectId ? Object.keys(scene.deduction.links).filter((key) => key.startsWith(`${suspectId}|`)).length : 0;
  const selectedLinks = linkedCountFor(selectedSuspect);
  const autoHintOffer = Boolean(currentEvidence && scene.casePhase === "evidence" && !scene.clue.solved && scene.clue.attempts >= 2 && scene.clue.hintsUsed.length === 0 && !hintDismissed[currentEvidence.id]);

  const handleIntent = (intent: LocalIntent): boolean => {
    const host = hostRef.current;
    if (!host || !scene.caseId) return false;
    const result = host.handleIntent({ ...intent, sessionId: SESSION_ID, generation: host.generation, caseId: scene.caseId } as SceneIntent);
    if (!result.accepted) { setNotice(result.reason ?? "That action is not available yet."); return false; }
    if (intent.t === "continue") {
      setAnswer(""); setFeedback(null); setHintPanel(null); setPendingHintLevel(null); setAccusationCandidate(null);
      if (scene.casePhase === "briefing" || scene.casePhase === "evidence") setStationReady(false);
    }
    if (intent.t === "openChallenge") { setFeedback(null); setHintPanel(null); setPendingHintLevel(null); setAnswer(""); }
    if (intent.t === "presentationComplete") setStationReady(false);
    return true;
  };

  const showHint = (level: 1 | 2 | 3 | 4) => {
    if (!currentEvidence) return;
    if (level === 3 || level === 4) { setPendingHintLevel(level); return; }
    if (handleIntent({ t: "requestHint", evidenceId: currentEvidence.id, level })) setHintPanel({ itemId: currentEvidence.id, level, text: currentEvidence.hints[`l${level}` as "l1" | "l2" | "l3" | "l4"] });
  };

  const confirmHint = () => {
    if (!currentEvidence || pendingHintLevel === null) return;
    const level = pendingHintLevel;
    if (handleIntent({ t: "requestHint", evidenceId: currentEvidence.id, level })) {
      setHintPanel({ itemId: currentEvidence.id, level, text: currentEvidence.hints[`l${level}` as "l1" | "l2" | "l3" | "l4"] });
      setPendingHintLevel(null);
    }
  };

  useEffect(() => {
    if (scene.casePhase === "evidence" && scene.overlay === "challenge") answerInputRef.current?.focus();
    else if (scene.overlay === "result") revealRef.current?.focus();
    else if (scene.casePhase === "briefing" && hostReady) beginRef.current?.focus();
  }, [scene.casePhase, scene.overlay, scene.clue.evidenceId, hostReady]);

  useEffect(() => {
    if (scene.casePhase !== "board") setAccusationCandidate(null);
    if (scene.casePhase === "board" && !selectedSuspect) setSelectedSuspect(scene.suspects.find((suspect) => suspect.status === "alive")?.id ?? null);
  }, [scene.casePhase, scene.suspects, selectedSuspect]);

  const submitAnswer = () => {
    if (!currentEvidence || answer.trim() === "") { setNotice("Enter a number before checking the evidence."); return; }
    const value = Number(answer);
    if (!Number.isFinite(value)) { setNotice("Enter a number before checking the evidence."); return; }
    handleIntent({ t: "submitAnswer", evidenceId: currentEvidence.id, value });
  };

  const renderBriefing = () => (
    <section aria-labelledby="briefing-title" className="md-flow-section">
      <div className="md-section-kicker">{scene.narrative?.settingLabel ?? "Case file opened"}</div><h2 id="briefing-title">Briefing</h2>
      <p className="md-goal-copy">{scene.narrative?.briefing.text ?? scene.intro ?? run.intro}</p>
      <p className="md-muted">{scene.narrative?.settingDescription.text}</p>
      <div className="md-lineup" role="group" aria-label="Suspect lineup">{scene.suspects.map((suspect) => <article className="md-suspect-mini" key={suspect.id}><span className="md-avatar" aria-hidden="true">{suspect.icon}</span><strong>{suspect.name}</strong><span>{scene.narrative?.suspectIntroductions[suspect.id]?.text ?? "Possible suspect"}</span></article>)}</div>
      <p className="md-muted">Follow the evidence. Every clue changes the case file.</p>
      <div className="md-mode-picker" role="group" aria-label="Case length">
        <button type="button" aria-pressed={caseMode === "mini"} onClick={() => setCaseMode("mini")}>Quick case <small>≈ 2 min · {caseMode === "mini" ? "selected" : ""}</small></button>
        <button type="button" aria-pressed={caseMode === "full"} onClick={() => setCaseMode("full")}>Full case <small>more clues · {caseMode === "full" ? "selected" : ""}</small></button>
      </div>
      <div className="md-rank-picker" role="group" aria-label="Detective rank">
        <button type="button" aria-pressed={rankSelection === "auto"} onClick={() => setRankSelection("auto")}>
          Auto rank <small>{TIER_META[AUTO_TIER].rank} · suggested</small>
        </button>
        {TIERS.map((tier) => (
          <button type="button" key={tier} aria-pressed={rankSelection === tier} onClick={() => setRankSelection(tier)}>
            {TIER_META[tier].rank} <small>{tier} · {rankSelection === tier ? "selected" : ""}</small>
          </button>
        ))}
      </div>
      <div className="md-actions"><button type="button" aria-label="Begin case" data-testid="begin-case" ref={beginRef} onClick={() => handleIntent({ t: "continue" })} disabled={!hostReady}>Start investigating</button></div>
    </section>
  );

  const renderHintArea = () => {
    if (!currentEvidence || scene.clue.solved) return null;
    const used = new Set(scene.clue.hintsUsed);
    return (
      <div className="md-hint-area">
        {autoHintOffer ? <aside className="md-hint-offer" aria-labelledby="hint-offer-title"><strong id="hint-offer-title">Want a detective hint?</strong><p>Two tries showed us where to look next. A hint is always okay.</p><div className="md-actions"><button type="button" onClick={() => showHint(1)}>Show Level 1</button><button type="button" className="md-button-quiet" onClick={() => setHintDismissed((old) => ({ ...old, [currentEvidence.id]: true }))}>Not yet</button></div></aside> : null}
        <div className="md-hint-controls" role="group" aria-label="Hint ladder"><strong>Detective notebook</strong><div className="md-hint-buttons">{[1, 2, 3, 4].map((level) => <button type="button" key={level} disabled={used.has(level)} onClick={() => showHint(level as 1 | 2 | 3 | 4)}>L{level}{level >= 3 ? " · reveal" : ""}</button>)}</div>
          {hintPanel?.itemId === currentEvidence.id ? <div className="md-hint-note" role="status"><strong>Level {hintPanel.level}</strong><p data-testid="hint-text">{hintPanel.text}</p></div> : null}
          {pendingHintLevel !== null ? <div className="md-consent-note" role="dialog" aria-labelledby="hint-consent-title"><strong id="hint-consent-title">Show the step-by-step reveal?</strong><p>This hint makes the answer easier and caps this clue's points.</p><div className="md-actions"><button type="button" onClick={confirmHint}>Show Level {pendingHintLevel}</button><button type="button" className="md-button-quiet" onClick={() => setPendingHintLevel(null)}>Keep thinking</button></div></div> : null}
        </div>
      </div>
    );
  };

  const renderEvidence = () => {
    if (!currentEvidence || !currentStation) return null;
    if (scene.overlay === "result" && scene.clue.solved) return <section className="md-result-overlay" role="dialog" aria-labelledby="reveal-title"><span className="md-result-glyph" aria-hidden="true">✓</span><div><div className="md-section-kicker">Evidence result</div><h2 id="reveal-title">Clue ready to reveal</h2><p>{feedback?.correct ? feedback.text : `Clue earned: ${currentEvidence.constraint.sentence}`}</p><button type="button" ref={revealRef} data-testid="reveal-clue" onClick={() => handleIntent({ t: "presentationComplete", token: `clue-${currentEvidence.id}` })}>Add clue to case file</button></div></section>;
    if (scene.clue.solved) {
      const last = (currentStation?.index ?? 0) + 1 >= scene.stations.length;
      return <section aria-labelledby="earned-title" className="md-earned-card"><span className="md-result-glyph" aria-hidden="true">★</span><div><div className="md-section-kicker">Case file updated</div><h2 id="earned-title">Clue added</h2><p><strong>{currentEvidence.constraint.chip}</strong></p><p className="md-muted">{currentEvidence.constraint.sentence}</p><button type="button" data-testid="next-station" onClick={() => handleIntent({ t: "continue" })}>{last ? "Open deduction board" : "Find next evidence"}</button></div></section>;
    }
    if (!stationReady) return <section aria-labelledby="station-select-title" className="md-station-select"><div className="md-section-kicker">{scene.world.setting.label}</div><h2 id="station-select-title">Evidence station</h2><p className="md-goal-copy">Choose the glowing station, inspect it, then open its math challenge.</p><div className="md-station-card md-station-card-active"><span className="md-station-icon" aria-hidden="true">⌕</span><div><strong>{stationLabel(currentStation)}</strong><span>{currentEvidence.goal}</span></div><button type="button" data-testid="inspect-station" onClick={() => { if (handleIntent({ t: "enterStation", evidenceId: currentEvidence.id })) setStationReady(true); }}>Inspect station</button></div><div className="md-progress-strip" role="group" aria-label={`Evidence progress ${(currentStation?.index ?? 0) + 1} of ${scene.stations.length}`}>{scene.stations.map((station) => <span className={station.status === "completed" ? "md-progress-dot md-progress-dot-done" : station.status === "active" ? "md-progress-dot md-progress-dot-current" : "md-progress-dot"} key={station.evidenceId} />)}</div></section>;
    return <section aria-labelledby="evidence-title" className="md-challenge-section"><div className="md-section-kicker">{stationLabel(currentStation)}</div><h2 id="evidence-title">{currentEvidence.goal}</h2><p className="md-muted">{scene.narrative?.cluePhrases[currentEvidence.id]?.text}</p><div className="md-presentation-frame">{renderPresentation(currentEvidence.presentation)}</div>{scene.overlay === "challenge" ? <div className="md-challenge-card"><div className="md-answer-row"><label htmlFor="answer-input">Your answer ({currentEvidence.answer.unit})</label><input id="answer-input" aria-label="Numeric answer" data-testid="answer-input" inputMode="decimal" ref={answerInputRef} type="number" step="any" value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitAnswer(); }} /><button type="button" data-testid="submit-answer" onClick={submitAnswer}>Check evidence</button></div>{feedback?.itemId === currentEvidence.id && !feedback.correct ? <div className="md-feedback md-feedback-warn" role="status"><strong>Check the evidence · {readableTag(feedback.misconceptionTag)}</strong><p>{feedback.text}</p></div> : null}{renderHintArea()}<button type="button" className="md-button-quiet md-close-button" onClick={() => handleIntent({ t: "closeChallenge" })}>Back to station</button></div> : <div className="md-open-challenge"><p>Use the evidence object, then solve the semantic challenge.</p><button type="button" data-testid="open-challenge" onClick={() => handleIntent({ t: "openChallenge", evidenceId: currentEvidence.id })}>Open math challenge</button></div>}</section>;
  };

  const renderCheckpoint = () => {
    const possibleSuspects = scene.suspects.filter((suspect) => suspect.status === "alive").length;
    const chapterBeat = scene.narrative?.chapterBeats[Math.max(0, scene.world.chapter.current - 1)]?.text;
    return <section aria-labelledby="checkpoint-title" className="md-flow-section"><div className="md-section-kicker">Chapter complete</div><h2 id="checkpoint-title">Who could still be our culprit?</h2><p className="md-goal-copy">{chapterBeat ? `${chapterBeat} ${possibleSuspects} possible suspects remain.` : `Your earned clues have narrowed the case to ${possibleSuspects} possible suspects.`}</p><div className="md-lineup">{scene.suspects.map((suspect) => <div className={`md-suspect-mini md-suspect-${suspect.status}`} key={suspect.id}><span className="md-avatar" aria-hidden="true">{suspect.icon}</span><strong>{suspect.name}</strong><span>{suspect.status === "alive" ? "Still possible" : "Ruled out"}</span></div>)}</div><button type="button" onClick={() => handleIntent({ t: "continue" })}>Continue investigation</button></section>;
  };

  const renderBoard = () => <section aria-labelledby="board-title" className="md-board-section"><div className="md-section-kicker">All clues collected</div><h2 id="board-title">Deduction board</h2><p className="md-goal-copy">Link clues to the suspect they support. Then choose who still fits.</p><div className="md-chip-strip" role="group" aria-label="Earned evidence">{scene.deduction.chips.map((chip) => <span className="md-chip" key={chip.id}>{`✓ ${chip.chip}`}</span>)}</div><div className="md-board-grid" role="list" aria-label="Suspect deduction cards">{scene.suspects.map((suspect) => { const chosen = selectedSuspect === suspect.id; const suspectLinks = linkedCountFor(suspect.id); return <article className={`md-board-card ${chosen ? "md-board-card-selected" : ""} md-suspect-${suspect.status}`} data-testid="suspect-card" data-status={suspect.status} data-suspect-id={suspect.id} key={suspect.id} role="listitem"><button type="button" className="md-suspect-choice" aria-pressed={chosen} onClick={() => { setSelectedSuspect(suspect.id); handleIntent({ t: "chooseSuspect", suspectId: suspect.id }); }}><span className="md-avatar" aria-hidden="true">{suspect.icon}</span><span><strong>{suspect.name}</strong><small>{suspect.status === "eliminated" ? "Ruled out" : suspect.status === "culpritRevealed" ? "Culprit" : "Possible suspect"}</small></span></button><div className="md-link-list">{scene.deduction.chips.map((chip) => { const key = `${suspect.id}|${chip.id}`; const linked = Boolean(scene.deduction.links[key]); return <button type="button" key={key} aria-pressed={linked} className={linked ? "md-link-button md-link-button-on" : "md-link-button"} onClick={() => handleIntent({ t: "linkEvidence", suspectId: suspect.id, constraintId: chip.id })}>{linked ? "✕ Linked" : "Link"} {chip.chip}</button>; })}</div><small className="md-card-foot">{suspectLinks} clue link{suspectLinks === 1 ? "" : "s"}</small></article>; })}</div><div className="md-accusation-bar"><span>{selectedSuspect ? `${scene.suspects.find((suspect) => suspect.id === selectedSuspect)?.name} selected` : "Choose a suspect"}</span><small>{selectedLinks} of {scene.deduction.minLinksRequired || 0} required links</small><button type="button" data-testid="accuse" disabled={!selectedSuspect || selectedLinks < scene.deduction.minLinksRequired} onClick={() => { if (selectedSuspect && handleIntent({ t: "openDeduction" })) setAccusationCandidate(selectedSuspect); }}>Review accusation</button></div>{accusationCandidate ? <div className="md-confirm-sheet" role="dialog" aria-labelledby="accusation-title"><div className="md-section-kicker">One last check</div><h3 id="accusation-title">Name {scene.suspects.find((suspect) => suspect.id === accusationCandidate)?.name}?</h3><p>Because:</p><ul className="md-because-list">{scene.deduction.chips.filter((chip) => Boolean(scene.deduction.links[`${accusationCandidate}|${chip.id}`])).map((chip) => <li key={chip.id}>{chip.sentence}</li>)}</ul><div className="md-actions"><button type="button" onClick={() => { handleIntent({ t: "accuse", suspectId: accusationCandidate, linkedCount: linkedCountFor(accusationCandidate) }); handleIntent({ t: "closeChallenge" }); }}>Confirm accusation</button><button type="button" className="md-button-quiet" onClick={() => { setAccusationCandidate(null); handleIntent({ t: "closeChallenge" }); }}>Keep looking</button></div></div> : null}</section>;

  const renderVerdict = () => {
    const lastAccusation = hostRef.current?.getState().accusations.at(-1);
    const closed = scene.outcome === "closed";
    if (scene.casePhase === "guided") return <section aria-labelledby="guided-title" className="md-verdict-card md-verdict-guided"><span className="md-result-glyph" aria-hidden="true">↺</span><div><div className="md-section-kicker">Guided recovery</div><h2 id="guided-title">Let’s follow the evidence</h2><p>{scene.narrative?.verdict.recovery.text ?? "We can review the clue links together. The case stays open, and there is no penalty for trying again."}</p><button type="button" onClick={() => handleIntent({ t: "continue" })}>Finish guided case</button></div></section>;
    return <section aria-labelledby="verdict-title" className={`md-verdict-card ${closed ? "md-verdict-closed" : "md-verdict-wrong"}`}><span className="md-result-glyph" aria-hidden="true">{closed ? "★" : "↺"}</span><div><div className="md-section-kicker">Verdict</div><h2 id="verdict-title">{closed ? "Case closed" : "Check the evidence again"}</h2><p>{closed ? scene.narrative?.verdict.closed.text : scene.narrative?.verdict.recovery.text}</p>{!closed && lastAccusation?.contradictedBy.length ? <div className="md-contradiction"><strong>Contradicting clue</strong>{lastAccusation.contradictedBy.map((id) => <p key={id}>{scene.deduction.chips.find((chip) => chip.id === id)?.sentence}</p>)}</div> : null}<button type="button" onClick={() => handleIntent({ t: "continue" })}>{closed ? "Open case summary" : "Follow the evidence again"}</button></div></section>;
  };

  const renderSummary = () => {
    const summary = hostRef.current ? summarizeCase(hostRef.current.getState()) : null;
    return <section aria-labelledby="summary-title" className="md-summary-card"><div className="md-section-kicker">Case file complete</div><h2 id="summary-title">A sharp investigation</h2><p className="md-independence"><strong>{summary?.independenceScore ?? 0}%</strong><span>independence score</span></p><p>{summary?.coaching}</p><div className="md-summary-grid"><div><strong>{summary?.evidenceSolved ?? 0}/{summary?.evidenceTotal ?? 0}</strong><span>evidence solved</span></div><div><strong>{summary?.totalPoints ?? 0}</strong><span>points earned</span></div><div><strong>{summary?.hintsTotal ?? 0}</strong><span>hints used</span></div></div><div className="md-chip-strip">{summary?.skills.map((skill) => <span className="md-chip" key={skill}>{skill}</span>)}</div><p className="md-muted">{summary?.parentSentence} Nothing was saved.</p><button type="button" onClick={() => { setCaseSeed((seed) => seed + 1); setNotice("A fresh case file is ready."); }}>Play another case</button></section>;
  };

  const renderPhase = () => {
    if (scene.casePhase === "briefing") return renderBriefing();
    if (scene.casePhase === "evidence") return renderEvidence();
    if (scene.casePhase === "checkpoint") return renderCheckpoint();
    if (scene.casePhase === "board") return renderBoard();
    if (scene.casePhase === "verdict" || scene.casePhase === "guided") return renderVerdict();
    return renderSummary();
  };

  return <main className={`md-shell ${reducedMotion ? "md-reduced-motion" : ""}`} data-captions={captionsEnabled ? "on" : "off"}><header className="md-header"><div className="md-header-topline"><p className="md-eyebrow">MATH DETECTIVE · CASE DESK</p><div className="md-settings" role="group" aria-label="Presentation settings"><button type="button" aria-pressed={reducedMotion} onClick={() => setReducedMotion((value) => !value)}>{reducedMotion ? "Motion: reduced" : "Motion: full"}</button><button type="button" aria-pressed={captionsEnabled} onClick={() => setCaptionsEnabled((value) => !value)}>{captionsEnabled ? "Captions: on" : "Captions: off"}</button><button type="button" aria-pressed={soundEnabled} onClick={() => setSoundEnabled((value) => !value)}>{soundEnabled ? "Sound: on" : "Sound: off"}</button></div></div><h1>Math Detective</h1><p className="md-lede">{run.title}. Follow the clues, solve the math, and crack the case.</p></header><div className="md-case-layout"><section className="md-panel md-case-panel" aria-labelledby="case-title"><div className="md-case-bar"><span className="md-phase" data-testid="game-phase">{scene.casePhase}</span><span className="md-tier-badge">{TIER_META[run.tier].rank} · {caseMode === "mini" ? "Quick Case" : "Full Case"}</span></div><h2 id="case-title">{run.title}</h2>{renderPhase()}<p className="md-notice" role="status" aria-live="polite">{captionsEnabled ? notice : ""}</p></section><aside className="md-panel md-world-panel" aria-labelledby="phaser-title"><div className="md-world-heading"><div><div className="md-section-kicker">Live presentation</div><h2 id="phaser-title">Investigation map</h2></div><span className="md-live-dot" role="img" aria-label="Phaser live" /></div><p className="md-muted">The world surface shows the case state. Math controls and clues stay readable in HTML.</p><div ref={phaserParentRef} className="md-phaser" data-testid="phaser-surface" /><div className="md-world-legend" role="group" aria-label="Map legend"><span><i className="md-legend-dot md-legend-current" />current</span><span><i className="md-legend-dot md-legend-done" />earned</span><span><i className="md-legend-dot md-legend-open" />not opened</span></div></aside></div></main>;
}
