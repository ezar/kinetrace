# Design

The design canvas is the visual reference for the app, in the order the
specification asks for: design first, then code.

- `canvas/*.dc.html` — one file per artboard. These are the working files; the
  canvas is rebuilt from them.
- `canvas/canvas.json` — the layout: pages, artboard positions, sticky notes.

The published canvas is generated and not committed; rebuild it with the
`design` skill in Claude Code (`/design`), which seeds a fresh copy of the
editor from these files and publishes it.

## What the canvas settles

|                 |                                                                              |
| --------------- | ---------------------------------------------------------------------------- |
| Fundamentos     | colour, type scale, radii, minimum hit sizes                                 |
| Componentes     | stick figure, angle gauge, counter, cue banner, badges, heatmap, icons       |
| Pantallas       | the ten mobile screens at 390 px, help among them                            |
| Sesión          | camera setup, far mode in portrait, landscape and on a laptop, rest, summary |
| Primer arranque | the five first-run steps, in order                                           |
| Profesional     | the prescription review, and the printed sheet at A4                         |
| Estados         | empty, loading, error, tracking lost, safety stop                            |

## Decisions the canvas makes

- **The stick figure sits on a mat.** Without a ground line a supine or
  quadruped pose reads as scaffolding; the mat is what makes the posture legible.
  The tracked joint is amber with a ring.
- **Far mode has its own palette.** The brand green on near-black is 3.5:1,
  short of AAA, so far mode lightens the roles: `#58cf9a`, `#ff9552`, `#ff6b5c`
  on `#121110`.
- **Home has one job.** Today's routine card with a 60 px Start; streak and last
  session drop to a quiet row.
- **Privacy comes before the camera prompt.** The browser asks for the camera in
  the session, not in the first run — so the promise has to be made first, on its
  own screen, while there is still nothing to permit.
- **The physio's sheet is paper.** Four columns, because they fit a phone, with
  each measurement in the same cell as the target it is judged against. The
  artboard is A4 at 96 dpi, not a phone, because that is what comes out of the
  printer.
