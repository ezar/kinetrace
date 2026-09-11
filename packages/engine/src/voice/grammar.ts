/**
 * Voice command grammar.
 *
 * Speech recognition gives back a short, noisy string; this turns it into one
 * of a handful of commands or into nothing at all. Like the rest of the engine
 * it holds no words of its own: the caller passes the phrases for the language
 * being spoken, so the matcher is the same in Spanish and in English.
 *
 * Two decisions worth knowing about:
 *
 *   - Recognition windows overlap, so the same utterance is seen more than
 *     once. `VoiceCommandMatcher` drops a repeat of the same command inside a
 *     cooldown; without it "pausa" would pause and immediately resume.
 *   - Ending somebody's session by mistake is the worst thing this can do, so
 *     `stop` only fires on an exact match. Every other command tolerates a
 *     mis-heard letter or two.
 */

/** What the user can ask for mid-session. */
export type VoiceCommand = 'pause' | 'resume' | 'next' | 'repeat' | 'stop';

export const VOICE_COMMANDS: readonly VoiceCommand[] = [
  'pause',
  'resume',
  'next',
  'repeat',
  'stop',
];

/** The phrases that mean each command, in one language. */
export type VoiceGrammar = Readonly<Partial<Record<VoiceCommand, readonly string[]>>>;

export interface VoiceMatch {
  command: VoiceCommand;
  /** The phrase from the grammar that matched. */
  phrase: string;
  /** 1 when every word was heard exactly; lower when letters had to be forgiven. */
  confidence: number;
}

export interface VoiceMatchOptions {
  /**
   * Longest transcript, in words, that is still considered a command. A window
   * full of conversation is not somebody talking to the app.
   */
  maxWords?: number;
  /** Confidence a phrase must reach to count as heard. */
  minConfidence?: number;
  /** Commands that only fire on an exact match. */
  strict?: readonly VoiceCommand[];
}

const DEFAULTS = {
  maxWords: 6,
  minConfidence: 0.75,
  strict: ['stop'] as readonly VoiceCommand[],
} as const;

/**
 * Lowercase, drop accents and punctuation, collapse the spaces. Whisper writes
 * "¡Siguiente!" and "siguiente" for the same word, and returns markers like
 * "[BLANK_AUDIO]" for silence, which this turns into an empty string.
 */
export function normalizeTranscript(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function words(text: string): string[] {
  const normalized = normalizeTranscript(text);
  return normalized ? normalized.split(' ') : [];
}

/** Levenshtein distance, capped so a hopeless pair stops early. */
export function editDistance(a: string, b: string, limit = Number.POSITIVE_INFINITY): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(current[j - 1]! + 1, previous[j]! + 1, previous[j - 1]! + cost);
      current.push(value);
      best = Math.min(best, value);
    }
    if (best > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length]!;
}

/** Short words get no slack: "para" and "pasa" are not the same instruction. */
function tolerance(length: number): number {
  if (length <= 3) return 0;
  if (length <= 6) return 1;
  return 2;
}

/** How well one heard word stands in for one expected word, in `[0, 1]`. */
function wordScore(heard: string, expected: string, exactOnly: boolean): number {
  if (heard === expected) return 1;
  if (exactOnly) return 0;
  const allowed = tolerance(expected.length);
  if (allowed === 0) return 0;
  const distance = editDistance(heard, expected, allowed);
  if (distance > allowed) return 0;
  return 1 - distance / expected.length;
}

/**
 * Best score for a phrase anywhere inside the transcript. A phrase of several
 * words slides across the transcript so "venga, siguiente" still says next.
 */
function phraseScore(heard: readonly string[], phrase: string, exactOnly: boolean): number {
  const expected = words(phrase);
  if (expected.length === 0 || expected.length > heard.length) return 0;
  let best = 0;
  for (let start = 0; start + expected.length <= heard.length; start += 1) {
    let total = 0;
    for (let offset = 0; offset < expected.length; offset += 1) {
      const score = wordScore(heard[start + offset]!, expected[offset]!, exactOnly);
      if (score === 0) {
        total = 0;
        break;
      }
      total += score;
    }
    if (total > 0) best = Math.max(best, total / expected.length);
  }
  return best;
}

/**
 * Match a transcript against a grammar. Returns the best command, or null when
 * nothing was close enough, which is most of the time: the microphone hears the
 * room, not just the user.
 */
export function matchVoiceCommand(
  transcript: string,
  grammar: VoiceGrammar,
  options: VoiceMatchOptions = {},
): VoiceMatch | null {
  const { maxWords, minConfidence, strict } = { ...DEFAULTS, ...options };
  const heard = words(transcript);
  if (heard.length === 0 || heard.length > maxWords) return null;

  let best: VoiceMatch | null = null;
  for (const command of VOICE_COMMANDS) {
    const exactOnly = strict.includes(command);
    for (const phrase of grammar[command] ?? []) {
      const confidence = phraseScore(heard, phrase, exactOnly);
      if (confidence < minConfidence) continue;
      // A longer phrase is the more specific reading of the same words.
      const better =
        best === null ||
        confidence > best.confidence + 1e-9 ||
        (Math.abs(confidence - best.confidence) < 1e-9 && phrase.length > best.phrase.length);
      if (better) best = { command, phrase, confidence };
    }
  }
  return best;
}

export interface VoiceMatcherOptions extends VoiceMatchOptions {
  /** Time after a command during which the same command is ignored, in ms. */
  cooldownMs?: number;
}

/**
 * Stateful wrapper over `matchVoiceCommand` that survives overlapping windows.
 */
export class VoiceCommandMatcher {
  private lastCommand: VoiceCommand | null = null;
  private lastAt = 0;

  constructor(
    private grammar: VoiceGrammar,
    private readonly options: VoiceMatcherOptions = {},
  ) {}

  setGrammar(grammar: VoiceGrammar): void {
    this.grammar = grammar;
    this.reset();
  }

  reset(): void {
    this.lastCommand = null;
    this.lastAt = 0;
  }

  /** Feed one transcript. Returns the command to act on, or null. */
  accept(transcript: string, timestampMs: number): VoiceMatch | null {
    const match = matchVoiceCommand(transcript, this.grammar, this.options);
    if (!match) return null;
    const cooldownMs = this.options.cooldownMs ?? 2500;
    if (match.command === this.lastCommand && timestampMs - this.lastAt < cooldownMs) return null;
    this.lastCommand = match.command;
    this.lastAt = timestampMs;
    return match;
  }
}
