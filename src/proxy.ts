import { clerkMiddleware } from '@clerk/nextjs/server';

/**
 * Next 16's renamed middleware. Required for Clerk's server helpers
 * (`auth()`/`currentUser()`) to work in server components and actions.
 *
 * Deliberately does NO route protection here — `auth.protect()` in the proxy
 * runtime has a known Next 16 issue (empty sign-in redirect,
 * clerk/javascript#8302) and Clerk is deprecating middleware-level auth
 * checks anyway. Protected pages call `requireUser()` from `src/lib/auth.ts`
 * instead (see the Auth flow note in CLAUDE.md).
 */
export default clerkMiddleware();

export const config = {
  matcher: ['/((?!_next|[^?]*\\.[^?]*$).*)', '/(api|trpc)(.*)'],
};
