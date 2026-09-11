/**
 * Voice commands, wired to the session.
 *
 * Owns the microphone and the recogniser for as long as the hook is enabled,
 * turns transcripts into commands through the engine's grammar, and reports
 * enough state for the session screen to show what is happening.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { VoiceCommandMatcher, type VoiceCommand } from '@kinetrace/engine';
import { voiceGrammar } from '@kinetrace/exercises';
import { VoiceListener, voiceCommandsSupported, type ListenerStatus } from './listener.js';
import type { WhisperVariant } from './whisperModel.js';
import type { Language } from '../i18n/index.js';

/** Whisper is given the language it should expect, not asked to guess. */
const WHISPER_LOCALE: Record<Language, string> = { es: 'spanish', en: 'english' };

export interface VoiceCommandsOptions {
  enabled: boolean;
  language: Language;
  variant?: WhisperVariant;
  onCommand: (command: VoiceCommand) => void;
}

export interface VoiceCommandsState {
  status: ListenerStatus;
  /** Model download progress, `[0, 1]`. */
  progress: number;
  /** Microphone level, `[0, 1]`. */
  level: number;
  /** The last command acted on, and when, so the screen can flash it. */
  lastCommand: VoiceCommand | null;
  lastCommandAt: number;
  error?: string;
  supported: boolean;
}

export function useVoiceCommands(options: VoiceCommandsOptions): VoiceCommandsState {
  const { enabled, language, variant, onCommand } = options;
  const [status, setStatus] = useState<ListenerStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [level, setLevel] = useState(0);
  const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null);
  const [lastCommandAt, setLastCommandAt] = useState(0);
  const [error, setError] = useState<string | undefined>();

  const commandRef = useRef(onCommand);
  commandRef.current = onCommand;
  const matcherRef = useRef<VoiceCommandMatcher | null>(null);
  // Read when the listener is created; changes afterwards go through the effect
  // below rather than tearing the recogniser down and loading the model again.
  const languageRef = useRef(language);
  languageRef.current = language;
  const listenerRef = useRef<VoiceListener | null>(null);

  const handleTranscript = useCallback((text: string, timestampMs: number) => {
    const match = matcherRef.current?.accept(text, timestampMs);
    if (!match) return;
    setLastCommand(match.command);
    setLastCommandAt(timestampMs);
    commandRef.current(match.command);
  }, []);

  // The recogniser is created once per enabled session. Language changes are
  // pushed into it rather than restarting it, which would reload the model.
  useEffect(() => {
    if (!enabled) return;
    const initial = languageRef.current;
    matcherRef.current = new VoiceCommandMatcher(voiceGrammar(initial));
    const listener = new VoiceListener({
      language: WHISPER_LOCALE[initial],
      ...(variant ? { variant } : {}),
      onStatus: (next, detail) => {
        setStatus(next);
        setError(next === 'error' ? detail : undefined);
      },
      onProgress: setProgress,
      onLevel: setLevel,
      onTranscript: handleTranscript,
    });
    listenerRef.current = listener;
    void listener.start();
    return () => {
      listener.stop();
      listenerRef.current = null;
      matcherRef.current = null;
      setStatus('idle');
      setLevel(0);
    };
  }, [enabled, variant, handleTranscript]);

  useEffect(() => {
    listenerRef.current?.setLanguage(WHISPER_LOCALE[language]);
    matcherRef.current?.setGrammar(voiceGrammar(language));
  }, [language]);

  return {
    status,
    progress,
    level,
    lastCommand,
    lastCommandAt,
    ...(error ? { error } : {}),
    supported: voiceCommandsSupported(),
  };
}
