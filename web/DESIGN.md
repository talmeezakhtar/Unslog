---
name: Unslog — The Ticket Wallet
description: Jet-age airline-ticket-wallet system for a personal UAE job-hunt dashboard; every job becomes a travel document.
colors:
  paper: "#f3efe4"
  ticket-stock: "#fffdf8"
  surface-sunken: "#ece7d8"
  carrier-navy: "#13203a"
  ink-muted: "#5b6273"
  line: "#d9d2bf"
  line-strong: "#a9a08a"
  jet-red: "#d7262d"
  action-ink: "#fffdf8"
  action-soft: "#fbe2df"
  carbon-purple: "#4b2e83"
  attention-soft: "#e7e0f3"
  danger: "#b0191f"
  good: "#1f6b4d"
typography:
  display:
    fontFamily: "'Big Shoulders Display', 'Segoe UI', system-ui, sans-serif"
    fontSize: "2.441rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  title:
    fontFamily: "'Big Shoulders Display', 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  label:
    fontFamily: "'Big Shoulders Display', 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.03em"
  body:
    fontFamily: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif"
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
  sm: "3px"
  md: "5px"
  lg: "8px"
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
    backgroundColor: "{colors.jet-red}"
    textColor: "{colors.action-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.jet-red}"
    textColor: "{colors.action-ink}"
  button-secondary:
    backgroundColor: "{colors.ticket-stock}"
    textColor: "{colors.carrier-navy}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "44px"
  tag-good:
    backgroundColor: "{colors.carrier-navy}"
    textColor: "{colors.ticket-stock}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "3px 8px"
  tag-attention:
    backgroundColor: "{colors.attention-soft}"
    textColor: "{colors.carbon-purple}"
    rounded: "{rounded.sm}"
    padding: "3px 8px"
  card:
    backgroundColor: "{colors.ticket-stock}"
    rounded: "{rounded.sm}"
    padding: "12px"
  input:
    backgroundColor: "{colors.ticket-stock}"
    textColor: "{colors.carrier-navy}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    height: "44px"
---

# Design System: Unslog — The Ticket Wallet

## Overview

**Creative North Star: "The Ticket Wallet"**

Every job and application in Unslog is drawn as a travel document, not a SaaS record. The dashboard is the inside of a jet-age ticket wallet: coupon-stock paper underneath, carrier-navy structure holding it together, and jet red as the one committed signal color — stamped onto scores, printed on primary buttons, and burned into the "Today" boarding-pass summary. Carbon purple is held back for exactly one job: marking a duplicate sighting or a follow-up that's gone quiet, so that signal is never confused with the red of a primary action. Rejected or withdrawn applications are never deleted — they're VOIDed, stamped and kept in the lane, honest about what happened to them.

This system was chosen over "The Noticeboard Wall" in a direction tournament and replaces the dashboard's prior, untracked visual state wholesale; there is no earlier DESIGN.md to reconcile against. The build keeps the product's one load-bearing constraint — fit scores and visa/residency flags stay instantly scannable — by giving the score its own stamped, high-contrast circular slot and by giving visa tags their own tag-attention/tag-good treatment rather than burying either in body text. The product was renamed from "Callback" to "Unslog" after this system shipped (user-supplied name and brand sheet, 2026-10-09), with a new mark: a rounded-square tile holding an up-right arrow and two underline bars. The supplied sheet pairs the arrow in a second accent (signal orange) against an ink or orange tile; built instead as a single-accent mark so tile and arrow+bars both ride the system's one committed accent color rather than adding a second brand hue (see The Living Mark Rule). The wordmark text and mark shape are the fixed brand asset going forward; the mark's color is explicitly *not* pinned to a fixed hue — it rides `var(--action)`, so it always matches the live world instead of carrying an older palette forward.

**Key Characteristics:**
- Coupon-white paper ground with carrier-navy ink structure; jet red is the only accent allowed to carry primary action and live-status weight.
- Perforated tear lines (dashed rule + punched circular ends) stand in for card dividers and section breaks.
- Big Shoulders Display (condensed uppercase) for every label, heading, button, and tab; IBM Plex Sans for body copy; IBM Plex Mono with tabular numerals for every score, date, salary, and count.
- Flat throughout — no drop shadows anywhere in the system; depth comes from ink-heavy borders, dashed perforation, and the navy sidebar, never from elevation.
- A diagonal, hand-stamped VOID mark (SVG turbulence filter, not a clean CSS box) covers closed/rejected pipeline cards without removing them.

