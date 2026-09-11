/**
 * What the microphone is doing, from across the room.
 *
 * Deliberately almost nothing: while everything works it is one dot that
 * breathes with the room's loudness, so the user can tell Kinetrace is
 * listening without anything competing with the repetition count. It only
 * becomes words when it has something to say — a download in progress, or a
 * command just heard.
 *
 * The reason it cannot listen belongs in the help line at the bottom of the
 * session, next to the gestures, not up here beside the exercise name.
 */

import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import type { VoiceCommand } from '@kinetrace/engine';
import type { ListenerStatus } from '../speech/listener.js';
import { useTranslation } from '../i18n/useTranslation.js';
import { MicIcon, MicOffIcon } from './icons.js';

/** How long the word just heard stays on screen. */
const HEARD_VISIBLE_MS = 2200;

export interface VoiceIndicatorProps {
  status: ListenerStatus;
  /** Model download progress, `[0, 1]`. */
  progress: number;
  /** Microphone level, `[0, 1]`. */
  level: number;
  lastCommand: VoiceCommand | null;
  lastCommandAt: number;
}

export function VoiceIndicator({
  status,
  progress,
  level,
  lastCommand,
  lastCommandAt,
}: VoiceIndicatorProps): JSX.Element | null {
  const { t } = useTranslation();
  const [heard, setHeard] = useState<VoiceCommand | null>(null);

  useEffect(() => {
    if (!lastCommand) return;
    setHeard(lastCommand);
    const timer = window.setTimeout(() => setHeard(null), HEARD_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [lastCommand, lastCommandAt]);

  if (status === 'idle') return null;

  if (status === 'denied' || status === 'unsupported' || status === 'error') {
    return (
      <span className="text-far-dim" role="img" aria-label={t(`voice.${status}`)}>
        <MicOffIcon size={16} />
      </span>
    );
  }

  if (status === 'loading') {
    return (
      <p className="flex items-center gap-1.5 text-[13px] text-far-muted">
        <MicIcon size={15} />
        {t('voice.loading', { percent: Math.round(progress * 100) })}
      </p>
    );
  }

  return (
    <p
      className="flex items-center gap-2 text-[13px] text-far-muted"
      aria-live="polite"
      aria-label={t('voice.listening')}
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        {/* The ring is the room's loudness, so a hoarse "pausa" is visibly heard. */}
        <span
          className="absolute rounded-full bg-far-accent/25 transition-[width,height] duration-100"
          style={{ width: `${8 + level * 16}px`, height: `${8 + level * 16}px` }}
        />
        <span className="relative h-2 w-2 rounded-full bg-far-accent" />
      </span>
      {heard ? t('voice.heard', { word: t(`voice.command.${heard}`) }) : null}
    </p>
  );
}
