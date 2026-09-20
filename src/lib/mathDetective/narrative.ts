/**
 * Math Detective — deterministic authored setting and narrative bank
 * (GAME-245).
 *
 * This module supplies framing only. It never owns a suspect attribute,
 * constraint predicate, answer, or outcome. The solver selects a setting by
 * seed/tier/mode, then this bank supplies original text for the case shell.
 */
import { TIERS } from "./skills";
import type {
  AuthoredText,
  CaseMode,
  CaseNarrative,
  CaseSetting,
  DifficultyTier,
  GeneratedEvidence,
  NarrativeProvenance,
  SkillId,
  Suspect,
} from "./types";

export const NARRATIVE_SETTING_FLOOR = 4;

const PROVENANCE: NarrativeProvenance = {
  source: "original-authored",
  owner: "Math Detective content bank",
  reviewed: false,
};

function authored(text: string): AuthoredText {
  return { text, provenance: PROVENANCE };
}

const ALL_SKILLS: readonly SkillId[] = [
  "measure-length",
  "time-elapsed",
  "data-tables",
  "money-receipts",
  "fractions-parts",
  "grid-coordinates",
  "expressions-codes",
  "ratio-proportion",
  "stats-summary",
  "probability-claims",
];

const ARCHIVE_FAMILIES: Readonly<Record<SkillId, string>> = {
  "measure-length": "shelf ruler",
  "time-elapsed": "archive clock",
  "data-tables": "catalog table",
  "money-receipts": "purchase receipt",
  "fractions-parts": "map fragment",
  "grid-coordinates": "archive map",
  "expressions-codes": "access code",
  "ratio-proportion": "restoration recipe",
  "stats-summary": "footfall log",
  "probability-claims": "claim card",
};

const GARDEN_FAMILIES: Readonly<Record<SkillId, string>> = {
  "measure-length": "garden ruler",
  "time-elapsed": "watering clock",
  "data-tables": "harvest table",
  "money-receipts": "seed receipt",
  "fractions-parts": "seed tray",
  "grid-coordinates": "garden grid",
  "expressions-codes": "gate code",
  "ratio-proportion": "recipe card",
  "stats-summary": "growth log",
  "probability-claims": "forecast card",
};

const MARKET_FAMILIES: Readonly<Record<SkillId, string>> = {
  "measure-length": "stall ruler",
  "time-elapsed": "market clock",
  "data-tables": "supply table",
  "money-receipts": "vendor receipt",
  "fractions-parts": "sample tray",
  "grid-coordinates": "market map",
  "expressions-codes": "badge machine",
  "ratio-proportion": "mixing card",
  "stats-summary": "sales log",
  "probability-claims": "draw card",
};

const OBSERVATORY_FAMILIES: Readonly<Record<SkillId, string>> = {
  "measure-length": "launch ruler",
  "time-elapsed": "sky clock",
  "data-tables": "signal table",
  "money-receipts": "supply receipt",
  "fractions-parts": "orbit model",
  "grid-coordinates": "star map",
  "expressions-codes": "signal code",
  "ratio-proportion": "orbit recipe",
  "stats-summary": "telescope log",
  "probability-claims": "signal claim",
};

const CASE_SETTINGS: readonly CaseSetting[] = [
  {
    id: "library-archive",
    label: "Library archive",
    description: authored("Shelves, records, and careful number trails fill the archive."),
    compatibleTiers: TIERS,
    compatibleSkills: ALL_SKILLS,
    stationFamilies: ARCHIVE_FAMILIES,
    objectFamilies: [...new Set(Object.values(ARCHIVE_FAMILIES))],
    provenance: PROVENANCE,
  },
  {
    id: "community-garden",
    label: "Community garden",
    description: authored("Plots, weather notes, and seed counts make a lively garden case."),
    compatibleTiers: TIERS,
    compatibleSkills: ALL_SKILLS,
    stationFamilies: GARDEN_FAMILIES,
    objectFamilies: [...new Set(Object.values(GARDEN_FAMILIES))],
    provenance: PROVENANCE,
  },
  {
    id: "makers-market",
    label: "Makers market",
    description: authored("Stalls, receipts, and clever displays hide a trail through the market."),
    compatibleTiers: TIERS,
    compatibleSkills: ALL_SKILLS,
    stationFamilies: MARKET_FAMILIES,
    objectFamilies: [...new Set(Object.values(MARKET_FAMILIES))],
    provenance: PROVENANCE,
  },
  {
    id: "sky-observatory",
    label: "Sky observatory",
    description: authored("Signals, star maps, and quiet observations shape the observatory case."),
    compatibleTiers: TIERS,
    compatibleSkills: ALL_SKILLS,
    stationFamilies: OBSERVATORY_FAMILIES,
    objectFamilies: [...new Set(Object.values(OBSERVATORY_FAMILIES))],
    provenance: PROVENANCE,
  },
] as const;