## Colors

Warm coupon-paper neutrals carry the system; jet red is rationed to action and live status; carbon purple is reserved for exactly one signal.

### Primary
- **Jet Red** (`#d7262d`; dark mode `#ef5a52`): the one committed working accent — primary buttons, the live "to review" step in the Today funnel strip, the score fill, focus rings, VOID stamp outline (via `--danger`, a close sibling), and the Unslog logo mark's accent. Used for action, urgency, and brand-mark identity — never for plain decoration.

### Secondary
- **Carbon Purple** (`#4b2e83`; dark mode `#b6a3e8`): reserved for duplicate-sighting and follow-up-due states only (`tag-attention`, `.lane.attention`, `.stat.attention`). Never used as a second brand accent — its entire job is to read as "not red" when a signal must not be confused with a primary action.

### Neutral
- **Coupon Paper** (`#f3efe4`; dark mode `#10161f`) — page ground, `--ground`.
- **Ticket Stock** (`#fffdf8`; dark mode `#182030`) — card/panel/input surface, `--surface`.
- **Sunken Stock** (`#ece7d8`; dark mode `#1f2a3d`) — pipeline lane and skeleton backgrounds, `--surface-sunken`.
- **Carrier Navy** (`#13203a`; dark mode `#eceef3`) — primary ink, headings, the sidebar/auth "wallet cover," tag-good stamp fill, `--ink`.
- **Navy Muted** (`#5b6273`; dark mode `#9aa3b8`) — secondary text, metadata, `--ink-muted`.
- **Hairline** (`#d9d2bf`; dark mode `#2d3b52`) and **Hairline Strong** (`#a9a08a`; dark mode `#495a79`) — dividers, input strokes, tear-line dashes.
- **Deep Clearance** (`#b0191f`; dark mode `#ff8178`) — `--danger`, VOID stamp and error text.
- **Cleared Green** (`#1f6b4d`; dark mode `#6fcf9e`) — `--good`, used narrowly for health-check status dots only, not for tags (see Named Rule below).

### Named Rules
**The One Accent Rule.** Jet red is the only color allowed to signal "act on this," "this is live," or "this is the brand." Carbon purple never substitutes for it, even when both would be visually legible — purple means "duplicate or stale," never "go."

**The Stamped, Not Colored Rule.** A cleared/good state (visa clear, applied, confirmed) is rendered as a navy ink stamp (`tag-good`: navy fill, paper text) rather than a green badge. Green (`--good`) is held back for the Today health-check dots only; it does not appear on any tag, card, or button. This replaced an earlier off-world generic-green `tag-good` during finish review specifically so "cleared" reads as part of this world's ink vocabulary, not a borrowed status-green.

**The Living Mark Rule.** The Unslog logo mark's accent is bound to `var(--action)`, the system's single committed accent token, rather than a hue fixed to the mark itself. The mark's shape (rounded-square tile, up-right arrow, two underline bars) and the "Unslog" name are the fixed brand asset; its color is not — it always matches whichever world currently owns `--action` (jet red for The Ticket Wallet). Confirmed in PRODUCT.md's Brand Commitments.

## Typography

**Display Font:** Big Shoulders Display (condensed, uppercase), with Segoe UI / system-ui fallback.
**Body Font:** IBM Plex Sans, with Segoe UI / system-ui fallback.
**Label/Mono Font:** IBM Plex Mono, set with `font-variant-numeric: tabular-nums`, with ui-monospace fallback.

**Character:** A condensed, uppercase display face for everything that reads as a printed label or flight code, a plain humanist sans for anything meant to be read as prose, and a tabular mono for every number that must line up and be scanned fast — scores, dates, salaries, counts.

