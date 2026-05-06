# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Leseflux is a tablet-optimized web app that trains reading fluency (Leseflüssigkeit) in primary school children (grades 2–4) using **Constant Fading**: words appear and fade at a controlled rate, forcing the child to read at pace. The app adapts each child's target WPM based on quiz performance and periodic diagnostics. The primary language of all UI text and content is **German**.

## Monorepo Structure

```
apps/
  web/        React 18 + TypeScript + Vite (Tailwind CSS)
  api/        Fastify + TypeScript (Prisma ORM, PostgreSQL)
packages/
  shared/     Zod schemas + shared types (source of truth for API boundary types)
nginx/        Reverse-proxy + TLS config
docker-compose.yml
```

`packages/shared` is the authority for all cross-boundary types. Never define types separately in web or api if the type crosses the API.

## Commands

### Development
```bash
docker-compose up -d postgres   # Start local DB only
npm install                     # Install all workspace deps from repo root
npm run db:migrate              # npx prisma migrate dev (runs in apps/api)
npm run db:seed                 # Seed diagnostic items + sample texts
npm run dev                     # Start web (Vite) + api (Fastify) in parallel
```

### Testing
```bash
npm run test                    # Vitest across all workspaces
npm run test -w apps/api        # API unit tests only
npm run test:e2e                # Playwright E2E tests
```

### Build & Type-check
```bash
npm run build                   # Build all packages
npm run lint                    # ESLint across all workspaces
npm run typecheck               # tsc --noEmit across all workspaces
```

### Database
```bash
npm run db:migrate              # Apply pending migrations
npm run db:studio               # Open Prisma Studio
npm run db:seed                 # Seed base data
npm run seed:texts -- ./path.json  # Import text JSON batch file
```

### Docker (production)
```bash
docker-compose up -d            # Start postgres + api + web + nginx
docker-compose build            # Rebuild images
```

## Key Algorithms

### Fading Timing (`packages/shared/src/fading.ts`)
`calculateFadingTiming(targetWpm, word)` — word-length-corrected display/fade durations. 70% of time-per-word is display, 30% is fade-out. Length factor uses `0.6 + 0.4 * Math.sqrt(word.length / 5.5)` to avoid over-penalising long words. Overlapping fade: next word appears as previous fades (no gap).

### Adaptive Engine (`apps/api/src/modules/training/adaptive.ts`)
Runs server-side after every `POST /api/training/finish`. Adjusts `UserProgress.currentTargetWpm` based on `averageQuizAccuracy` over the last 10 sessions. All thresholds are **in `apps/api/src/config.ts`** (not hardcoded) so they can be tuned during pilots:

| Parameter | Default |
|---|---|
| Sessions before WPM change | 5 |
| Accuracy threshold to increase | ≥ 0.70 |
| Accuracy threshold to decrease | < 0.40 |
| WPM step size | ±5 |
| Intermediate diagnostic trigger | every 10 sessions |
| Initial fading WPM | 90 % of diagnostic-estimated WPM |

### LIX Calculation
`LIX = (W/S) + (L × 100) / W` — W = word count, S = sentence count, L = words > 6 chars. Computed on text import; stored as `Text.lixScore`.

### WPM Estimation from Diagnostics
`estimatedWpm = (avgWordsPerSentence × correctCount) / (durationSec / 60)`

## Auth Flow

- **Children**: scan QR → `POST /api/auth/login-child` → backend SHA-256 hashes token → looks up `users.qrTokenHash` → JWT (24 h) as HTTP-only cookie + body
- **Teachers**: email + password → `POST /api/auth/login-teacher` → argon2 verify → JWT (8 h)
- **Anton integration**: QR content is used as an opaque unique string only. No connection to Anton servers, ever.
- **CSRF protection** on all state-changing routes; **Helmet.js** for security headers; **rate limiting** 10/min on login endpoints.

## Frontend Architecture (`apps/web`)

- **Route trees**: `/child/*`, `/teacher/*`, `/admin/*` — each with its own layout and auth guard
- **State**: TanStack Query for server state; Zustand for local UI state (active session, LRS settings, font size)
- **Fading Reader**: core training component — renders words one at a time using CSS opacity transitions from `calculateFadingTiming()`; supports pause/resume; no other animations run during training
- **LRS mode**: OpenDyslexic font toggle + optional syllable colouring using `hyphen` library with `hyphen-de` dictionary; odd syllables colour A, even syllables colour B
- **QR scanning**: `html5-qrcode` library on the child login screen

## UI Conventions

- **Fonts**: Atkinson Hyperlegible (default), OpenDyslexic (LRS toggle)
- **Colours**: Primary `#3674B5`, Success `#578E7E`, Background `#FBF8EF` (cream — not pure white), Warning `#E97A0C`
- **Touch targets**: minimum 56 × 56 px buttons
- **Child UI**: positive-only feedback — never "Falsch", always "Schau noch mal genau hin!"
- **Teacher UI**: dense, factual data presentation; no gamification elements

## Text Import Format

```json
{
  "title": "Der Drache im Garten",
  "content": "Mia lief durch den Garten...",
  "targetLevel": 2,
  "questions": [
    { "question": "Wo läuft Mia?", "options": ["Im Garten", "Im Wald", "Am Strand"], "correctIndex": 0 }
  ]
}
```

Run `npm run seed:texts -- ./texte/klasse-2.json`. LIX is computed automatically. Minimum 30 texts per grade level (90 total).

## DSGVO / Privacy

Critical for this children's app:
- Children have **display names only** (Spitznamen) — no surname, no real name required
- QR tokens stored as SHA-256 hash only
- All IDs are UUIDs
- Before creating a child account, teacher **must** confirm parental consent (checkbox + timestamp written to audit log)
- Data export: JSON per child (Art. 15), CSV (Art. 20)
- No third-party trackers, no analytics SDKs, no CDN-loaded fonts (self-host all assets)
- Logs must not contain personally identifiable data

## Development Phases

| Phase | Scope |
|---|---|
| **1 – MVP** | Data model, auth, class management, fading reader (fixed WPM), quiz, session history for teacher |
| **2 – Adaption** | Entry/intermediate diagnostics, adaptive engine, progress charts in teacher dashboard |
| **3 – LRS & Inhalt** | OpenDyslexic, syllable colouring, font size/contrast settings, teacher text upload UI |
| **4 – Skalierung** | Gamification (stars, streaks, collectibles), CSV/GDPR export, QR-code PDF generator, optional 2FA |

Implement phase by phase. Each phase should be a coherent PR/commit set. Do not begin the next phase until the current one meets its acceptance criteria.

## Testing Strategy

- **Vitest**: fading algorithm, adaptive engine, LIX calculation, auth utilities — pure logic tests, no DB required
- **Playwright** (critical paths only): child QR login → session → quiz; teacher login → class overview; entry diagnostic flow

## Open Questions (resolve before implementing)

1. Exact Anton QR-code string format (verify against a real ID card before implementing the hash lookup)
2. LIX thresholds per grade level (empirical validation needed)
3. Sound effects: on/off toggle? (default: off)
4. PWA / offline support (recommended for Phase 4)
5. Multi-tenant vs single-tenant (recommendation: single-tenant per server instance for MVP)
