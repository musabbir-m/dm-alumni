import { Waves, Mail, ArrowUp, Heart } from 'lucide-react';
import { GithubIcon, LinkedinIcon, TwitterIcon } from '@/components/BrandIcons';

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
