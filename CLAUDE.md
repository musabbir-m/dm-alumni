# CLAUDE.md

## Project Overview

Multi-page alumni network and marketing website for the Disaster Management (DM) students/alumni of **Begum Rokeya University, Rangpur (BRUR)**, Bangladesh.

The project started as a Bolt-generated single-page marketing site (React/Vite). It now runs on Next.js and is being grown into a full alumni network with authentication, profiles, and role-based verification.

## Current Stack

- **Next.js 16 (App Router) + React 19 + TypeScript** — Turbopack by default for dev and build
- **MongoDB via Mongoose 9** (`src/lib/db.ts` cached connection; `src/lib/models/User.ts`) — backend lives in server actions, no Express
- **Cloudinary 2** for file storage (`src/lib/cloudinary.ts`) — registration uploads are streamed to Cloudinary; MongoDB stores only the delivered URLs
- **Clerk (`@clerk/nextjs` v7)** — owns credentials, email verification, password reset, and (when needed) 2FA. Bare `clerkMiddleware()` in `src/proxy.ts` (Next 16's renamed middleware — required for Clerk's server helpers, does **no** route protection: `auth.protect()` in the proxy runtime hits a known Next 16 bug, clerk/javascript#8302, and Clerk is deprecating middleware-level auth checks). `<ClerkProvider>` wraps children in the root layout. Guarded pages call `requireUser()` from `src/lib/auth.ts`. Custom `/sign-in` + `/sign-up` pages render Clerk's prebuilt `<SignIn>`/`<SignUp>` themed via `src/lib/clerk-appearance.ts` + `ThemedAuthForms.tsx` (Clerk follows `prefers-color-scheme` by default; the wrappers pick the palette from `useTheme` to match our class-based dark mode). MongoDB stays the source of truth for role/verificationStatus/profile — no Clerk metadata mirroring, no webhooks (deliberate); profile edit pushes the name one-way to Clerk so the header pill stays fresh. Pre-Clerk Mongo records link lazily by verified email (`findOrLinkUser` in `src/lib/auth.ts`)
- **zod 4** for server-side form validation, **tsx** for scripts
- Tailwind CSS 3 (custom theme — see Design System below)
- lucide-react v1 for icons (brand icons like Twitter/Linkedin/Github were removed in v1 — Footer uses inline SVGs for those)
- App structure:
  - `src/app/layout.tsx` — root layout: `<html>`/`<body>`, metadata, viewport theme-colors, inline no-flash theme script
  - `src/app/page.tsx` — composes the single-page scroll site (Server Component)
  - `src/app/sign-in/[[...sign-in]]/page.tsx` + `src/app/sign-up/[[...sign-up]]/page.tsx` — Clerk prebuilt components (aurora split-card shell; password reset/email verification screens come from Clerk inside them)
  - `src/app/register/page.tsx` + `src/components/CompleteProfileForm.tsx` — step 2 of the two-step registration (Clerk `/sign-up` collects email+password+name → lands here); `completeProfile` server action (`useActionState`), email + name locked from Clerk
  - `src/app/profile/page.tsx` — server-rendered profile (`requireUser()` guard); "Edit profile" CTA links to `/profile/edit`
  - `src/app/profile/edit/page.tsx` + `src/components/ProfileEditForm.tsx` — self-service profile editing via the `updateProfile` server action (email + Student ID are locked identity fields)
  - `src/app/admin/page.tsx` — admin-only member management (`requireAdmin()`): lists all users with summary tiles, a batch filter + name/phone search + verification-status filter (plain GET `<form>` → `searchParams`), and per-row `AdminUserControls`; `/profile` shows admins an "Admin tools" card linking here
  - `src/app/globals.css` — Tailwind layers + custom helpers (was `src/index.css` under Vite)
  - `src/components/` — `Header`, `Hero`, `About`, `Batches`, `Impact`, `Events`, `Connect`, `Footer`, `ThemeToggle`, `ScrollEffects`, `CompleteProfileForm`, `ThemedAuthForms`, `ProfileEditForm`, `UserMenu`, `LogoutButton`, `AdminUserControls`, `UserBadges` (shared `STATUS_STYLES`/`ROLE_LABELS` + `StatusBadge`/`RoleBadge` pills), `form-ui` (shared `Field`/`inputCls`/`iconCls`/`MAX_FILE_MB` for auth forms)
  - `src/hooks/` — `useTheme`, `useReveal`; `src/data/batches.ts` — static batch data
  - `src/lib/` — `db.ts` (Mongoose connect, globalThis-cached), `models/User.ts` (schema + `Role`/`VerificationStatus` types; `clerkId` unique-sparse), `auth.ts` (`requireUser`/`requireAdmin`/`getSessionUser` guards + verified-email lazy link), `clerk-appearance.ts`, `cloudinary.ts` (upload/destroy, configured lazily from `CLOUDINARY_URL`), `uploads.ts` (shared upload rules + `saveUpload`), `profile.ts` (core `applyProfileUpdate`), `admin.ts` (core `setUserRole`/`setUserVerification` — actor-must-be-admin/target-never-self-or-admin guards; promoting stamps the target's own batch into `moderatorBatch`), `actions/register.ts` (`completeProfile`) + `actions/profile.ts` (`updateProfile`) + `actions/admin.ts` (`'use server'`)
  - `src/proxy.ts` — bare `clerkMiddleware()` (see the Clerk bullet above)
- **Client/server split:** `Header`, `Hero`, `Impact`, `Connect`, `ThemeToggle`, `ScrollEffects`, `CompleteProfileForm`, `ThemedAuthForms`, `ProfileEditForm`, `UserMenu`, `LogoutButton`, `AdminUserControls` are `'use client'` (hooks/interactivity). `About`, `Batches`, `Events`, `Footer`, `UserBadges` and all pages/layouts render on the server. Keep new interactive components client-side with `'use client'`; pages/layouts stay server Components.
- Routes: `/` (marketing scroll site), `/sign-in`, `/sign-up` (Clerk), `/register` (complete-profile step, auth-required — anonymous visitors are redirected to `/sign-up`), `/profile` (auth-required), `/profile/edit` (auth-required), `/admin` (admin-only — `requireAdmin()` redirects non-admins to `/`). Home CTAs ("Join the Network", "Become a Member") link to `/register`. `/` stays statically prerendered — `UserMenu` resolves the session client-side via Clerk's `useUser()` rather than `auth()` on the server.

## Remaining Roadmap

- **Batch directory** — logged-in users browse alumni grouped by batch (hide unverified members)
- **Moderator verification UI** — a moderator of batch X sees pending members of batch X and verifies/rejects them (reuse `setUserVerification`'s actor-guard seam: generalize "actor is admin" to "admin or moderator of the target's batch")
- **Route protection via `proxy.ts`** — `src/proxy.ts` exists but only mounts `clerkMiddleware` (required for Clerk); protection stays per-page via `requireUser()`/`requireAdmin()` on purpose (see the Clerk bullet in Current Stack). Revisit only if per-page guards ever feel thin
- `src/data/batches.ts` is still static placeholder data to be replaced by MongoDB-backed data

## Commands

```bash
npm run dev        # next dev — http://localhost:3000
npm run build      # next build (production)
npm run start      # next start (serve the production build)
npm run lint       # ESLint (eslint-config-next, flat config)
npm run typecheck  # tsc --noEmit
npm run seed       # create the first admin record (idempotent) from ADMIN_EMAIL — the matching Clerk user is created in the Clerk dashboard and links on first sign-in
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
- **Static data:** `src/data/batches.ts` holds the 10 real DSM batches (1st–10th, sessions 2011-12 → 2020-21). `year` = session **start** year ('2011'…'2020') and is the value stored in `User.batch`; `session`/`batchNo`/`label`/`motto`/`image`/`count` carry display identity, and `batchName(b)` renders the plain "DSM 8th Batch (Session 2018-19)" label used in dropdowns and the profile. Images and counts are still placeholders to be replaced by MongoDB-backed data. The register + profile actions validate `batch` against this list.
- **Animations:** `src/hooks/useReveal.ts` powers scroll-reveal effects (mounted once via `ScrollEffects`); many Tailwind keyframe animations are defined in `tailwind.config.js` (`aurora`, `marquee`, `glow-pulse`, etc.) and used across components.
- **Auth flow:** Clerk owns credentials + verified email; MongoDB (via `clerkId`) is the source of truth for role/verificationStatus/profile. Two-step registration: `/sign-up` (Clerk: email + password + name, email verified by code) → `/register` (`completeProfile` action requires a **verified** email and creates or lazily links the Mongo record). Pages that need auth use `requireUser()` (`src/lib/auth.ts`) — redirects to `/sign-in` when signed out, `/register` when the Clerk account has no linked Mongo record yet. `findOrLinkUser` also lazily links pre-Clerk records by verified email (how the seeded admin migrates). Use `auth()` from `@clerk/nextjs/server` for cheap claims-only reads (`{ userId }`); `currentUser()` is a Backend API call (rate-limited — only on the link-miss path and in registration); `clerkClient()` for writes. Client-side: `useUser()`/`useClerk()`; `signOut({ redirectUrl: '/' })` (v5+ renamed `callbackUrl` → `redirectUrl`). No self-service email change anywhere in the UI (email is locked in both systems). Clerk actions (`completeProfile`, `updateProfile`) need a request context — they can't be exercised via tsx scripts, only in the browser; `applyProfileUpdate` and `seed.ts` remain tsx-runnable.
- **Server actions:** live in `src/lib/actions/` (`'use server'`). Such files may **only export async functions** — export shared types as `export type` only; constants must live elsewhere. Forms consume them with `useActionState` (`CompleteProfileForm` is the pattern: named inputs, server-returned field errors, `isPending`, success panel instead of a redirect). **Never call `redirect()` inside an action's `try`** — the catch swallows the redirect error; return a success state and let the client navigate. The admin actions (`updateUserRoleAction`/`updateUserVerificationAction`) are the exception to the FormData pattern — they take direct typed args called from `AdminUserControls` via `useTransition` (no per-row inputs), and are the repo's only `revalidatePath('/admin')` users, which re-renders the dashboard (filters included) in the same roundtrip. `next.config.ts` raises `experimental.serverActions.bodySizeLimit` to `'12mb'` for the two 5 MB uploads — keep in sync with `MAX_FILE_MB` in `src/lib/uploads.ts`.
- **Uploads:** photo + verification document uploads are uploaded to Cloudinary folders `dm-alumni/photos` / `dm-alumni/docs` (`src/lib/cloudinary.ts`); the DB stores the delivered `secure_url` (the photo URL gets `f_auto,q_auto` delivery params via `optimizedImageUrl`). Shared rules (size/type caps, folder names, `saveUpload`) live in `src/lib/uploads.ts` — reuse for any new upload surface. If anything fails after an upload succeeded, the action destroys the already-uploaded assets so no orphans accumulate. `public/uploads/` is unused legacy from pre-Cloudinary days. Note: profile/directory images render via plain `<img>` — switching to `next/image` would need `res.cloudinary.com` (and the Pexels hosts) in `images.remotePatterns`.
- **Gotcha (file inputs + server actions):** forms submit what's in the DOM — `useActionState` serializes the form element, and a file reaches the server only if it's still in its `<input type="file">` on submit. **Never clear `input.value` after reading a valid pick** (that also clears `files`, so the upload silently never happens — a real bug we shipped and fixed); only clear it when rejecting an invalid pick or on an explicit discard (via a ref). React `File` state is for preview/validation only.
- **Profile edit:** `src/lib/profile.ts` (`applyProfileUpdate`) holds the core logic outside the `'use server'` boundary so tsx scripts can exercise it directly; `src/lib/actions/profile.ts` (`updateProfile`) is the thin auth wrapper (resolves the Clerk user to its Mongo record via `clerkId`, then best-effort syncs the name back to Clerk). Email and Student ID are identity fields and never accepted from the form. File inputs are optional — absent means keep current. Replaced Cloudinary assets are destroyed **after** `user.save()` succeeds (public_id derived back from the stored URL via `cloudinaryAssetFromUrl`, which strips transform/version segments). Verification status is never reset by text/photo-only edits; a new verification document from a not-yet-verified account resets it to `'pending'` (re-review). Once verified, the document (and its type) is locked — enforced server-side in `applyProfileUpdate` before any upload; only the photo stays editable.
- **Env vars** (`.env.local`, gitignored; see `.env.example`): `MONGODB_URI`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, the four `NEXT_PUBLIC_CLERK_*` route/redirect URLs, `ADMIN_EMAIL`, `CLOUDINARY_URL`. `tsx` scripts don't auto-load `.env.local` — `scripts/seed.ts` parses it manually. **Read env vars lazily** (inside functions, not at module top-level) — see the comment in `db.ts`: ESM imports evaluate before scripts can load `.env.local`, so a module-level read silently falls back to defaults.
- **Verification gating:** registration sets `verificationStatus: 'pending'`; login is allowed while pending (gates directory visibility, not auth). Moderators/admins flip it later.

## Planned Features (acceptance criteria)

1. **Alumni registration** — new alumni can register an account.
2. **Profile** — after login, users land on their profile showing their information, and can edit everything except email and Student ID (`/profile/edit`).
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
