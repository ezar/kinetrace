import { describe, expect, it } from 'vitest';
import { matchVoiceCommand, VOICE_COMMANDS, type VoiceCommand } from '@kinetrace/engine';
import { VOICE_EXAMPLES, VOICE_PHRASES, voiceGrammar } from '../voice.js';

const es = voiceGrammar('es');
const en = voiceGrammar('en');

describe('the vocabulary', () => {
  it('covers every command in both languages', () => {
    for (const command of VOICE_COMMANDS) {
      expect(VOICE_PHRASES[command].es.length).toBeGreaterThan(0);
      expect(VOICE_PHRASES[command].en.length).toBeGreaterThan(0);
      expect(VOICE_EXAMPLES[command].es).not.toBe('');
      expect(VOICE_EXAMPLES[command].en).not.toBe('');
    }
  });

  it('matches every phrase it offers to the command that owns it', () => {
    for (const language of ['es', 'en'] as const) {
      const grammar = voiceGrammar(language);
      for (const command of VOICE_COMMANDS) {
        for (const phrase of VOICE_PHRASES[command][language]) {
          const match = matchVoiceCommand(phrase, grammar);
          expect(`${language} ${phrase} -> ${match?.command ?? 'nothing'}`).toBe(
            `${language} ${phrase} -> ${command}`,
          );
        }
      }
    }
  });

  it('matches the example shown in the help line', () => {
    for (const command of VOICE_COMMANDS) {
      expect(matchVoiceCommand(VOICE_EXAMPLES[command].es, es)?.command).toBe(command);
      expect(matchVoiceCommand(VOICE_EXAMPLES[command].en, en)?.command).toBe(command);
    }
  });
});

describe('Spanish', () => {
  const cases: Array<[string, VoiceCommand | null]> = [
    ['pausa', 'pause'],
    ['¡Pausa!', 'pause'],
    ['espera', 'pause'],
    ['sigue', 'resume'],
    ['venga, seguimos', 'resume'],
    ['siguiente', 'next'],
    ['siguiente ejercicio', 'next'],
    ['repite', 'repeat'],
    ['otra vez', 'repeat'],
    ['terminar', 'stop'],
    // Things said in a room where somebody is exercising.
    ['uno, dos, tres', null],
    ['me duele un poco', null],
    ['esto es para la espalda', null],
    ['para arriba', null],
    ['no puedo más con esto', null],
    ['[BLANK_AUDIO]', null],
  ];

  it.each(cases)('hears %s as %s', (spoken, expected) => {
    expect(matchVoiceCommand(spoken, es)?.command ?? null).toBe(expected);
  });
});

describe('English', () => {
  const cases: Array<[string, VoiceCommand | null]> = [
    ['Pause.', 'pause'],
    ['hold on', 'pause'],
    ['continue', 'resume'],
    ['keep going', 'resume'],
    ['next', 'next'],
    ['ok, next exercise', 'next'],
    ['repeat', 'repeat'],
    ['say that again', 'repeat'],
    ['stop', 'stop'],
    ['one, two, three', null],
    ['my back hurts a bit', null],
    ['[BLANK_AUDIO]', null],
  ];

  it.each(cases)('hears %s as %s', (spoken, expected) => {
    expect(matchVoiceCommand(spoken, en)?.command ?? null).toBe(expected);
  });
});
