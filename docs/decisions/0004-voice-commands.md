# 4. Voice commands run Whisper on the device, and hear almost nothing

**Status:** accepted · **Date:** 2026-09-11

## Context

The session is driven from a mat two or three metres from the phone. Gestures cover
pause and skip, but they cost a repetition's worth of position and they cannot ask
for the cue again. Speaking is the obvious remaining channel.

The browser already has a speech recogniser: `SpeechRecognition`. In Chrome and Safari
it is not local — the audio goes to the vendor's servers. Kinetrace's whole promise is
that what the camera and microphone see stays on the device, so that API is out.

That leaves running a recogniser here. It is also the first feature where listening
for a command competes for the device with pose inference, which already owns the main
thread at 30 frames a second.

## Decision

Whisper `tiny` (or `base`) through `@huggingface/transformers` on WebGPU, in its own
worker, off by default.

- **Off until asked for.** It costs a 75 MB download and a microphone permission, so
  it is a setting, explained where it is turned on, and the privacy screen says what
  happens to the audio. On a device without WebGPU the setting is disabled rather than
  falling back to WebAssembly, which is far too slow to answer mid-exercise.
- **A grammar, not dictation.** Five commands — pause, resume, next, repeat, stop —
  matched against a handful of phrases per language. The matcher lives in the engine
  and holds no words; the vocabulary lives with the cue dictionary in the exercise
  library, the same split as every other piece of text in the project.
- **A gate before the model.** A rolling two second buffer, an adaptive energy
  threshold, and an utterance that closes on half a second of quiet. Whisper runs when
  somebody has spoken, not four times a second, and never while Kinetrace is speaking
  a cue — which would otherwise come straight back in through the microphone.
- **Ending the session needs an exact word.** Every other command forgives a
  mis-heard letter or two. Losing a set to a misheard "terminar" is the worst thing
  this feature can do, so that one does not.

## Consequences

- Voice works in a quiet room, in Spanish and English, without a network connection
  once the model is cached, and without anything leaving the device.
- It does not work on Safari or Firefox today, because they do not ship WebGPU on the
  platforms Kinetrace targets. Gestures remain the way the session is driven there,
  and the help line at the bottom of the session says so.
- The grammar is tested against transcripts, not audio: the matcher has unit tests for
  every phrase and for the things a person actually says while exercising ("uno, dos,
  tres", "esto es para la espalda"), and the gate has tests for silence, an utterance,
  a hum and the coach's own voice. Nothing here tests the recogniser itself.
- How well Whisper hears a person lying on the floor two metres from a phone, over
  their own breathing, is unknown until it is measured on real hardware. That belongs
  in `docs/devices.md` with the rest of the device questions.