### Hierarchy
- **Display** (800, 2.441rem / `--text-2xl`, line-height 1.05, uppercase, −0.02em): page `h1`s and the Today greeting (`clamp(2rem, 4vw, 3.2rem)`).
- **Title** (700, 1.25rem / `--text-lg`, line-height 1.05, uppercase): `h2`, lane headers, auth card heading (set not uppercase there, see Shapes).
- **Label** (700, 0.8rem / `--text-xs`–`--text-sm`, uppercase, 0.03–0.04em tracking): field labels, button text, nav links, tabs, tags, table headers, segmented-control options.
- **Body** (400, 1rem / `--text-md`, line-height 1.5): paragraphs, descriptions, drafted cover-note text; description blocks cap at 75ch.
- **Mono/Label** (600–700, 0.8–1.563rem, tabular-nums): fit scores, funnel-strip counts, stat figures, table cells, dates, job-row metadata, timeline entries.

### Named Rules
**The All-Caps Label Rule.** Every UI label (nav, button, tag, tab, table header, field label) is set in uppercase Big Shoulders Display with positive letter-spacing. Body prose is never set in display face or uppercase.

**The Tabular Everything Rule.** Any number a user scans to compare — score, salary, date, count — is set in IBM Plex Mono with tabular figures, so columns of numbers line up like a printed manifest.

## Layout

The shell is a fixed navy sidebar ("wallet cover," `flex: 1 1 220px`, max 220px effective) beside a fluid main column (`flex: 999 1 560px`, capped at 1240px), collapsing the sidebar to a horizontal top bar under 720px. Spacing runs on an 8px-rooted scale (4/8/12/16/24/32/48px: `--space-1`…`--space-7`); panels pad at `--space-5` (24px), the main column's outer padding steps up to `--space-6`/`--space-7` (32/48px). Multi-column content (`.cols`) splits into a `.wide` (flex-basis 520px) and `.narrow` (flex-basis 300px) pairing that stacks on narrow viewports. The Pipeline board scrolls horizontally as a row of fixed-width lanes (`grid-auto-flow: column`, `minmax(150px, 1fr)`) rather than wrapping — it reads as a physical row of coupon stubs, not a responsive grid.

## Elevation & Depth

This system is flat by design: there are no `box-shadow` elevation tokens anywhere in the stylesheet. Depth is conveyed by ink-weight borders (1–3px, `--line` / `--line-strong` / `--ink`), by the dashed perforation of `.tear`, and by solid color blocking (the navy sidebar and auth cover sit behind everything else with no shadow, only a perforated edge). The one exception is a focus ring (`--focus`, a 3px jet-red color-mix glow) and an inset ring on a high-scoring `.score.is-high` — both are interaction/state signals, not ambient elevation.

### Named Rules
**The Flat Stock Rule.** Nothing in this system lifts off the page with a shadow. A card reads as a cut and printed piece of ticket stock lying flat, bordered by ink, not a floating surface.

## Shapes

Radii are small and consistent: `--radius-sm` (3px) for buttons, tags, inputs, and cards; `--radius-md` (5px) for panels, stats, and the funnel strip; `--radius-lg` (8px) only for the auth card and its navy cover. Pipeline lanes are hard-cornered (radius 0) and capped with a 3px solid top border, reading as coupon-book tabs rather than soft cards. The signature recurring form is the **tear**: a 1.5px dashed top border with two punched circular cutouts at its ends (`.tear::before/::after`), used as the divider between a ticket's body and its action stub (job rows, the auth card's divider). On narrow viewports the punched circles are dropped and only the dashed line remains.

## Components

### Buttons
- **Shape:** 3px radius, 44px min height, 1.5px ink or action border.
- **Primary:** jet-red fill (`--action`), paper-colored text, label typography; `:hover` brightens, `:active` nudges down 1px.
- **Secondary (`.btn`):** paper surface, navy border and text — reads as an unstamped ticket stub.
- **Quiet (`.btn-quiet`):** border/background removed, body-weight text, used for sign-out and other low-emphasis actions.
- **Small (`.btn-small`):** 36px height, used inside pipeline cards and job-row action stubs.

### Tags
- **Default:** paper background, navy-muted border and text, label typography, uppercase.
- **Attention (`tag-attention`):** carbon-purple border/background/text — duplicate sighting or follow-up-due only.
- **Good (`tag-good`):** navy fill, paper text — a stamped "cleared" mark, not a green badge (see Named Rule under Colors).
- **Missing (`tag-missing`):** dashed border, same neutral palette, for an unfilled/optional field.

