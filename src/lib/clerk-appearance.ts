/**
 * Theme tokens for Clerk's prebuilt <SignIn>/<SignUp> components, mapped from
 * the Tailwind palette in tailwind.config.js. Plain module (not 'use server')
 * because constants can't live in server-action files.
 *
 * Variable names follow @clerk/nextjs v7 — note `colorInput` (not the
 * deprecated `colorInputBackground`) and `colorPrimaryForeground` (not the
 * deprecated `colorTextOnPrimaryButton`).
 */

export const clerkLightAppearance = {
  variables: {
    colorBackground: '#ffffff',
    colorForeground: '#114867', // ocean-900
    colorPrimary: '#12a8df', // ocean-500
    colorPrimaryForeground: '#ffffff',
    colorInput: '#f8fbfd', // light page ground
    colorInputForeground: '#114867',
    colorMuted: '#cff4ff', // ocean-100
    colorMutedForeground: '#0885c0', // ocean-600
    colorBorder: '#a4e9ff', // ocean-200
    colorDanger: '#dc2626', // red-600, matches the form error styling
    borderRadius: '0.75rem', // rounded-xl, matches the auth-form inputs
    fontFamily: 'Inter, system-ui, sans-serif',
  },
};

export const clerkDarkAppearance = {
  variables: {
    // Where the form pane sits in dark mode: ocean-950/40 over the
    // ocean-900→950 gradient card.
    colorBackground: '#0a3a52',
    colorForeground: '#ecfbff', // ocean-50
    colorPrimary: '#34c4f5', // ocean-400 — the bright dark-mode gradient
    // Dark text on the bright button, same rule as the app's dark-mode
    // gradient buttons (never white on ocean-400).
    colorPrimaryForeground: '#052e44', // ocean-950
    colorInput: '#042d40', // dark body ground
    colorInputForeground: '#ecfbff',
    colorMuted: '#0d577e', // ocean-800
    colorMutedForeground: '#a4e9ff', // ocean-200
    colorBorder: '#114867', // ocean-900
    colorDanger: '#f87171', // red-400, matches dark:error text
    borderRadius: '0.75rem',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
};
