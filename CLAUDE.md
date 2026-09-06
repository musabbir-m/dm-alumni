# CLAUDE.md

## Project Overview

Multi-page alumni network and marketing website for the Disaster Management (DM) students/alumni of **Begum Rokeya University, Rangpur (BRUR)**, Bangladesh.

The project started as a Bolt-generated single-page marketing site (React/Vite). It now runs on Next.js and is being grown into a full alumni network with authentication, profiles, and role-based verification.

## Current Stack

- **Next.js 16 (App Router) + React 19 + TypeScript** — Turbopack by default for dev and build
- **MongoDB via Mongoose 9** (`src/lib/db.ts` cached connection; `src/lib/models/User.ts`) — backend lives in server actions, no Express
- **Auth.js v5 (`next-auth@5.0.0-beta.32`)** — Credentials provider, JWT sessions, `src/auth.ts` + `src/app/api/auth/[...nextauth]/route.ts` + `src/types/next-auth.d.ts`
- **zod 4** for server-side form validation, **bcryptjs** for password hashing (explicit at call sites, no model hooks), **tsx** for scripts
- Tailwind CSS 3 (custom theme — see Design System below)
- lucide-react v1 for icons (brand icons like Twitter/Linkedin/Github were removed in v1 — Footer uses inline SVGs for those)
- App structure:
  - `src/app/layout.tsx` — root layout: `<html>`/`<body>`, metadata, viewport theme-colors, inline no-flash theme script
  - `src/app/page.tsx` — composes the single-page scroll site (Server Component)
  - `src/app/login/page.tsx` + `src/components/LoginForm.tsx` — credentials login (client `signIn`, redirect to `/profile`)
  - `src/app/register/page.tsx` + `src/components/RegisterForm.tsx` — registration via the `register` server action (`useActionState`)
  - `src/app/profile/page.tsx` — server-rendered profile (`await auth()`; redirects to `/login` when signed out)
  - `src/app/api/auth/[...nextauth]/route.ts` — Auth.js route handlers
  - `src/app/globals.css` — Tailwind layers + custom helpers (was `src/index.css` under Vite)
  - `src/components/` — `Header`, `Hero`, `About`, `Batches`, `Impact`, `Events`, `Connect`, `Footer`, `ThemeToggle`, `ScrollEffects`, `RegisterForm`, `LoginForm`, `UserMenu`, `LogoutButton`, `form-ui` (shared `Field`/`inputCls`/`iconCls` for auth forms)
  - `src/hooks/` — `useTheme`, `useReveal`; `src/data/batches.ts` — static batch data
  - `src/lib/` — `db.ts` (Mongoose connect, globalThis-cached), `models/User.ts` (schema + `Role`/`VerificationStatus` types), `actions/register.ts` (`'use server'`)
- **Client/server split:** `Header`, `Hero`, `Impact`, `Connect`, `ThemeToggle`, `ScrollEffects`, `RegisterForm`, `LoginForm`, `UserMenu`, `LogoutButton` are `'use client'` (hooks/interactivity). `About`, `Batches`, `Events`, `Footer` and all pages/layouts render on the server. Keep new interactive components client-side with `'use client'`; pages/layouts stay server Components.
- Routes: `/` (marketing scroll site), `/register` (alumni registration), `/login`, `/profile` (auth-required). Home CTAs ("Join the Network", "Become a Member") link to `/register`. `/` stays statically prerendered — `Header`/`UserMenu` read the session client-side via `fetch('/api/auth/session')` rather than `auth()` on the server.

## Remaining Roadmap

