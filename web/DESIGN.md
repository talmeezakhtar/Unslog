---
name: Unslog — The Frosted Pane
description: Glass-and-gradient system for Unslog's dashboard, carrying the sign-in screen's frosted-glass-over-glow material into every page.
colors:
  ground: "#fafbfc"
  surface: "#ffffff"
  surface-sunken: "#f2f3f5"
  ink: "#171717"
  ink-muted: "#6b7280"
  line: "#e4e5e8"
  line-strong: "#b8bac0"
  action: "#5b4fe8"
  action-ink: "#fcfcfc"
  action-soft: "#ecebfc"
  attention: "#c23d95"
  attention-soft: "#fbeaf4"
  danger: "#e24b36"
  good: "#3fa66b"
  series-1: "#76787d"
  series-2: "#d99a3e"
typography:
  display:
    fontFamily: "'Geist Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "2.441rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  body:
    fontFamily: "'Geist Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  mono:
    fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace"
    fontSize: "0.9rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  pill: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "24px"
  6: "32px"
  7: "48px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-glass:
    backgroundColor: "translucent surface, backdrop-filter: blur(8px)"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  tag-good:
    backgroundColor: "{colors.action-soft}"
    textColor: "{colors.action}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  card:
    backgroundColor: "translucent surface, backdrop-filter: blur(16px)"
    rounded: "{rounded.lg}"
    padding: "24px"
  input:
    backgroundColor: "translucent surface, backdrop-filter: blur(6px)"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "44px"
  toast:
    backgroundColor: "translucent surface, backdrop-filter: blur(16px)"
    rounded: "{rounded.lg}"
    padding: "16px"
    accent: "tinted icon only, one of good/danger/attention/action per variant — no border stripe"
  modal:
    backgroundColor: "translucent surface, backdrop-filter: blur(20px)"
    rounded: "{rounded.xl}"
    padding: "24px"
---

# Design System: Unslog — The Frosted Pane

## Overview

**Creative North Star: "The Frosted Pane"**

The sign-in screen introduced a specific material: neutral glass chrome — buttons, inputs, and panels in translucent, blurred ink/paper — floating over a slow-drifting two-colour radial glow. This system carries that same pane of glass into every page of the dashboard, not just the login screen, so the whole app reads as one continuous material rather than a styled lobby in front of a differently-styled building.

This replaces the prior "Ticket Wallet" system (flat ink-bordered ticket stock, condensed-caps display type, a hand-stamped VOID mark, dashed tear perforations) wholesale, per explicit request: "refactor whole website with same theme as new signin page." Product truth, every page's structure, every data flow, and every interaction are unchanged — this is a full re-skin, not a rebuild. The product's one load-bearing constraint carries over in translation: fit scores and visa/residency flags stay instantly scannable, now via a frosted score dial and pill tags rather than an ink stamp and square ticket tags.

**Key Characteristics:**
- Neutral ink/paper chrome everywhere — buttons, borders, and body text carry no hue of their own. Colour is reserved for what must stay scannable (the score fill, visa/attention tags, destructive/good status) or for the ambient glow, never for decoration.
- A faint, slowly-drifting two-colour radial glow (indigo `--action` + magenta `--attention`) sits behind the whole app and a stronger version behind the sidebar, echoing the sign-in screen's brand treatment. Every `backdrop-filter: blur()` panel genuinely blurs this glow — glass as a real optical effect, not a decorative label on a surface with nothing behind it.
- Geist (variable) for all display and body type, replacing the condensed-caps Big Shoulders Display; IBM Plex Mono kept, narrowly, for genuinely tabular figures (scores, dates, salaries, counts).
- Rounded throughout on the shadcn `--radius` scale (6/8/10px, pill for tags and small controls) replacing the old 3–8px ticket-stub corners.
- Soft elevation is back: translucent panels carry a soft blur-blurred shadow instead of the old system's flat, shadow-free ink borders.

## Colors

Neutral ink/paper carries all UI chrome; colour is rationed to the ambient glow and to genuine data signals.

### Primary
- **Action** (`#5b4fe8`; a vivid indigo): primary buttons, the active nav item, the focus ring, the score's high-score ring, and one of the two ambient-glow stop colours. The system's single committed accent — carries the same job the old "jet red" did, translated to a hue shared with the background glow so the accent and the backdrop read as one material.

### Secondary
- **Attention** (`#c23d95`; magenta): duplicate-sighting and follow-up-due signals (`tag-attention`, `.lane.attention`, `.stat.attention`), the warning-variant toast accent/icon, and the glow's second stop colour. Never a second brand accent on interactive chrome.