type AuthoredSettingId = CaseSetting["id"];

interface SettingNarrativeBank {
  briefings: readonly string[];
  suspectIntroductions: readonly string[];
  cluePhrases: readonly string[];
  chapterBeats: readonly string[];
  eliminationLines: readonly string[];
  closedVerdicts: readonly string[];
  recoveryVerdicts: readonly string[];
}

const CONTENT_BANK: Readonly<Record<AuthoredSettingId, SettingNarrativeBank>> = {
  "library-archive": {
    briefings: [
      "{count} leads share the archive. Follow each number carefully.",
      "The archive holds {count} leads. Let the records guide you.",
    ],
    suspectIntroductions: [
      "{name} filed a record and remembers the shelf.",
      "{name} knows the archive and notices small details.",
    ],
    cluePhrases: [
      "Archive note: read this {family} clue before filing it.",
      "A careful archive check begins with the {family}.",
    ],
    chapterBeats: [
      "A fresh record narrows the search.",
      "The archive trail grows clearer.",
      "One more detail belongs in the file.",
    ],
    eliminationLines: [
      "This record no longer matches the trail.",
      "The numbers move this lead away from the file.",
    ],
    closedVerdicts: [
      "The archive record now names one careful culprit.",
      "Every filed clue points to the same lead.",
    ],
    recoveryVerdicts: [
      "The file is still open. Recheck each record.",
      "One lead does not fit. The evidence can guide you back.",
    ],
  },
  "community-garden": {
    briefings: [
      "{count} leads visited the garden. Match each clue to one path.",
      "The garden has {count} leads. Check every number before deciding.",
    ],
    suspectIntroductions: [
      "{name} checked the plots and noticed the weather board.",
      "{name} knows the garden paths and counts carefully.",
    ],
    cluePhrases: [
      "Garden note: inspect the {family} beside the plots.",
      "A garden clue grows from the {family}.",
    ],
    chapterBeats: [
      "The garden path gives up another detail.",
      "A new number points across the plots.",
      "The case grows clearer one clue at a time.",
    ],
    eliminationLines: [
      "This path does not match the garden clue.",
      "The numbers turn this lead away from the plots.",
    ],
    closedVerdicts: [
      "The garden trail now points to one lead.",
      "Every plot detail supports the same culprit.",
    ],
    recoveryVerdicts: [
      "The garden case is still open. Follow the clues again.",
      "One path does not fit. The evidence can guide you back.",
    ],
  },
  "makers-market": {
    briefings: [
      "{count} leads crossed the market. Receipts reveal the missing item.",
      "The market has {count} leads. Read the numbers twice.",
    ],
    suspectIntroductions: [
      "{name} visited the stalls and remembers a receipt.",
      "{name} knows the market displays and checks each label.",
    ],
    cluePhrases: [
      "Market note: check the {family} beside the display.",
      "A market clue starts with the {family}.",
    ],
    chapterBeats: [
      "Another stall detail narrows the search.",
      "The market trail connects two numbers.",
      "One more label belongs in the case file.",
    ],
    eliminationLines: [
      "This receipt does not match the market trail.",
      "The numbers move this lead away from the stall.",
    ],
    closedVerdicts: [
      "The market trail now names one lead.",
      "Every receipt detail supports the same culprit.",
    ],
    recoveryVerdicts: [
      "The market case is still open. Read the receipts again.",
      "One stall detail does not fit. The evidence can guide you back.",
    ],
  },
  "sky-observatory": {
    briefings: [
      "{count} leads entered the observatory. Follow the signal trail.",
      "The observatory has {count} leads. Let the data point onward.",
    ],
    suspectIntroductions: [
      "{name} logged the signal and watched the sky.",
      "{name} knows the star map and records observations.",
    ],
    cluePhrases: [
      "Observatory note: inspect the {family} near the telescope.",
      "A sky clue begins with the {family}.",
    ],
    chapterBeats: [
      "A new signal narrows the search.",
      "The star trail connects another detail.",
      "One more observation belongs in the file.",
    ],
    eliminationLines: [
      "This signal does not match the sky trail.",
      "The numbers move this lead away from the telescope.",
    ],
    closedVerdicts: [
      "The signal trail now names one lead.",
      "Every observation supports the same culprit.",
    ],
    recoveryVerdicts: [
      "The observatory case is still open. Check the signals again.",
      "One observation does not fit. The evidence can guide you back.",
    ],
  },
};

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function choose<T>(
  values: readonly T[],
  seed: number,
  tier: DifficultyTier,
  mode: CaseMode,
  salt: string,
  index = 0,
): T {
  if (values.length === 0) throw new Error(`empty narrative bank: ${salt}`);
  const position = stableHash(`${seed}|${tier}|${mode}|${salt}|${index}`) % values.length;
  return values[position]!;
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? `{${key}}`);
}

