/**
 * Math Detective — optional read-aloud support (benchmark gap G1).
 *
 * Read-aloud is an enhancement, never a requirement (UX §9): captions are
 * always on screen. The toggle persists for the session only; when the
 * device has no speech synthesis the button is omitted entirely (never a
 * dead button). No network voices are requested — local voices only.
 */

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string): void {
  if (!speechSupported() || !text) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  } catch {
    // speech is optional everywhere
  }
}

export function stopSpeaking(): void {
  if (!speechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // optional
  }
}