- **Batch directory** — logged-in users browse alumni grouped by batch (hide unverified members)
- **Moderator verification UI** — a moderator of batch X sees pending members of batch X and verifies/rejects them
- **Admin user management** — admins see all users, promote moderators
- **Route protection via `proxy.ts`** (Next 16's renamed middleware) if client-side gating ever feels thin
- Swap local `public/uploads/` storage for cloud storage (S3/Cloudinary) when deploying
- `src/data/batches.ts` is still static placeholder data to be replaced by MongoDB-backed data

## Commands

```bash
npm run dev        # next dev — http://localhost:3000
npm run build      # next build (production)
npm run start      # next start (serve the production build)
npm run lint       # ESLint (eslint-config-next, flat config)
npm run typecheck  # tsc --noEmit
npm run seed       # create the first admin (idempotent) from ADMIN_EMAIL/ADMIN_PASSWORD
```

Run `npm run lint` and `npm run typecheck` after changes; there is no test suite. The three remaining `<img>` warnings are known (remote Pexels images in Hero/Batches); switching to `next/image` would need `images.remotePatterns` config — do it as a deliberate change if wanted.

## Architecture Notes

- **Path alias:** `@/` → `src/` (configured in `tsconfig.json` — Next.js manages this file and `next-env.d.ts`; don't hand-maintain generated entries).
- **Next.js 16:** breaking changes vs. older training data — async request APIs, `middleware`→`proxy` rename, Turbopack default. The bundled docs at `node_modules/next/dist/docs/` are authoritative; the agent-rules block at the bottom of this file is maintained by `next dev`.
- **Dark mode:** class-based (`darkMode: 'class'` in `tailwind.config.js`). A former standalone dark-theme variant was merged into the main components as `dark:` variants and then deleted — do not recreate it. Theme mechanics:
  - `src/hooks/useTheme.ts` — module-level external store consumed via `useSyncExternalStore`; toggles the `dark` class on `<html>` and persists to `localStorage('theme')`. The server snapshot is `null` (renders the light-mode toggle) and syncs after hydration — never read `localStorage`/`document` during render.
  - `src/components/ThemeToggle.tsx` — Sun/Moon button (rendered in the Header, desktop and mobile).
  - An inline script in `src/app/layout.tsx` (first child of `<body>`) applies the stored/system theme before first paint (no flash). `<html>` needs `suppressHydrationWarning` for this. Default is the OS `prefers-color-scheme`.
  - Custom CSS helpers (`.glass`, `.bg-grid`, `.bg-dots`, `.text-gradient`, scrollbar) have `html.dark` overrides in `src/app/globals.css`; style new components with `dark:` Tailwind variants, not separate dark components.
  - **Gotcha:** `.text-gradient` relies on `background-clip: text` + transparent fill. Its dark override must set `background-image` only — using the `background` shorthand resets `background-clip` to `border-box` at the override's higher specificity, painting the gradient as a solid block that hides the text.
- **Static data:** `src/data/batches.ts` holds batch info (year, label, motto, image, count) for 2018–2023. This is placeholder data to be replaced by MongoDB-backed data. The register action validates `batch` against this list.
- **Animations:** `src/hooks/useReveal.ts` powers scroll-reveal effects (mounted once via `ScrollEffects`); many Tailwind keyframe animations are defined in `tailwind.config.js` (`aurora`, `marquee`, `glow-pulse`, etc.) and used across components.
- **Auth flow:** Credentials login (`src/auth.ts`) → JWT session carrying `id`/`role`/`verificationStatus` → surfaced on `session.user` via `src/types/next-auth.d.ts`. `authorize` returns only identity (the profile page re-reads the full record by id). Pages that need auth use `const session = await auth()` + `redirect('/login')` — this makes them dynamic, which is correct.
- **Server actions:** live in `src/lib/actions/` (`'use server'`). Such files may **only export async functions** — export shared types as `export type` only; constants must live elsewhere. Forms consume them with `useActionState` (`RegisterForm` is the pattern: named inputs, server-returned field errors, `isPending`, success state cleared by remounting an inner component via a key bump). `next.config.ts` raises `experimental.serverActions.bodySizeLimit` to `'12mb'` for the two 5 MB uploads — keep in sync with `MAX_FILE_MB` in `register.ts`.
- **Uploads:** `public/uploads/{photos,docs}/` (gitignored), written as `<uuid>.<ext>` by `register.ts`; DB stores public URL paths. Cloud storage swap is a future item.
- **Env vars** (`.env.local`, gitignored; see `.env.example`): `MONGODB_URI`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. `tsx` scripts don't auto-load `.env.local` — `scripts/seed.ts` parses it manually.
- **Gotcha:** TS module augmentation does **not** follow `export *` re-exports — `declare module 'next-auth/jwt'` silently no-ops (its types are `export * from '@auth/core/jwt'`). Augment `@auth/core/jwt` instead; augmenting `next-auth` works because its re-exports are named.
- **Verification gating:** registration sets `verificationStatus: 'pending'`; login is allowed while pending (gates directory visibility, not auth). Moderators/admins flip it later.

## Planned Features (acceptance criteria)

1. **Alumni registration** — new alumni can register an account.
2. **Profile** — after login, users land on their profile showing their information.
3. **Batch directory** — logged-in users can browse all alumni grouped by batch.
4. **Moderator role** — a moderator sees one specific batch and verifies whether a member is a known/genuine student.
5. **Admin role** — an admin can see all users/alumni.

Role model: `alumni` < `moderator` (per-batch) < `admin` (global). Design schemas and UI with these three roles in mind.

## Design System

Tailwind theme tokens in `tailwind.config.js`:

- **Colors:** `ocean` (primary blues), `reef` (teal accent), `sand`, `clay` (warm accents). Light ground: `bg-[#f8fbfd]` with `text-ocean-900`; dark ground: `bg-ocean-950` / body `#042d40` with `text-white` and `ocean-100` body text.
- **Fonts:** `font-display` = Sora, `font-sans` = Inter (loaded via `@import` in `globals.css`).
- Brand gradient: `from-ocean-500 to-reef-500` with white text; in dark mode the gradient brightens (`from-ocean-400` / `from-reef-500`) and the text switches to `dark:text-ocean-950` for contrast — never leave white text on the bright dark-mode gradients.

Match the existing visual language (glass headers, gradient buttons, scroll-reveal sections) when adding new pages/components.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