### Cards / Containers
- **Corner Style:** 3px radius for pipeline cards, 5px for panels/stats.
- **Background:** ticket-stock surface on paper ground; sunken-stock for pipeline lanes.
- **Shadow Strategy:** none — see Elevation & Depth.
- **Border:** 1px hairline on panels/cards; pipeline lanes use a 3px solid top border instead of a full outline.
- **Internal Padding:** 12px for pipeline cards, 24px for panels.

### Inputs / Fields
- **Style:** paper background, 1px hairline-strong border, 3px radius, 44px min height, label set above in uppercase display type.
- **Focus:** border shifts to jet red; no glow/shadow beyond the shared `--focus` ring on keyboard focus.
- **Disabled:** 0.5 opacity, no transform.

### Navigation
The sidebar is the wallet cover: navy gradient fill, a perforated right edge (radial-gradient dot pattern simulating a punched tear strip), uppercase display-type links with a 3px left border that fills jet red only on the active route. A red pill badge (`.nav-count`) surfaces the follow-up-due count. The brand mark at the top of the sidebar and the auth screen (`Logo`, a rounded-square "C") renders its accent from `var(--action)` rather than a fixed hue (see The Living Mark Rule). Below 720px the sidebar flattens into a horizontal top bar and drops its footer (AI-usage line, signed-in email, sign-out).

### The Fit Score (signature component)
A 56px (88px large) circle, paper-filled with a navy numeral in mono type, rotated −3° so it reads as a hand-stamped mark rather than a UI badge. A jet-red fill rises from the bottom of the circle in proportion to the score (`--score` CSS variable driving `transform: scaleY()`); scores ≥80 additionally get a jet-red border and ring. This is the system's one deliberately bold, non-flat-feeling element, built specifically to keep the fit score instantly scannable per the product's hard constraint.

### The VOID Stamp (signature component)
Closed/rejected pipeline cards (`.card-void`) drop to 72% opacity and gain a diagonal "VOID" mark — danger-red text and double outline, rotated −10° — run through an inline SVG `feTurbulence`/`feDisplacementMap` filter (`#stampRough`, defined once in Pipeline.tsx) so the stamp's edges read as inked and distressed rather than a clean vector box. The application itself is never deleted or hidden; VOID is laid over a fully intact card.

### Today's Boarding-Pass Strip (signature component)
`.funnel-strip`: a single navy bar divided by dashed vertical rules into steps (new/passed/scored/to-review), each a mono tabular count over an uppercase label; the final step (to-review) is cut out in jet red to mark it as the one actionable figure in the row.

### The Coupon-Wallet Pipeline Board (signature component)
`.board`/`.lane`: a horizontally scrolling row of hard-cornered, top-bordered lanes (Saved → Applied → Follow-up due → Interview → Offer → Closed), each holding `.card` stubs. A lane goes `.attention` (carbon-purple top border and tint) only when it is the follow-up-due lane with cards waiting — not decoratively.

### Tear Perforation (signature utility)
`.tear`: a reusable dashed divider with punched-circle ends, dropped between a job row's body and its action stub, and between the auth card's pitch and its sign-in controls. It is the system's standing substitute for a plain `<hr>` or shadowed card edge.

## Do's and Don'ts

### Do:
- **Do** set every score, date, salary figure, and count in IBM Plex Mono with tabular numerals.
- **Do** use the `.tear` perforation (dashed rule + punched ends) as the divider between a card's content and its action row, instead of a plain border or shadow.
- **Do** keep jet red reserved for primary actions and the single "live/actionable" signal per view (Today's to-review step, primary buttons, high scores).
- **Do** render closed/rejected pipeline items with the VOID stamp over an intact card — never delete or hide a closed application.
- **Do** use carbon purple only for duplicate-sighting or follow-up-due signals; never as a second brand accent.
- **Do** keep the Unslog logo mark's accent bound to `var(--action)` rather than a fixed hue of its own, so it always matches the live system's accent (see The Living Mark Rule). Confirmed brand commitment per PRODUCT.md.

### Don't:
- **Don't** add a drop shadow anywhere in this system — depth comes from ink borders and the tear perforation, not elevation.
- **Don't** render a "cleared"/good status as a green tag or badge; green is reserved for the Today health-check dots only, and good states are stamped in navy instead (this reverses a defect caught in finish review, not a style to extend further).
- **Don't** mix carbon purple and jet red as competing accents on the same element.
- **Don't** set body prose in Big Shoulders Display or in uppercase; the display face is for labels and headings only.
