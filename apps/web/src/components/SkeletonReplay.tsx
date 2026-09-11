/**
 * Skeleton replay.
 *
 * Plays back a stored set as a stick figure, with a scrubber and an optional
 * ghost of an earlier session behind it. This is what makes "no video" honest
 * rather than limiting: the movement is still there to review.
 */

import type { JSX } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { trackFrame, type Landmark, type SkeletonTrack } from '@kinetrace/engine';
import { db } from '../db/schema.js';
import { StickFigure } from './StickFigure.js';
import { useTranslation } from '../i18n/useTranslation.js';

export interface SkeletonReplayProps {
  setId: number;
  /** A second set drawn dimmed behind, for side by side comparison. */
  compareSetId?: number | null;
  className?: string;
}

function useTrack(setId: number | null | undefined): SkeletonTrack | null {
  const [track, setTrack] = useState<SkeletonTrack | null>(null);
  useEffect(() => {
    if (setId === null || setId === undefined) {
      setTrack(null);
      return;
    }
    void db.landmarkTracks
      .where('setId')
      .equals(setId)
      .first()
      .then((stored) => setTrack(stored ? (stored as SkeletonTrack) : null));
  }, [setId]);
  return track;
}

export function SkeletonReplay({
  setId,
  compareSetId,
  className,
}: SkeletonReplayProps): JSX.Element {
  const { t } = useTranslation();
  const track = useTrack(setId);
  const ghostTrack = useTrack(compareSetId);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const rafRef = useRef(0);

  useEffect(() => setIndex(0), [setId]);

  useEffect(() => {
    if (!track || !playing) return;
    const intervalMs = 1000 / track.fps;
    let last = performance.now();
    const step = (now: number): void => {
      if (now - last >= intervalMs) {
        last = now;
        setIndex((current) => (current + 1) % Math.max(1, track.frameCount));
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [track, playing]);

  const landmarks: Landmark[] = useMemo(
    () => (track ? trackFrame(track, Math.min(index, track.frameCount - 1)) : []),
    [track, index],
  );
  const ghost: Landmark[] | undefined = useMemo(() => {
    if (!ghostTrack || ghostTrack.frameCount === 0 || !track) return undefined;
    // Match the position in the movement rather than the frame number, so two
    // sets of different lengths line up.
    const ratio = track.frameCount > 1 ? index / (track.frameCount - 1) : 0;
    return trackFrame(ghostTrack, Math.round(ratio * (ghostTrack.frameCount - 1)));
  }, [ghostTrack, track, index]);

  if (!track) return <p className={`text-muted ${className ?? ''}`}>{t('progress.noData')}</p>;

  return (
    <div className={className}>
      <StickFigure
        landmarks={landmarks}
        ghost={ghost}
        space="world"
        className="mx-auto h-56 w-full text-ink"
      />
      <div className="mt-2 flex items-center gap-3">
        <button className="btn-secondary px-4 py-2 text-sm" onClick={() => setPlaying(!playing)}>
          {playing ? '❚❚' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0, track.frameCount - 1)}
          value={index}
          className="flex-1"
          aria-label={t('progress.replay')}
          onChange={(event) => {
            setPlaying(false);
            setIndex(Number(event.target.value));
          }}
        />
        <span className="w-16 text-right text-sm text-muted">
          {(index / track.fps).toFixed(1)} s
        </span>
      </div>
    </div>
  );
}
