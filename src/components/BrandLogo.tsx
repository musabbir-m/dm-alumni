import Link from 'next/link';
import Image from 'next/image';
import Logo from '../../public/Logo.jpeg';

/**
 * Logo chip + two-line site name — the homepage header's brand block,
 * rendered identically in every page's top bar. Directive-free (no hooks,
 * no 'use client') so the client Header and the server pages import the
 * same markup. `href` defaults to '/'; the homepage header passes '#top'.
 */
export default function BrandLogo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5">
      <span className="relative flex items-center justify-center rounded-xl bg-gradient-to-br from-ocean-500 to-reef-500 shadow-lg shadow-ocean-400/40 transition-transform group-hover:scale-105 group-hover:rotate-3">
        <Image
          src={Logo}
          alt="Disaster Management Alumni Association logo"
          width={60}
          height={60}
          priority
        />
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-[18px] font-bold tracking-tight text-ocean-900 dark:text-white">
          Disaster Management
        </span>
        <span className="text-[14px] font-medium tracking-wide text-ocean-500 dark:text-ocean-300">
          Alumni Association
        </span>
      </span>
    </Link>
  );
}