export function compatibleSettingsForTier(tier: DifficultyTier): CaseSetting[] {
  return CASE_SETTINGS.filter((setting) => setting.compatibleTiers.includes(tier));
}

export function getCaseSetting(id: CaseSetting["id"]): CaseSetting {
  const setting = CASE_SETTINGS.find((candidate) => candidate.id === id);
  if (!setting) throw new Error(`unknown Math Detective setting: ${id}`);
  return setting;
}

/** Select a setting without consuming the solver RNG stream. */
export function selectCaseSetting(seed: number, tier: DifficultyTier, mode: CaseMode): CaseSetting {
  const settings = compatibleSettingsForTier(tier);
  if (settings.length < NARRATIVE_SETTING_FLOOR) {
    throw new Error(`tier ${tier} has fewer than ${NARRATIVE_SETTING_FLOOR} narrative settings`);
  }
  return settings[stableHash(`${seed}|${tier}|${mode}|setting`) % settings.length]!;
}

export interface CaseNarrativeArgs {
  seed: number;
  tier: DifficultyTier;
  mode: CaseMode;
  setting: CaseSetting;
  suspects: readonly Suspect[];
  evidences: readonly GeneratedEvidence[];
}

export function createCaseNarrative(args: CaseNarrativeArgs): CaseNarrative {
  const bank = CONTENT_BANK[args.setting.id];
  const context = { count: String(args.suspects.length), setting: args.setting.label };
  const briefing = authored(
    fill(choose(bank.briefings, args.seed, args.tier, args.mode, "briefing"), context),
  );
  const suspectIntroductions = Object.fromEntries(
    args.suspects.map((suspect, index) => [
      suspect.id,
      authored(
        fill(
          choose(bank.suspectIntroductions, args.seed, args.tier, args.mode, "suspect", index),
          { ...context, name: suspect.name },
        ),
      ),
    ]),
  ) as Record<string, AuthoredText>;
  const cluePhrases = Object.fromEntries(
    args.evidences.map((evidence, index) => [
      evidence.id,
      authored(
        fill(
          choose(bank.cluePhrases, args.seed, args.tier, args.mode, "clue", index),
          { ...context, family: args.setting.stationFamilies[evidence.skillId] },
        ),
      ),
    ]),
  ) as Record<string, AuthoredText>;
  const chapterBeats = args.evidences.map((_evidence, index) =>
    authored(
      fill(
        choose(bank.chapterBeats, args.seed, args.tier, args.mode, "chapter", index),
        { ...context, number: String(index + 1) },
      ),
    ),
  );
  const eliminationLines = Object.fromEntries(
    args.suspects.map((suspect, index) => [
      suspect.id,
      authored(
        fill(
          choose(bank.eliminationLines, args.seed, args.tier, args.mode, "elimination", index),
          { ...context, name: suspect.name },
        ),
      ),
    ]),
  ) as Record<string, AuthoredText>;

  return {
    settingId: args.setting.id,
    settingLabel: args.setting.label,
    settingDescription: args.setting.description,
    stationFamilies: { ...args.setting.stationFamilies },
    briefing,
    suspectIntroductions,
    cluePhrases,
    chapterBeats,
    eliminationLines,
    verdict: {
      closed: authored(
        choose(bank.closedVerdicts, args.seed, args.tier, args.mode, "closed"),
      ),
      recovery: authored(
        choose(bank.recoveryVerdicts, args.seed, args.tier, args.mode, "recovery"),
      ),
    },
  };
}

export function narrativeTexts(narrative: CaseNarrative): AuthoredText[] {
  return [
    narrative.settingDescription,
    narrative.briefing,
    ...Object.values(narrative.suspectIntroductions),
    ...Object.values(narrative.cluePhrases),
    ...narrative.chapterBeats,
    ...Object.values(narrative.eliminationLines),
    narrative.verdict.closed,
    narrative.verdict.recovery,
  ];
}

export function narrativeWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export interface NarrativeScanFinding {
  text: string;
  token: string;
}

