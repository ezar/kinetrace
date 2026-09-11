/**
 * Camera access.
 *
 * Frames are drawn to a canvas for the preview and handed to the pose model;
 * they are never recorded. Stopping the session stops every track, so the
 * camera indicator goes out.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraFacing = 'user' | 'environment';

export interface CameraState {
  status: 'idle' | 'starting' | 'ready' | 'error';
  error?: string;
  /** Which camera is actually in use. */
  facing: CameraFacing;
}

export interface UseCamera extends CameraState {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  start: (facing?: CameraFacing) => Promise<void>;
  stop: () => void;
  flip: () => Promise<void>;
}

export function useCamera(initialFacing: CameraFacing = 'user'): UseCamera {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>({ status: 'idle', facing: initialFacing });

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState((previous) => ({ ...previous, status: 'idle' }));
  }, []);

  const start = useCallback(
    async (facing?: CameraFacing) => {
      const wanted = facing ?? state.facing;
      setState({ status: 'starting', facing: wanted });
      try {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: wanted,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.playsInline = true;
          video.muted = true;
          await video.play();
        }
        setState({ status: 'ready', facing: wanted });
      } catch (error) {
        setState({
          status: 'error',
          facing: wanted,
          error: error instanceof Error ? error.message : 'Camera error',
        });
      }
    },
    [state.facing],
  );

  const flip = useCallback(async () => {
    await start(state.facing === 'user' ? 'environment' : 'user');
  }, [start, state.facing]);

  useEffect(() => stop, [stop]);

  return { ...state, videoRef, start, stop, flip };
}

/**
 * Run a callback once per video frame, using `requestVideoFrameCallback` when
 * the browser has it and falling back to `requestAnimationFrame`.
 */
export function useVideoFrameLoop(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  active: boolean,
  onFrame: (video: HTMLVideoElement, timestampMs: number) => void,
): void {
  const callbackRef = useRef(onFrame);
  callbackRef.current = onFrame;

  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    if (!video) return;

    let handle = 0;
    let stopped = false;
    type VideoWithFrameCallback = HTMLVideoElement & {
      requestVideoFrameCallback?: (callback: (now: number) => void) => number;
      cancelVideoFrameCallback?: (handle: number) => void;
    };
    const element = video as VideoWithFrameCallback;

    const step = (now: number): void => {
      if (stopped) return;
      if (video.readyState >= 2) callbackRef.current(video, now);
      handle = element.requestVideoFrameCallback
        ? element.requestVideoFrameCallback(step)
        : requestAnimationFrame(step);
    };

    handle = element.requestVideoFrameCallback
      ? element.requestVideoFrameCallback(step)
      : requestAnimationFrame(step);

    return () => {
      stopped = true;
      if (element.cancelVideoFrameCallback) element.cancelVideoFrameCallback(handle);
      else cancelAnimationFrame(handle);
    };
  }, [active, videoRef]);
}
