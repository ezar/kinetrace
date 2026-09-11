# 3. The engine emits cue keys, never text

**Status:** accepted · **Date:** 2025-09-11

## Context

The specification says two things that pull in opposite directions: exercise rules
carry "a cue in both languages", and all user-facing copy lives only in i18n
dictionaries.

## Decision

Rules carry a `cueKey`. The text for every key lives in
`packages/exercises/src/dictionary.ts`, in Spanish and English, next to the library
that uses it. The engine emits `{ cueKey, params }` and never a string.

The exercise validator fails the build if a rule points at a key the dictionary does
not have.

## Consequences

- The engine has no language, which is why it runs unchanged in a worker and in Node.
- Tests assert cue keys, so they do not break when the wording is improved.
- Cue text is reviewable in one file, which makes the "under six words, say what to
  do" rule enforceable — and it is enforced by a unit test.
- A translator adds a language by adding one column, not by touching exercises.