const joined = (...parts: string[]) => parts.join("");
const spaced = (...parts: string[]) => parts.join(" ");
const BANNED_COPY_RULES: readonly { token: string; pattern: RegExp }[] = [
  { token: joined("hur", "ry"), pattern: new RegExp(`\\b${joined("hur", "ry")}\\b`, "i") },
  { token: spaced("you", "lost"), pattern: new RegExp(`\\b${spaced("you", "lost")}\\b`, "i") },
  { token: spaced("last", "chance"), pattern: new RegExp(`\\b${spaced("last", "chance")}\\b`, "i") },
  { token: spaced("out", "of", "time"), pattern: new RegExp(`\\b${spaced("out", "of", "time")}\\b`, "i") },
  { token: spaced("better", "than"), pattern: new RegExp(`\\b${spaced("better", "than")}\\b`, "i") },
  { token: joined("leader", "board"), pattern: new RegExp(`\\b${joined("leader", "board")}\\b`, "i") },
  { token: joined("bench", "mark"), pattern: new RegExp(`\\b${joined("bench", "mark")}\\b`, "i") },
  { token: spaced("odd", "squad"), pattern: new RegExp(`\\b${spaced("odd", "squad")}\\b`, "i") },
  { token: joined("p", "b", "s"), pattern: new RegExp(`\\b${joined("p", "b", "s")}\\b`, "i") },
  { token: `${joined("dr", ".")} ${joined("o")}`, pattern: new RegExp(`\\b${joined("dr", "\\.?")}\\s*${joined("o")}\\b`, "i") },
];

export function scanNarrativeCorpus(texts: readonly (string | AuthoredText)[]): NarrativeScanFinding[] {
  const findings: NarrativeScanFinding[] = [];
  for (const value of texts) {
    const text = typeof value === "string" ? value : value.text;
    for (const rule of BANNED_COPY_RULES) {
      if (rule.pattern.test(text)) findings.push({ text, token: rule.token });
    }
  }
  return findings;
}

export function authoredNarrativeCorpus(): AuthoredText[] {
  const texts: AuthoredText[] = CASE_SETTINGS.map((setting) => setting.description);
  for (const bank of Object.values(CONTENT_BANK)) {
    texts.push(
      ...bank.briefings.map(authored),
      ...bank.suspectIntroductions.map(authored),
      ...bank.cluePhrases.map(authored),
      ...bank.chapterBeats.map(authored),
      ...bank.eliminationLines.map(authored),
      ...bank.closedVerdicts.map(authored),
      ...bank.recoveryVerdicts.map(authored),
    );
  }
  return texts;
}

export function verifyCaseNarrative(
  narrative: CaseNarrative,
  tier: DifficultyTier,
  suspects: readonly Suspect[],
  evidences: readonly GeneratedEvidence[],
): string[] {
  const problems: string[] = [];
  const setting = CASE_SETTINGS.find((candidate) => candidate.id === narrative.settingId);
  if (!setting) return [`unknown narrative setting ${narrative.settingId}`];
  if (!setting.compatibleTiers.includes(tier)) {
    problems.push(`setting ${setting.id} is not compatible with ${tier}`);
  }
  for (const evidence of evidences) {
    if (!setting.compatibleSkills.includes(evidence.skillId)) {
      problems.push(`setting ${setting.id} does not support ${evidence.skillId}`);
    }
    if (!narrative.stationFamilies[evidence.skillId]) {
      problems.push(`setting ${setting.id} has no object family for ${evidence.skillId}`);
    }
    if (!narrative.cluePhrases[evidence.id]) {
      problems.push(`missing clue phrase for ${evidence.id}`);
    }
  }
  for (const suspect of suspects) {
    if (!narrative.suspectIntroductions[suspect.id]) {
      problems.push(`missing suspect introduction for ${suspect.id}`);
    }
    if (!narrative.eliminationLines[suspect.id]) {
      problems.push(`missing elimination line for ${suspect.id}`);
    }
  }
  if (narrative.chapterBeats.length !== evidences.length) {
    problems.push("chapter beat count does not match evidence count");
  }
  if (scanNarrativeCorpus(narrativeTexts(narrative)).length > 0) {
    problems.push("narrative contains banned copy");
  }
  if ((tier === "D1" || tier === "D2") && narrativeTexts(narrative).some((text) => narrativeWordCount(text.text) > 12)) {
    problems.push(`narrative exceeds the D1-D2 12-word sentence limit for ${tier}`);
  }
  return problems;
}

export { CASE_SETTINGS };
