import { describe, expect, it } from 'vitest';
import { SetupAssistant, detectView } from '../setup/assistant.js';
import { metricLandmarkIndices } from '../metrics/definitions.js';
import { synthesizeFrames, type ReferenceMotion } from '../synth/motion.js';
import type { PoseFrame } from '../types.js';

const STANDING: ReferenceMotion = {
  posture: 'standing',
  cameraSide: 'left',
  cycleSeconds: 1,
  keyframes: [{ t: 0, pose: { hipAngle: 176, kneeAngle: 176 } }],
};

function frames(view: 'side' | 'front', seconds = 4): PoseFrame[] {
  return synthesizeFrames(STANDING, { view, fps: 30, holdAtPhase: 0, holdSeconds: seconds });
}

const REQUIRED = metricLandmarkIndices('hipFlexion', 'auto');

describe('detectView', () => {
  it('tells a front view from a side view', () => {
    expect(detectView(frames('front')[0]!.image)).toBe('front');
    expect(detectView(frames('side')[0]!.image)).toBe('side');
  });
});

describe('SetupAssistant', () => {
  it('asks the user to turn sideways when a side view exercise is shot from the front', () => {
    const assistant = new SetupAssistant({ requiredView: 'side', requiredLandmarks: REQUIRED });
    let state = assistant.state;
    for (const frame of frames('front')) state = assistant.update(frame);
    expect(state.ready).toBe(false);
    expect(state.detectedView).toBe('front');
    expect(state.checks.find((check) => check.id === 'view')?.tipKey).toBe(
      'setup.tip.turnSideways',
    );
  });

  it('becomes ready only after every check has held for two seconds', () => {
    const assistant = new SetupAssistant({ requiredView: 'side', requiredLandmarks: REQUIRED });
    const sequence = frames('side', 4);
    let state = assistant.update(sequence[0]!);
    expect(state.ready).toBe(false);
    for (const frame of sequence.slice(0, 45)) state = assistant.update(frame);
    expect(state.ready).toBe(false);
    for (const frame of sequence) state = assistant.update(frame);
    expect(state.ready).toBe(true);
    expect(state.checks.every((check) => check.status === 'ok')).toBe(true);
  });

  it('asks the user to step back when the body fills the frame', () => {
    const assistant = new SetupAssistant({
      requiredView: 'side',
      requiredLandmarks: REQUIRED,
      framing: { min: 0.02, max: 0.05 },
    });
    let state = assistant.state;
    for (const frame of frames('side')) state = assistant.update(frame);
    expect(state.checks.find((check) => check.id === 'framing')?.tipKey).toBe('setup.tip.stepBack');
  });

  it('reports poor detection when the landmarks are barely visible', () => {
    const assistant = new SetupAssistant({ requiredView: 'side', requiredLandmarks: REQUIRED });
    const dim = frames('side').map((frame) => ({
      ...frame,
      image: frame.image.map((landmark) => ({ ...landmark, visibility: 0.2 })),
    }));
    let state = assistant.state;
    for (const frame of dim) state = assistant.update(frame);
    expect(state.ready).toBe(false);
    expect(state.checks.find((check) => check.id === 'detection')?.status).toBe('failed');
  });
});
