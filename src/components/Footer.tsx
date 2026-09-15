import { Waves, Mail, ArrowUp, Heart } from 'lucide-react';

// lucide-react v1 dropped brand icons — inline SVG glyphs instead
type BrandIconProps = { className?: string };

function LinkedinIcon({ className }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
    </svg>
  );
}

function TwitterIcon({ className }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}

function GithubIcon({ className }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

const footerLinks = {
  Association: ['About Us', 'Our Cohorts', 'Impact Report', 'Constitution'],
  Members: ['Join the Network', 'Mentorship', 'Job Board', 'Member Directory'],
  Resources: ['Research Archive', 'Field Manuals', 'Newsletter', 'Photo Gallery'],
  Connect: ['Events', 'Contact', 'Social Media', 'Alumni Awards'],
};

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-ocean-950 border-t border-ocean-800/50">
      {/* Aurora glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-0 h-64 w-64 rounded-full bg-ocean-500/10 blur-[100px] animate-aurora" />
        <div className="absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-reef-500/10 blur-[100px] animate-aurora-slow" />
      </div>
      <div className="absolute inset-0 bg-grid-dark opacity-20" />

      <div className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2">
            <a href="#top" className="group flex items-center gap-2.5">
              <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-ocean-500 to-reef-500 shadow-lg transition-transform group-hover:scale-105 group-hover:rotate-3">
                <Waves className="h-5 w-5 text-white" strokeWidth={2.2} />
              </span>
              <span className="flex flex-col leading-none">
                <span className="font-display text-base font-bold text-white">DM Alumni</span>
                <span className="text-[11px] font-medium tracking-wide text-ocean-400">
                  Disaster Management
                </span>
              </span>
            </a>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-ocean-300/60">
              The Disaster Management Students&apos; Alumni Association — uniting
              graduates dedicated to resilience, response, and community across
              ten cohorts and counting.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {[
                { icon: Mail, href: 'mailto:alumni@dmassociation.org', label: 'Email' },
                { icon: LinkedinIcon, href: '#', label: 'LinkedIn' },
                { icon: TwitterIcon, href: '#', label: 'Twitter' },
                { icon: GithubIcon, href: '#', label: 'GitHub' },
              ].map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="group flex h-10 w-10 items-center justify-center rounded-lg border border-ocean-800 bg-ocean-900/40 text-ocean-300 transition-all hover:border-reef-400/60 hover:text-reef-300 hover:bg-reef-500/10"
                >
                  <social.icon className="h-4 w-4 transition-transform group-hover:scale-110" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-display text-sm font-semibold text-white">{title}</h4>
              <ul className="mt-4 space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="group/link inline-flex items-center text-sm text-ocean-300/60 transition-colors hover:text-reef-300"
                    >
                      <span className="mr-0 h-px w-0 bg-reef-400 transition-all duration-300 group-hover/link:mr-2 group-hover/link:w-3" />
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-ocean-800/50 pt-8 sm:flex-row">
          <p className="text-xs text-ocean-400/50">
            &copy; {new Date().getFullYear()} Disaster Management Students&apos; Alumni Association. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-xs text-ocean-400/50">
              Built with <Heart className="h-3 w-3 fill-reef-400 text-reef-400" /> for resilience
            </span>
            <a
              href="#top"
              className="group inline-flex items-center gap-2 rounded-lg border border-ocean-800 px-4 py-2 text-xs font-semibold text-ocean-200 transition-all hover:border-reef-400/60 hover:text-reef-300 hover:bg-reef-500/10"
            >
              Back to top
              <ArrowUp className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
