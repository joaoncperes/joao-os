# Pedro OS — Design System

V2 redesign. Light-mode-only OKLCH cool-slate palette. Calm, precise, low-chrome.
Pedro opens the app at 5:50 AM and 22:15 — the system favors clarity over saturation.

## 1. Atmosphere

- White surfaces on a cool slate background. Text is a deep cool-blue near-black.
- Single accent (blue, hue 250). Other hues only for area-coding and status.
- Sharp 6/8/12 radii. No glass, no gradients (except the PR set highlight).
- Inter for UI. Fraunces for serif H1s on Journal and Week.
- Density is hardcoded "comfortable" (`--row-h: 42px`); no settings UI in V1.

## 2. Color tokens (OKLCH)

All tokens live as CSS vars on `:root` in `app/globals.css`. Tailwind exposes them
as `bg-surface`, `text-text-3`, `border-border-strong`, etc.

### Surface / text

| Token | OKLCH | Use |
|---|---|---|
| `--background` | `oklch(98.5% 0.004 240)` | App canvas |
| `--surface` | `oklch(100% 0 0)` | Cards, sidebar |
| `--surface-2` | `oklch(97% 0.005 240)` | Hover, inset, table sub-headers |
| `--text` | `oklch(22% 0.015 250)` | Primary text |
| `--text-2` | `oklch(45% 0.012 250)` | Secondary text |
| `--text-3` | `oklch(62% 0.01 250)` | Labels, micro-copy |
| `--text-4` | `oklch(75% 0.008 240)` | Placeholders, disabled |
| `--border` | `oklch(92% 0.006 240)` | Standard divider |
| `--border-strong` | `oklch(86% 0.008 240)` | Hover on inputs |

### Accent (brand blue, hue 250)

| Token | Use |
|---|---|
| `--accent` | Active nav, primary CTA bg, focus ring, progress fill |
| `--accent-soft` | Active-nav bg, focus ring (3px spread) |
| `--accent-tint` | Drag-over highlight, today-column bg, rest-card icon bg |

### Semantic

| Token | OKLCH | Use |
|---|---|---|
| `--success` | `oklch(58% 0.12 150)` | Done glyph, PR badge, on-track status |
| `--success-soft` | `oklch(95% 0.04 150)` | Done glyph bg |
| `--danger` | `oklch(58% 0.18 25)` | Miss glyph, delete-hover |
| `--danger-soft` | `oklch(96% 0.04 25)` | Miss glyph bg |
| `--freeze` | `oklch(72% 0.13 70)` | Freeze-day glyph |
| `--freeze-soft` | `oklch(96% 0.06 70)` | Freeze glyph bg |

### Life areas (Insights chips, habit dots)

| Token | Hue | Area |
|---|---|---|
| `--area-pro` (alias `--area-professional`) | 250 (blue) | Professional |
| `--area-health` | 150 (green) | Health |
| `--area-family` | 30 (orange) | Family |
| `--area-marriage` | 350 (pink) | Marriage |
| `--area-cross` | 290 (purple) | Cross-cutting |

### Shadows

| Token | Use |
|---|---|
| `--shadow-sm` | Subtle card lift |
| `--shadow-md` | Buttons, dropdowns |
| `--shadow-lg` | Sticky save bars |

## 3. Typography

| Family | CSS var | Use |
|---|---|---|
| Inter (variable) | `--font-sans` / `--font-inter` | UI body, tabular nums |
| Fraunces | `--font-display` / `--font-fraunces` | H1 on Journal, Week, large display |
| Inconsolata | `--font-mono` / `--font-inconsolata` | Reserved for future code/log surfaces |

| Role | Size | Weight | Notes |
|---|---|---|---|
| Page H1 (sans) | 30px | 600 | tracking -0.02em, line-height 1.05 |
| Page H1 (display, Journal/Week) | 36px | 500 | Fraunces, tracking -0.02em |
| Section H2 | 22px (Fraunces 500) or 11.5px uppercase 600 (eyebrow) | — | |
| Card title | 14–14.5px | 600 | tracking 0 |
| Body | 14px | 400–500 | line-height 1.45 |
| Label uppercase | 10.5–11.5px | 600 | tracking 0.06–0.08em, uppercase, color text-3 |
| Stat value | 20–22px | 600 | tabular-nums |
| Eyebrow | 12px | 600 | uppercase tracking 0.08em, color accent |

Microtype helpers: `.label-micro` (10.5px) and `.label-uppercase` (11.5px) in `globals.css`.

## 4. Spacing & radius

- Vertical rhythm: 4 / 8 / 14 / 20 / 28 / 36px.
- Card padding: 16–22px depending on density.
- Row heights are driven by `--row-h` (42px comfortable). Override via `data-density`
  on `<html>` if a settings UI is added later.
- Radii: `--radius-sm: 4px`, `--radius-md: 6px`, `--radius-lg: 8px`,
  `--radius-xl: 12px` (cards), `--radius-2xl: 16px` (large feature cards).
  `999px` for pills and toggle thumbs.

## 5. Components

Reusable widgets live in `components/ui/`. Each is intended to be used across 3+ screens.

| Component | Use |
|---|---|
| `<StatCard>` | Workout stats, Insights stats. Label + tabular value + optional unit + trend + bar. |
| `<ScorePips>` | Journal area scores. 1–5 pip grid; click to set, click same to clear. |
| `<GlyphCell>` | Insights matrix (`done`, `miss`, `freeze`, `empty`, `future`). Used in legend too. |
| `<SaveBar>` | Sticky-bottom for Journal + Week. States: idle / dirty / saving / saved. |
| `<SectionHeader>` | Eyebrow + H1 (sans or Fraunces) + subtitle + optional right-side action. |
| `<TabBar>` | Workout day picker (Mon–Sun, M–S) with active fill + today-highlighted sub-label. |
| `<AreaChip>` | Insights and habit rows: colored dot + uppercase area label. |

## 6. Layout

- Sidebar (240px) on `lg:` and up, sticky. Collapses on smaller; `BottomNav` shows.
- Main content max-width 1100px, padded 56px (desktop) → 24px (mobile).
- Two-column patterns (Today buckets, Week priority editor) collapse to single
  column below `lg`.

## 7. Motion

- Transitions: 120–180ms for hover/focus, 240–320ms for progress bars.
- Animated easing: `cubic-bezier(0.4, 0, 0.2, 1)` for progress fills.
- Glyph cells scale 1.08 on hover.
- Drag-and-drop tasks fade to 40% opacity while dragging; drop target lights up
  with `bg-accent-tint`.
- No translate-on-hover (Webflow's `+6px` motif was retired in V2).

## 8. Don'ts

- Don't introduce a 6th hue for life areas (pro/health/family/marriage/cross is fixed).
- Don't expand radii past 16px for functional surfaces (cards, inputs, buttons).
- Don't add saturated `bg-accent/40`-style hover fills — use `bg-accent-tint` or
  `bg-surface-2` instead. The `--accent` is for primary actions and emphasis only.
- Don't show the `tweaks-panel.jsx` floating panel in production. It's a prototype
  affordance from `new-design/`; the production app has no user-facing toggles in V1.

## 9. Future

- Dark mode: deferred. Token names are theme-agnostic — switching to a dark
  palette only requires re-binding the `--*` vars under a `.dark` class on `<html>`.
- Settings page: deferred. If added, surface density (`--row-h` 36/42/48), accent
  hue (0–360°), and section toggles (intention, streak strip).
- Per-habit deep dives, area-score line charts, and AI insights all share these
  tokens.
