'use client';

import { useEffect, useState } from 'react';
import { Waves, Menu, X } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

const navLinks = [
  { label: 'About', href: '#about' },
  { label: 'Batches', href: '#batches' },
  { label: 'Impact', href: '#impact' },
  { label: 'Events', href: '#events' },
  { label: 'Connect', href: '#connect' },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const sections = navLinks.map((l) => l.href.replace('#', ''));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'glass border-b border-ocean-200/50 shadow-lg shadow-ocean-200/20 dark:border-ocean-800/60 dark:shadow-ocean-950/30'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <a href="#top" className="group flex items-center gap-2.5">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-ocean-500 to-reef-500 shadow-lg shadow-ocean-400/40 transition-transform group-hover:scale-105 group-hover:rotate-3">
            <Waves className="h-5 w-5 text-white" strokeWidth={2.2} />
            <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-ocean-400 to-reef-400 opacity-0 blur-md transition-opacity group-hover:opacity-60" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-base font-bold tracking-tight text-ocean-900 dark:text-white">
              DM Alumni
            </span>
            <span className="text-[11px] font-medium tracking-wide text-ocean-500 dark:text-ocean-300">
              Disaster Management
            </span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => {
            const isActive = activeSection === link.href.replace('#', '');
            return (
              <a
                key={link.href}
                href={link.href}
                className={`relative rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-ocean-900 dark:text-white'
                    : 'text-ocean-700 hover:text-ocean-900 dark:text-ocean-100/80 dark:hover:bg-white/5 dark:hover:text-white'
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-gradient-to-r from-ocean-500 to-reef-500" />
                )}
              </a>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle />
          <a
            href="#connect"
            className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-ocean-500 to-reef-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-ocean-400/40 transition-all hover:shadow-reef-400/40 hover:brightness-110 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-900/40 dark:hover:shadow-reef-500/30"
          >
            <span className="relative z-10">Join the Network</span>
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </a>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-ocean-800 transition-colors hover:bg-ocean-100 dark:text-white dark:hover:bg-white/10"
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`overflow-hidden glass border-t border-ocean-200/50 transition-all duration-300 dark:border-ocean-800/40 dark:bg-ocean-950/95 dark:backdrop-blur-xl lg:hidden ${
          open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <nav className="flex flex-col gap-1 px-5 py-4">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-3 text-sm font-medium text-ocean-700 transition-colors hover:bg-ocean-100 hover:text-ocean-900 dark:text-ocean-100/90 dark:hover:bg-white/5 dark:hover:text-white"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#connect"
            onClick={() => setOpen(false)}
            className="mt-2 rounded-xl bg-gradient-to-r from-ocean-500 to-reef-500 px-4 py-3 text-center text-sm font-semibold text-white dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950"
          >
            Join the Network
          </a>
        </nav>
      </div>
    </header>
  );
}
