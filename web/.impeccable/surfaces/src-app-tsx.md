---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/pages/Today.tsx","src/pages/Jobs.tsx","src/pages/JobDetail.tsx","src/pages/Pipeline.tsx","src/pages/Outreach.tsx","src/pages/Insights.tsx","src/pages/Settings.tsx","src/pages/SignIn.tsx","src/components/Layout.tsx","src/components/ui.tsx"]
---

## Direction contract

THESIS: The dashboard is a frosted pane floating over a slow-drifting colour glow, the same material the sign-in screen introduced — refusing the previous system's flat, ink-bordered "printed ticket" look in favour of one continuous glass surface that the whole app, not just the login screen, sits on.

OWN-WORLD: Neutral ink/paper chrome (near-black text, hairline borders, no hue in UI structure itself) over a faint animated two-colour radial glow (indigo `--action` + magenta `--attention`) that every translucent panel (`backdrop-filter: blur()`) genuinely blurs. Colour is reserved for what must stay scannable: the fit-score fill, visa/attention tags, destructive/good status dots — translating the old system's "jet red is the one accent" rule into "colour only where it encodes data, never as chrome." Geist for all display/body type (replacing the condensed-caps Big Shoulders Display), IBM Plex Mono kept for genuinely tabular figures (scores, dates, salaries) only. Rounded-lg/pill shapes throughout (shadcn `--radius` scale) replacing the old 3–8px ticket-stub corners. The sidebar carries a stronger version of the glow, echoing the sign-in screen's brand treatment; dense content (tables, the Pipeline board, charts) stays calm — glass as a real optical effect, never decoration on a surface with nothing behind it to blur.

STORY: Every page the user already knew — Today's funnel, the Pipeline's lanes, Jobs' filtered list, Insights' charts — renders unchanged in structure and behavior, now as frosted panels over the same ambient glow the sign-in screen uses, with lucide icons in the nav and a shared blur-fade page-entrance transition replacing the old instant swap.

FIRST VIEWPORT: Today page — sidebar glowing faintly behind the nav, a frosted funnel-strip summary, then top-match rows in frosted panels, right rail with follow-ups/sources; identical layout to the incumbent, fully re-skinned.

FORM: Direct continuation of the already-built, already-approved sign-up.tsx/SignIn.tsx world — not a new tournament. User-specified: "same theme as new signin page, change the theme/buttons/animations, keep functionality intact." No concept-seed roll run; this is the precisely-specified-request path.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance. **Note:** no browser tool was available this session to capture screenshots, so the screenshot-based finish-reviewer subagent could not run. DESIGN.md below was written from the built CSS/component code directly; a human visual pass (open the dev server) is the outstanding step before calling this fully finished.
