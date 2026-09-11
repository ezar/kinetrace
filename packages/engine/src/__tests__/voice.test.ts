import { describe, expect, it } from 'vitest';
import {
  VoiceCommandMatcher,
  matchVoiceCommand,
  normalizeTranscript,
  type VoiceGrammar,
} from '../voice/grammar.js';

/**
 * The engine holds no words, so the tests bring their own. The real Spanish and
 * English vocabulary is exercised in the exercises package, against this same
 * matcher.
 */
const grammar: VoiceGrammar = {
  pause: ['pausa', 'un momento'],
  resume: ['sigue'],
  next: ['siguiente', 'siguiente ejercicio'],
  repeat: ['repite'],
  stop: ['terminar'],
};

describe('normalizeTranscript', () => {
  it('drops accents, case and punctuation', () => {
    expect(normalizeTranscript('¡Siguiente!')).toBe('siguiente');
    expect(normalizeTranscript('  Continúa,  por favor. ')).toBe('continua por favor');
  });

  it('drops the markers a recogniser emits for silence', () => {
    expect(normalizeTranscript('[BLANK_AUDIO]')).toBe('');
    expect(normalizeTranscript(' (music) ')).toBe('');
  });
});

describe('matchVoiceCommand', () => {
  it('matches a single word', () => {
    expect(matchVoiceCommand('pausa', grammar)?.command).toBe('pause');
    expect(matchVoiceCommand('repite', grammar)?.command).toBe('repeat');
  });

  it('finds a command inside a short phrase', () => {
    expect(matchVoiceCommand('venga, siguiente ejercicio', grammar)?.command).toBe('next');
    expect(matchVoiceCommand('pausa por favor', grammar)?.command).toBe('pause');
  });

  it('matches a phrase of several words', () => {
    expect(matchVoiceCommand('un momento', grammar)?.command).toBe('pause');
  });

  it('forgives a mis-heard letter', () => {
    expect(matchVoiceCommand('siguente', grammar)?.command).toBe('next');
    expect(matchVoiceCommand('repita', grammar)?.command).toBe('repeat');
  });

  it('keeps words that differ by a letter apart when they are short', () => {
    // "sigue" and "siguiente" are four edits apart and never trade places.
    expect(matchVoiceCommand('sigue', grammar)?.command).toBe('resume');
    expect(matchVoiceCommand('siguiente', grammar)?.command).toBe('next');
  });

  it('ignores silence and anything that is not a command', () => {
    expect(matchVoiceCommand('', grammar)).toBeNull();
    expect(matchVoiceCommand('[BLANK_AUDIO]', grammar)).toBeNull();
    expect(matchVoiceCommand('me duele un poco la espalda', grammar)).toBeNull();
  });

  it('ignores a window full of conversation', () => {
    const spoken = 'siguiente vamos que ya casi acabamos con esto del todo';
    expect(matchVoiceCommand(spoken, grammar)).toBeNull();
  });

  it('only ends the session on an exact word', () => {
    expect(matchVoiceCommand('terminar', grammar)?.command).toBe('stop');
    expect(matchVoiceCommand('terminas', grammar)).toBeNull();
  });

  it('reports how sure it is', () => {
    expect(matchVoiceCommand('siguiente', grammar)?.confidence).toBe(1);
    expect(matchVoiceCommand('siguente', grammar)!.confidence).toBeLessThan(1);
  });

  it('takes the longer phrase when both fit the same words', () => {
    expect(matchVoiceCommand('siguiente ejercicio', grammar)?.phrase).toBe('siguiente ejercicio');
  });
});

describe('VoiceCommandMatcher', () => {
  it('acts once on an utterance heard by two overlapping windows', () => {
    const matcher = new VoiceCommandMatcher(grammar, { cooldownMs: 2000 });
    expect(matcher.accept('pausa', 1000)?.command).toBe('pause');
    expect(matcher.accept('pausa', 1900)).toBeNull();
    expect(matcher.accept('pausa', 3200)?.command).toBe('pause');
  });

  it('lets a different command through immediately', () => {
    const matcher = new VoiceCommandMatcher(grammar, { cooldownMs: 2000 });
    expect(matcher.accept('pausa', 1000)?.command).toBe('pause');
    expect(matcher.accept('sigue', 1200)?.command).toBe('resume');
  });

  it('forgets the last command when the grammar changes', () => {
    const matcher = new VoiceCommandMatcher(grammar, { cooldownMs: 2000 });
    expect(matcher.accept('pausa', 1000)?.command).toBe('pause');
    matcher.setGrammar({ pause: ['pause'] });
    expect(matcher.accept('pause', 1100)?.command).toBe('pause');
  });
});
