# AqlBand Reaksiya

A premium Telegram Mini App reaction-speed game, built by the **AqlBand** team.

Watch the signal, tap the instant it turns green, and see how your reflexes stack up — then challenge a friend to beat your time, right inside Telegram.

Bot: **[@aqlband_reaksiya_bot](https://t.me/aqlband_reaksiya_bot)**

---

## Stack

| Layer        | Choice                                                            |
| ------------ | ------------------------------------------------------------------ |
| Language     | TypeScript (strict)                                                |
| UI           | React 18 + Tailwind CSS + Framer Motion                            |
| Routing      | React Router (browser mode — see note below)                       |
| State        | Zustand (small, dependency-light, no boilerplate)                  |
| i18n         | i18next / react-i18next, with `i18next-browser-languagedetector`   |
| Build        | Vite 6                                                              |
| Platform     | Telegram Mini Apps (native `telegram-web-app.js` bridge)           |
| Hosting      | Cloudflare Pages (static SPA)                                      |

No backend is required to run the app. All progress (attempt history, best time,
settings) is stored locally via Telegram `CloudStorage` when available, and
falls back to `localStorage` in a plain browser. Friend challenges are encoded
directly into the Telegram deep-link `startapp` parameter — no server round
trip needed to compare two results.

### Why `BrowserRouter`, not `HashRouter`

Telegram passes Mini App launch data (`tgWebAppData`, `tgWebAppStartParam`,
etc.) in the URL **hash fragment**. A `HashRouter` would consume that
fragment for its own routing and silently break challenge deep links. This
app uses `BrowserRouter` and relies on `public/_redirects` for the SPA
fallback on Cloudflare Pages.

---

## Getting started

```bash
npm install
npm run dev
```

Vite serves on `http://localhost:5173`. The Telegram bridge script
(`telegram-web-app.js`) loads regardless of environment; when the app isn't
actually opened inside Telegram, every bridge call in `src/lib/telegram.ts`
degrades gracefully (haptics/no-ops, storage falls back to `localStorage`,
user is `null` → UI shows the guest greeting).

### Previewing inside Telegram during development

Telegram Mini Apps must be served over HTTPS. Point a tunnel at your local
dev server and register that URL with [@BotFather](https://t.me/BotFather)
(`/setmenubutton` or `/newapp`):

```bash
# example using cloudflared
cloudflared tunnel --url http://localhost:5173
```

### Scripts

```bash
npm run dev         # start local dev server
npm run build        # type-check + production build to dist/
npm run preview      # preview the production build locally
npm run lint          # ESLint
npm run typecheck    # tsc --noEmit only
```

---

## Project structure

```
src/
├── app/                 # App shell: router, boot sequence
│   └── App.tsx
├── components/
│   ├── ui/               # Generic primitives: Button, Card, StatCard, icons
│   ├── layout/            # Screen wrapper, TopBar
│   └── game/               # Game-specific UI: SignalDisc, CompareCard
├── features/
│   └── game/               # Pure game logic + state machine hook
│       ├── logic.ts          # timing constants, tiers, percentile, formatting
│       └── useReactionGame.ts
├── screens/               # One component per route
│   ├── HomeScreen.tsx
│   ├── PlayScreen.tsx
│   ├── ResultScreen.tsx
│   └── SettingsScreen.tsx
├── store/                 # Zustand stores
│   ├── statsStore.ts        # attempt history + derived stats, persisted
│   ├── settingsStore.ts     # language / sound / haptics, persisted
│   └── challengeStore.ts    # incoming deep-link challenge decode/consume
├── i18n/
│   ├── index.ts             # i18next setup, language normalization
│   └── locales/{uz,en,ru}.json
├── lib/
│   ├── telegram.ts          # Telegram WebApp bridge wrapper (the one place
│   │                          that touches `window.Telegram`)
│   ├── sound.ts              # WebAudio-synthesized SFX, no audio assets
│   └── config.ts             # bot username, app version
├── hooks/
│   ├── useTelegramUser.ts
│   └── useTelegramBackButton.ts
├── types/
│   ├── index.ts               # domain types (Attempt, GamePhase, ...)
│   └── telegram-webapp.d.ts   # ambient typing for window.Telegram.WebApp
└── styles/index.css
```

### Design system

Colors, type scale, radii, and animation tokens are defined once in
`tailwind.config.ts` under the `ink` / `violet` / `gold` / `signal` / `mist`
palettes — the dark‑purple/gold identity shared across the AqlBand product
family. Display type is **Space Grotesk**, body text is **Inter**, and
numeric/timer readouts use **JetBrains Mono** for a precision-instrument feel
that fits a reaction-timing game.

The signature UI element is the **signal disc** (`components/game/SignalDisc.tsx`):
a single circle that is the entire game — idle/armed in deep violet, a sharp
green flash on "go", red on a false start, and the result rendered directly
inside it. It's reused as the pulsing brand mark on the home screen too.

---

## Game flow

```
Home → Play → (random 1.5–4.2s delay) → Signal → Tap → Result
                                                    ↓
                                          Share Challenge (Telegram share sheet)
                                                    ↓
                                      Friend opens deep link → Play → Result
                                                    ↓
                                             Compare Result (head-to-head)
```

- **False start** (tap during countdown) and **timeout** (no tap within 3s of
  the signal) are both handled as distinct states with a retry CTA — never a
  silent failure.
- Reaction time is measured with `performance.now()` for sub‑millisecond
  timer resolution independent of render timing.
- A completed run is saved to the local attempt history immediately, and the
  Result screen is told whether it's a new personal best via router state.

### Challenge deep links

Sharing encodes the challenger's time and name into a compact `startapp`
payload (`c-<timeMs>-<base64url-name>[-<userId>]`), built and parsed in
`src/store/challengeStore.ts`. Telegram enforces a limited charset and length
on `startapp`, so the payload is intentionally minimal — no server, no
database, just enough to render a head‑to‑head comparison the moment the
friend finishes their own attempt.

---

## Localization

Default language is **Uzbek**, matching the Telegram client's reported
`language_code` on first launch (`src/lib/telegram.ts` →
`getTelegramLanguageCode`), then persisted so a manual override in Settings
always wins on subsequent launches. Uzbek, English, and Russian are fully
translated with no hardcoded UI strings — every label goes through
`react-i18next`. Add a language by dropping a new file in
`src/i18n/locales/` and registering it in `src/i18n/index.ts`.

---

## Deployment — Cloudflare Pages

1. Push this repository to GitHub.
2. In Cloudflare Pages, create a new project from the repo.
3. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** 20 (set `NODE_VERSION=20` in project environment variables if needed)
4. Deploy. `public/_redirects` handles SPA client-side routing and
   `public/_headers` sets a CSP that explicitly allows Telegram to frame the
   app (`frame-ancestors https://web.telegram.org https://telegram.org`).
5. In [@BotFather](https://t.me/BotFather), point the Mini App's Web App URL
   at your `*.pages.dev` domain (or a custom domain attached to the Pages
   project).

No environment variables or secrets are required for this static frontend.
`wrangler.toml` is included for parity if you prefer deploying via the
Wrangler CLI (`npx wrangler pages deploy dist`).

---

## Extending the app

- **Leaderboards / server-verified scores** — the app is intentionally
  frontend-only today. To add a backend, verify `initData` (HMAC signature,
  documented by Telegram) server-side before trusting any submitted score,
  and swap `statsStore`'s local persistence for API calls behind the same
  interface.
- **New games under the AqlBand brand** — the `ink` / `violet` / `gold`
  tokens in `tailwind.config.ts` are meant to be shared; copy this repo's
  structure (`features/<game>/`, a screens folder, the same Telegram bridge
  layer) to keep a consistent look across the product family.
- **Achievements / streaks** — `statsStore` already retains the last 50
  attempts (`MAX_HISTORY`), enough to derive streaks or day-over-day trends
  without any backend.

---

## License

Proprietary — © AqlBand. All rights reserved.