### Neutral
- **Ground** (`#fafbfc`) — page background, `--ground`. Light-only: the dashboard no longer follows OS dark-mode preference, matching the sign-in screen (shadcn's tokens have no dark branch either, since no theme toggle exists).
- **Surface** (`#ffffff`) — the colour panels/cards/inputs blend toward at reduced opacity, `--surface`.
- **Surface Sunken** (`#f2f3f5`) — Pipeline lane and skeleton backgrounds, `--surface-sunken`.
- **Ink** (`#171717`; dark near-white) — primary text, `--ink`.
- **Ink Muted** (`#6b7280`) — secondary text, metadata, `--ink-muted`.
- **Line** / **Line Strong** (`#e4e5e8` / `#b8bac0`) — hairlines, input borders.
- **Danger** (`#e24b36`, shared with shadcn's `--destructive`) — error text, the Pipeline "Closed" badge, and the error-variant toast accent/icon.
- **Good** (`#3fa66b`) — health-check dots, and the success-variant toast accent/icon. Still never used for interactive chrome (buttons, links) — status signals only.
- **Series 1 / Series 2** (`#76787d` / `#d99a3e`) — the Insights page's hand-rolled SVG chart fills. Series 2 is now genuinely amber, matching copy on the Skills chart ("Your skills are in amber") that the old navy `--chart-2` never actually matched.

### Named Rules
**The One Accent Rule, translated.** Action-indigo is the only colour allowed to signal "act on this" or "this is live" in UI chrome — carried over unchanged from the old system, with the hue swapped from jet red to indigo so it can double as a glow stop colour.

**The Glass-Is-an-Effect Rule.** `backdrop-filter: blur()` only appears on a surface that sits over the ambient glow (every panel does, via `body::before` / `.sidebar::before`). Glass is never applied where there is nothing behind it to blur — that would be decoration wearing the material's clothes.

## Layout

Unchanged from the incumbent: a sidebar (`flex: 1 1 220px`) beside a fluid main column (`flex: 999 1 560px`, capped at 1240px), collapsing to a horizontal top bar under 720px. Same 8px-rooted spacing scale. Same `.cols` wide/narrow split, same horizontally-scrolling Pipeline board.

## Elevation & Depth

Reversed from the old "Flat Stock Rule": panels now carry a soft, blurred shadow (`0 8px 24px -12px`) plus `backdrop-filter: blur()`, reading as frosted glass floating over the glow rather than ink-bordered flat stock. Buttons carry an inset highlight (`inset 0 1px 0`) simulating a glass bevel, matching the sign-in screen's glass buttons.

## Shapes

Radii moved from the old 3/5/8px ticket-stub scale onto the shadcn `--radius` scale (`--radius-sm`/`--radius-md`/`--radius-lg`, 6/8/10px), shared with the Tailwind utilities the sign-in screen uses — one radius system for the whole app. Tags, chips, the nav-count badge, and small round controls use a full pill (999px). The old tear-perforation divider is retired; a plain 1px `.divider` rule replaces it where Settings needs a section break.

## Components

### Buttons
- **Secondary (`.btn`):** translucent frosted fill, `backdrop-filter: blur(8px)`, hairline border, inset highlight — the glass button material from the sign-in screen, adapted to a rectangular 44px control instead of a pill, since dense forms read better with compact rectangular controls than hero-sized pills.
- **Primary (`.btn-primary`):** solid action-indigo fill, no blur — still the one clearly-weighted call to action per view.
- **Quiet (`.btn-quiet`):** no border, no blur, body-weight text — sign-out and other low-emphasis actions.

### Tags
Pill-shaped (999px) instead of the old square ticket tags; same four variants (`default`/`tag-attention`/`tag-good`/`tag-missing`) and the same semantic scope as before.

### Cards / Panels
Translucent surface (`color-mix` toward `--surface`) with `backdrop-filter: blur(16px)` and a soft shadow, `--radius-lg` corners. The Pipeline's closed/rejected cards keep their application fully visible underneath, now labelled with a small "Closed" pill badge in the corner instead of a diagonal hand-stamped VOID mark — the stamped-ink texture was specific to the retired paper-ticket world.

### Inputs
Translucent fill, `backdrop-filter: blur(6px)`, hairline border, `--radius-md` corners — same 44px height and label-above convention as before.

### Navigation
The sidebar carries a stronger, animated version of the ambient glow directly behind its nav links, echoing the sign-in screen's brand treatment. Each nav item now pairs a lucide icon with its label (new; the old system had text-only nav links). The active route gets a soft indigo-tinted background instead of the old solid red left-border.

### The Fit Score (signature component)
Still a circular dial with an indigo fill rising in proportion to score, still rendered in mono numerals — now a frosted, blurred circle with no rotation, instead of an ink-stamped rotated mark. High scores still get a distinguishing ring, now a soft indigo glow instead of a solid red border.

### Page transitions (new signature interaction)
Every page's content fades and un-blurs in on navigation (`opacity`/`y`/`blur` via framer-motion in `Layout.tsx`), the same entrance motion the sign-in screen uses for its own content, applied once centrally so every page inherits it for free.

### Toasts
Stacked, bottom-right, built on Radix `Toast` for the behaviour that's tedious to hand-roll correctly: auto-dismiss with pause-on-hover/focus, swipe-to-dismiss, and an ARIA live region. Same frosted-card material as panels (`blur(16px)`, `--radius-lg`, neutral hairline border — no side-accent stripe), with a single tinted lucide icon carrying the variant — `good`/`danger`/`attention`/`action` for success/error/warning/info — so the status colours keep their existing semantic jobs instead of introducing a new palette or a second, redundant colour cue. `useToast()` takes a plain string (success, matching every current call site) or `{ title, description?, variant? }`. Entrance/exit use the same spring-ish ease as the rest of the app; swipe and timeout are plain CSS keyed off Radix's `data-state`/`data-swipe` attributes, no framer-motion needed for those.

### Pipeline board
Each application is a card with a neutral monogram avatar (company initials, same frosted-chip material as a hairline-bordered surface — never tinted, it's identity not a data signal), job title, company/city, and a relative timestamp. Cards are natively `draggable` and every lane is a drop target: dragging to another lane calls the same `setApplicationStatus` the stage `<select>` already used, so the dropdown stays as the keyboard/no-mouse path while drag is the fast one. Dropping on Closed defaults to Rejected (there's no drag target for Withdrawn specifically — use the stage menu for that). The lane being dragged over tints with `action-soft` (the system's one "this is live" signal); the dragged card dims to 40% opacity, cleared defensively both on its own `dragend` and in the target's `drop` handler, since a card that unmounts from its old lane as part of the status update can leave the browser with nowhere to deliver that trailing event. New cards fade/rise in on mount via a plain CSS keyframe (no new dependency) and lift 2px on hover.

### Review modal
Clicking a job's title or its "Review" action opens the job in place (`components/ui/modal.tsx`, Radix `Dialog` + framer-motion) instead of navigating to `/jobs/:id` — the direct route still exists for deep links. Heavier glass than a panel (`blur(20px)`, `--radius-xl`) since it floats above a dimmed scrim rather than directly on the ambient glow. `JobDetail`'s own `.panel` sections flatten to plain content blocks inside it (`background/border/shadow: none`) so the modal doesn't stack glass-on-glass.

### Insights charts (signature motion: the data draws itself)
The page's one authored moment: bars and columns grow from zero on mount and whenever their underlying period changes (`key={days}` on the period-driven charts forces a clean replay), because the magnitude *is* the story this page tells. `HBarChart`/`ColumnChart` scale a plain CSS `transform` (`scaleX`/`scaleY` off a `transform-box: fill-box` origin at the bar's own base) rather than recomputing the SVG path per frame — cheap, and it keeps the exact rounded-one-side bar shape already drawn. `RangeChart`'s rows get a different, meaning-matched treatment (slide-and-fade, not grow-from-zero) since a low–high span has no natural zero baseline to grow from. Rows stagger a capped 25ms each (first ~12 rows only) so a long list still reads as one quick reveal, not a wait. Hovering a row brightens its bar/whisker and lifts its label to full ink — the existing tooltip's only prior feedback cue, now doubled with a cheap CSS-only one. Every entrance respects `prefers-reduced-motion` (`animation: none`, which lands on the same fully-visible end state since nothing else sets `transform`). Chart value numbers (and the salary-axis min/max) now actually use `--font-mono` with tabular numerals, per this doc's own "keep IBM Plex Mono for every count" rule — they'd silently inherited body type before. Section headings pair a small muted lucide icon with the heading text, matching the nav's icon+label convention. The companies list reuses Pipeline's monogram `.avatar` (a new `.avatar-sm` size) instead of bare text, so ranked-list rows read consistently across the app. The shared `Loading` skeleton also gained a subtle shimmer sweep (CSS-only, reduced-motion aware) — it was previously a dead gray block even though it's the loading state for all six of this page's panels.

## Do's and Don'ts

### Do:
- **Do** keep IBM Plex Mono with tabular numerals for every score, date, salary, and count.
- **Do** reserve `backdrop-filter: blur()` for surfaces that sit over the ambient glow; never add it decoratively.
- **Do** keep action-indigo reserved for primary actions and the one "live/actionable" signal per view.
- **Do** keep attention-magenta scoped to duplicate-sighting / follow-up-due signals only.

### Don't:
- **Don't** reintroduce uppercase condensed display type for body prose — Geist is the one type voice now, weight and size carry hierarchy.
- **Don't** add glass/blur to a panel with no ambient glow behind it.
- **Don't** mix attention-magenta and action-indigo as competing accents on the same element.
