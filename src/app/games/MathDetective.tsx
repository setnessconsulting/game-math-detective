import { useEffect, useMemo, useRef, useState } from "react";
import {
  initialEngineState,
  summarizeCase,
  type EngineAction,
} from "@/lib/mathDetective/engine";
import {
  createMathDetectiveHostAdapter,
  createPhaserRuntime,
  type HostAdapter,
} from "@/lib/mathDetective/phaser";
import { generateCase } from "@/lib/mathDetective/solver";
import { projectScene } from "@/lib/mathDetective/scene";
import type { SceneIntent, SceneModel } from "@/lib/mathDetective/scene";

const SESSION_ID = "md-game-298-foundation";

type FoundationIntent =
  | { t: "continue" }
  | { t: "chooseSuspect"; suspectId: string }
  | { t: "accuse"; suspectId: string; linkedCount: number };

function initialScene(): SceneModel {
  return projectScene(initialEngineState(), {
    sessionId: SESSION_ID,
    generation: 1,
  });
}

export default function MathDetective() {
  const run = useMemo(
    () => generateCase({ seed: 42, tier: "D3", mode: "mini" }),
    [],
  );
  const [scene, setScene] = useState<SceneModel>(initialScene);
  const [hostReady, setHostReady] = useState(false);
  const [answer, setAnswer] = useState("");
  const [selectedSuspect, setSelectedSuspect] = useState<string | null>(null);
  const [notice, setNotice] = useState("Starting the standalone foundation…");
  const hostRef = useRef<HostAdapter | null>(null);
  const phaserParentRef = useRef<HTMLDivElement>(null);
  const answerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const parent = phaserParentRef.current;
    if (!parent) return;
    let disposed = false;

    createPhaserRuntime({
      width: 640,
      height: 280,
      backgroundColor: "#0a1220",
    })
      .then((runtime) => {
        if (disposed) {
          runtime.destroy();
          return;
        }
        const host = createMathDetectiveHostAdapter({
          sessionId: SESSION_ID,
          runtime,
          parent,
          onScene: setScene,
          onEffects: (effects) => {
            for (const effect of effects) {
              if (effect.kind === "announce") setNotice(effect.text);
              if (effect.kind === "cue") setNotice("Sound cue: " + effect.name);
            }
          },
        });
        hostRef.current = host;
        setHostReady(true);
        host.startCase(run);
      })
      .catch((error: unknown) => {
        setNotice(
          error instanceof Error
            ? "Phaser foundation could not start: " + error.message
            : "Phaser foundation could not start.",
        );
      });

    return () => {
      disposed = true;
      hostRef.current?.destroy();
      hostRef.current = null;
      setHostReady(false);
    };
  }, [run]);

  const handleIntent = (
    intent: FoundationIntent,
  ) => {
    const host = hostRef.current;
    if (!host || !scene.caseId) return;
    const result = host.handleIntent({
      ...intent,
      sessionId: SESSION_ID,
      generation: host.generation,
      caseId: scene.caseId,
    } as SceneIntent);
    if (!result.accepted) setNotice(result.reason ?? "Intent was not accepted.");
  };

  const dispatch = (action: EngineAction) => {
    const host = hostRef.current;
    if (!host) return;
    host.dispatchEngine(action);
    setAnswer("");
  };

  const currentAnswer = Number(answer);
  const currentHintLevel =
    scene.clue.hintsUsed.length === 0
      ? 1
      : Math.min(4, Math.max(...scene.clue.hintsUsed) + 1);
  const linkedCount = Object.keys(scene.deduction.links).length;

  useEffect(() => {
    if (scene.casePhase === "evidence" && !scene.clue.solved) {
      answerInputRef.current?.focus();
    }
  }, [scene.casePhase, scene.clue.evidenceId, scene.clue.solved]);

  const renderPhase = () => {
    if (scene.casePhase === "briefing") {
      return (
        <section aria-labelledby="briefing-title">
          <h2 id="briefing-title">Briefing</h2>
          <p>{run.intro}</p>
          <p className="md-muted">
            This small foundation case proves the deterministic engine, semantic
            overlay boundary, and Phaser presentation path.
          </p>
          <div className="md-actions">
            <button
              type="button"
              data-testid="begin-case"
              onClick={() => handleIntent({ t: "continue" })}
              disabled={!hostReady}
            >
              Begin case
            </button>
          </div>
        </section>
      );
    }

    if (scene.casePhase === "evidence") {
      return (
        <section aria-labelledby="evidence-title">
          <h2 id="evidence-title">Evidence station</h2>
          <p>
            <strong>{scene.clue.goal}</strong>
          </p>
          <p className="md-muted">
            Station {scene.clue.evidenceId ?? "—"} · {scene.clue.presentation?.kind ?? "loading"} ·
            attempts {scene.clue.attempts}
          </p>
          {!scene.clue.solved ? (
            <div className="md-answer">
              <label>
                Numeric answer
                <input
                  aria-label="Numeric answer"
                  data-testid="answer-input"
                  inputMode="numeric"
                  ref={answerInputRef}
                  type="number"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                />
              </label>
              <button
                type="button"
                data-testid="submit-answer"
                onClick={() => {
                  if (!Number.isFinite(currentAnswer)) {
                    setNotice("Enter a number before submitting.");
                    return;
                  }
                  if (scene.clue.evidenceId) {
                    dispatch({
                      t: "SUBMIT_ANSWER",
                      itemId: scene.clue.evidenceId,
                      value: currentAnswer,
                    });
                  }
                }}
              >
                Check answer
              </button>
              <button
                type="button"
                onClick={() => {
                  if (scene.clue.evidenceId) {
                    dispatch({
                      t: "REQUEST_HINT",
                      itemId: scene.clue.evidenceId,
                      level: currentHintLevel as 1 | 2 | 3 | 4,
                    });
                  }
                }}
                disabled={currentHintLevel > 4}
              >
                Hint {currentHintLevel}
              </button>
            </div>
          ) : (
            <div className="md-actions">
              <p>
                <strong>Clue earned.</strong> The authoritative engine updated
                the live suspect field.
              </p>
              <button
                type="button"
                data-testid="next-station"
                onClick={() => handleIntent({ t: "continue" })}
              >
                Continue
              </button>
            </div>
          )}
        </section>
      );
    }

    if (scene.casePhase === "checkpoint") {
      return (
        <section aria-labelledby="checkpoint-title">
          <h2 id="checkpoint-title">Checkpoint</h2>
          <p>
            The engine currently has {scene.suspects.filter((s) => s.status === "alive").length}{" "}
            possible suspects.
          </p>
          <button type="button" onClick={() => handleIntent({ t: "continue" })}>
            Continue to the next clue
          </button>
        </section>
      );
    }

    if (scene.casePhase === "board") {
      return (
        <section aria-labelledby="board-title">
          <h2 id="board-title">Deduction board</h2>
          <p>
            Select a suspect, then link earned clues. The links are intents; the
            engine still decides whether an accusation is correct.
          </p>
          <div className="md-suspects" role="list" aria-label="Suspects">
            {scene.suspects.map((suspect) => (
              <div
                className="md-card"
                data-status={suspect.status}
                key={suspect.id}
                role="listitem"
              >
                <button
                  type="button"
                  aria-pressed={selectedSuspect === suspect.id}
                  onClick={() => {
                    setSelectedSuspect(suspect.id);
                    handleIntent({ t: "chooseSuspect", suspectId: suspect.id });
                  }}
                >
                  {suspect.icon} {suspect.name}
                </button>
                <small>Status: {suspect.status}</small>
                {scene.deduction.chips.length > 0 ? (
                  <div className="md-links">
                    {scene.deduction.chips.map((chip) => {
                      const key = suspect.id + "|" + chip.id;
                      const linked = Boolean(scene.deduction.links[key]);
                      return (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={linked}
                          onClick={() =>
                            dispatch({
                              t: "TOGGLE_LINK",
                              suspectId: suspect.id,
                              constraintId: chip.id,
                            })
                          }
                        >
                          {linked ? "Unlink" : "Link"} {chip.chip}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <p className="md-muted">
            {linkedCount} clue link{linkedCount === 1 ? "" : "s"} selected
            {scene.deduction.minLinksRequired > 0
              ? " · " + scene.deduction.minLinksRequired + " required at this tier"
              : ""}
            .
          </p>
          <button
            type="button"
            data-testid="accuse"
            disabled={!selectedSuspect}
            onClick={() => {
              if (selectedSuspect) {
                handleIntent({
                  t: "accuse",
                  suspectId: selectedSuspect,
                  linkedCount,
                });
              }
            }}
          >
            Name this suspect
          </button>
        </section>
      );
    }

    if (scene.casePhase === "verdict") {
      const closed = scene.outcome === "closed";
      return (
        <section aria-labelledby="verdict-title">
          <h2 id="verdict-title">{closed ? "Case closed" : "Check the evidence again"}</h2>
          <p>
            {closed
              ? "The authoritative case state confirms the accusation."
              : "That accusation did not fit every earned constraint. The case remains recoverable."}
          </p>
          <button type="button" onClick={() => handleIntent({ t: "continue" })}>
            {closed ? "Open summary" : "Return to deduction board"}
          </button>
        </section>
      );
    }

    if (scene.casePhase === "guided") {
      return (
        <section aria-labelledby="guided-title">
          <h2 id="guided-title">Guided recovery</h2>
          <p>The engine has kept the learning path open after repeated wrong accusations.</p>
          <button type="button" onClick={() => handleIntent({ t: "continue" })}>
            Finish guided case
          </button>
        </section>
      );
    }

    const summary = hostRef.current ? summarizeCase(hostRef.current.getState()) : null;
    return (
      <section aria-labelledby="summary-title">
        <h2 id="summary-title">Case summary</h2>
        <ul className="md-list">
          <li>Evidence solved: {summary?.evidenceSolved ?? 0}</li>
          <li>Points: {summary?.totalPoints ?? 0}</li>
          <li>Independent work: {summary?.independenceScore ?? 0}%</li>
        </ul>
      </section>
    );
  };

  return (
    <main className="md-shell">
      <header className="md-header">
        <p className="md-eyebrow">GAME-298 · standalone foundation</p>
        <h1>Math Detective</h1>
        <p className="md-lede">
          {run.title}. This bootstrap keeps the TypeScript case engine
          authoritative while React and Phaser act as presentation consumers.
        </p>
      </header>

      <div className="md-layout">
        <section className="md-panel" aria-labelledby="case-title">
          <span className="md-phase" data-testid="game-phase">
            {scene.casePhase}
          </span>
          <h2 id="case-title">{run.title}</h2>
          {renderPhase()}
          <p className="md-notice" role="status" aria-live="polite">
            {notice}
          </p>
        </section>

        <aside className="md-panel" aria-labelledby="phaser-title">
          <h2 id="phaser-title">Phaser presentation surface</h2>
          <p className="md-muted">
            Real Phaser 4 rendering is intentionally small here. The scene
            receives projected state and cannot solve the case.
          </p>
          <div ref={phaserParentRef} className="md-phaser" data-testid="phaser-surface" />
        </aside>
      </div>
    </main>
  );
}
