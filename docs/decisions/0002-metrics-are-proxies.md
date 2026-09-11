# 2. Some metrics are honest proxies, and the app says so

**Status:** accepted · **Date:** 2025-09-11

## Context

Thirty-three landmarks do not describe a spine. Pelvic tilt, thoracic rotation and
"the lower back is arching" are all things a physiotherapist reads from the body but
that the landmark set only hints at.

Kinetrace could either restrict itself to the joints it measures well — knees, hips,
shoulders, elbows and the trunk against gravity — or offer proxies and pretend they
are measurements.

## Decision

Offer the proxies, name them proxies in the metric's own documentation, and let each
exercise declare how well it is tracked:

```ts
trackingConfidence: 'high' | 'medium' | 'low',
```

The library shows that as plain words ("small movement, the measure is approximate"),
and the pelvic tilt exercise says so on its own card.

`pelvisTilt`, `spineFlexion`, `kneeValgus` and `trunkLineDeviation` are all derived
from landmark geometry rather than measured directly, and their doc comments say what
they actually compute.

## Consequences

- A user is never told a number is clinical when it is a proxy.
- Progress charts for low confidence exercises are still useful as trends, which is
  what the physiotherapist looks at anyway, and the app does not claim more.
- If a better primitive appears — a spine landmark set, a second camera — the DSL
  does not change, only the metric behind the id.
