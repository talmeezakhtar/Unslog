# The dashboard

A React 19 + TypeScript single-page app built with Vite. It talks straight to Supabase: auth
through Supabase Auth, data through Supabase's REST API, with Row Level Security deciding what
each user can read and write.

## Pages

| Route | Page | What you do there |
| --- | --- | --- |
| `/` | Today | Morning summary: funnel, top matches, follow-ups due, source health |
| `/jobs` | Jobs | Search and filter every matched job; dismiss or restore |
| `/jobs/:id` | Job detail | Why it fits, description, drafts (edit and copy), people at the company, application status, notes, interviews |
| `/pipeline` | Pipeline | Board of your applications by stage; change stage from each card |
| `/outreach` | Outreach | Write and log messages to contacts; mark replies |
| `/insights` | Insights | Skills in demand, active companies, jobs per week, salary ranges, your funnel, reply rates |
| `/settings` | Settings | Profile, filter rules, target companies, Jooble searches, digest, source health |

## Code layout

```
web/src/
├── main.tsx, App.tsx      # auth gate + routes
├── lib/
│   ├── supabase.ts        # the client (anon key)
│   ├── api.ts             # EVERY query the app makes
│   ├── types.ts           # row shapes, mirroring the migration
│   ├── router.tsx         # ~60-line History API router
│   ├── hooks.tsx          # useAsync (load + reload), toasts, useAction (busy/error state)
│   └── format.ts          # dates, labels
├── components/            # Layout, Score tile, JobRow, ChipInput, charts
├── pages/                 # one file per route
└── styles/tokens.css      # colours, type, spacing: restyle the app here
```

Rules the code follows:

- **All data access is in `lib/api.ts`.** Pages call functions, never `supabase.from(...)` directly.
- **Reads never filter by user.** RLS does it. Writes set `user_id` explicitly, and RLS rejects
  any row that isn't yours.
- **Every async action shows busy and error states** (`useAction`), and success shows a toast
  that names what happened ("Marked as applied").

## Design

The visual design starts from the wireframes and leaves room for your own design pass:

- **Tokens.** Every colour, font, size, space and radius is a CSS variable in
  `styles/tokens.css`, with a dark-mode set under `prefers-color-scheme: dark`.
- **One bold element: the score tile.** Its fill rises with the score. Everything else is quiet.
- **Colour has meaning.** Teal (`--action`) for things you do (Review, Mark as applied, Copy).
  Amber (`--attention`) for things that need you (follow-ups due, "UAE residents only").
- **Type.** Bricolage Grotesque for headings, Atkinson Hyperlegible for body text.
- **Accessibility.** Real buttons and labels, 44 px touch targets, visible focus, status messages
  announced to screen readers, charts with text values and a table view, and layouts that stack
  on a phone.

## Charts

Hand-rolled SVG in `components/charts.tsx`, no chart library:

- `HBarChart`: magnitude by category (skills, funnel, reply rate).
- `ColumnChart`: one value per week.
- `RangeChart`: low–high salary per title, drawn as whiskers with a midpoint.

Each mark has a hover tooltip on a larger hit area. Values are printed as text, so nothing relies
on colour or hover alone. The two series colours (`--chart-1`, `--chart-2`) were checked for
colour-blind separation and contrast in both light and dark mode.

## Running locally

```bash
npm run dev        # http://localhost:5173, reads VITE_SUPABASE_* from the repo-root .env
npm run build      # typecheck + production build into web/dist
```

## Ideas for your own design pass

- A proper logo and brand colour in `tokens.css`.
- A first-run onboarding flow: upload CV → auto-fill profile → connect sources.
- Keyboard shortcuts on Today (J/K to move, A to mark applied, D to dismiss).
- Drag and drop on the Pipeline board, keeping the stage menu for keyboard users.
