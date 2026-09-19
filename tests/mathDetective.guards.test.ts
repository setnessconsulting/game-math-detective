import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Math Detective guards (MD-14): privacy, IP separation, and banned-copy
// gates. Mirrors the repo's assessment storage-guard approach (file scan).

const ROOT = process.cwd();
const SCANNED_DIRS = [
  join(ROOT, "src", "lib", "mathDetective"),
  join(ROOT, "src", "lib", "games", "shared"),
  join(ROOT, "src", "app", "games"),
];

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Privacy: session-only, cookieless, network-free
// ---------------------------------------------------------------------------

describe("mathDetective privacy guard", () => {
  it("game source contains no storage or network APIs", () => {
    const libFiles = listFiles(join(ROOT, "src", "lib", "mathDetective"));
    const sharedFiles = listFiles(join(ROOT, "src", "lib", "games", "shared"));
    const uiFiles = listFiles(join(ROOT, "src", "app", "games")).filter((f) =>
      /MathDetective\.tsx$/.test(f),
    );
    const files = [...libFiles, ...sharedFiles, ...uiFiles];
    expect(files.length).toBeGreaterThan(5);
    const violations: string[] = [];
    for (const file of files) {
      const contents = readFileSync(file, "utf8");
      for (const pattern of [
        /localStorage/,
        /sessionStorage/,
        /indexedDB/,
        /document\.cookie/,
        /\bfetch\s*\(/,
      ]) {
        if (pattern.test(contents)) violations.push(`${file}: matched ${pattern}`);
      }
    }
    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// IP separation: no benchmark-game identity tokens anywhere in game source
// ---------------------------------------------------------------------------

describe("mathDetective IP separation guard", () => {
  it("contains no Odd Squad / PBS identity tokens", () => {
    const banned = [
      /odd\s*squad/i,
      /\bDr\.?\s*O\b/,
      /\bMs\.?\s*O\b/,
      /\bOlympia\b/i,
      /\bOtis\b/i,
      /\bOlive\b/i,
      /\bOtto\b/i,
      /\bPBS\b/,
      /\bPrecinct\s*13579\b/i,
    ];
    const violations: string[] = [];
    for (const dir of SCANNED_DIRS) {
      for (const file of listFiles(dir)) {
        if (!/MathDetective|mathDetective/.test(file)) continue;
        const contents = readFileSync(file, "utf8");
        for (const pattern of banned) {
          if (pattern.test(contents)) violations.push(`${file}: matched ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Banned copy: loss framing, urgency, child-vs-child comparison
// ---------------------------------------------------------------------------

describe("mathDetective copy policy guard", () => {
  it("never uses loss framing, urgency pressure, or comparison language", () => {
    const banned = [
      /you lost/i,
      /\bhurry[!., ]/i,
      /last chance/i,
      /out of time/i,
      /better than other/i,
      /beat everyone/i,
      /leaderboard/i,
      /time'?s up/i,
    ];
    const violations: string[] = [];
    for (const file of listFiles(join(ROOT, "src", "lib", "mathDetective"))) {
      const contents = readFileSync(file, "utf8");
      for (const pattern of banned) {
        if (pattern.test(contents)) violations.push(`${file}: matched ${pattern}`);
      }
    }
    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Negative tests: the guards must FAIL when a violation is seeded (MD-14)
// ---------------------------------------------------------------------------

describe("guard negative tests (seeded violations are caught)", () => {
  const IP_PATTERNS = [
    /odd\s*squad/i,
    /\bDr\.?\s*O\b/,
    /\bPBS\b/,
    /\bPrecinct\s*13579\b/i,
  ];
  const COPY_PATTERNS = [
    /you lost/i,
    /\bhurry[!., ]/i,
    /last chance/i,
    /out of time/i,
    /leaderboard/i,
  ];
  const PRIVACY_PATTERNS = [/localStorage/, /sessionStorage/, /indexedDB/, /document\.cookie/, /\bfetch\s*\(/];

  it("IP scanner flags benchmark identity tokens", () => {
    const seeded = [
      "Let's watch Odd Squad to see how agents do it!",
      "Ask Dr. O for help.",
      "Visit the PBS game page",
      "Report to Precinct 13579",
    ];
    for (const text of seeded) {
      const hits = IP_PATTERNS.filter((p) => p.test(text));
      expect(hits.length, `should flag: ${text}`).toBeGreaterThanOrEqual(1);
    }
    // Clean, original copy passes the same scanner.
    expect(IP_PATTERNS.every((p) => !p.test("The Math Detective Agency needs you. Suspect: Miles."))).toBe(true);
  });

  it("copy scanner flags loss/urgency/comparison language", () => {
    const seeded = [
      "You lost the case.",
      "Hurry! Time's up!",
      "This is your last chance!",
      "You are out of time.",
      "Check the leaderboard to beat everyone.",
    ];
    for (const text of seeded) {
      const hits = COPY_PATTERNS.filter((p) => p.test(text));
      expect(hits.length, `should flag: ${text}`).toBeGreaterThanOrEqual(1);
    }
    expect(COPY_PATTERNS.every((p) => !p.test("Take your time. Real detectives follow the evidence."))).toBe(true);
  });

  it("privacy scanner flags storage and network APIs", () => {
    const seeded = [
      "const best = localStorage.getItem('md-best');",
      "sessionStorage.setItem('md', '1');",
      "indexedDB.open('md');",
      "document.cookie = 'x=1';",
      "await fetch('/api/telemetry', { method: 'POST' });",
    ];
    for (const text of seeded) {
      const hits = PRIVACY_PATTERNS.filter((p) => p.test(text));
      expect(hits.length, `should flag: ${text}`).toBeGreaterThanOrEqual(1);
    }
    expect(PRIVACY_PATTERNS.every((p) => !p.test("const store = new Map(); // session memory only"))).toBe(true);
  });
});


