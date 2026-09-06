import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DM Alumni Association — Resilience in Every Wave',
  description:
    "The Disaster Management Students' Alumni Association — uniting graduates dedicated to resilience, response, and community.",
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'Disaster Management Alumni Association',
    description: 'Uniting graduates dedicated to resilience, response, and community.',
    images: ['https://bolt.new/static/og_default.png'],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['https://bolt.new/static/og_default.png'],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fbfd' },
    { media: '(prefers-color-scheme: dark)', color: '#042d40' },
  ],
};

// Applied synchronously with the document so the stored/system theme is
// settled before first paint — prevents a light/dark flash on load.
// suppressHydrationWarning on <html> is required because this script adds
// the `dark` class before React hydrates.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var dark = stored
      ? stored === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) { /* storage unavailable — default to light */ }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
