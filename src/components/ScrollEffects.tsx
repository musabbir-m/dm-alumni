'use client';

import { useEffect, useState } from 'react';
import { useReveal } from '@/hooks/useReveal';

function ScrollProgress() {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setWidth(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return <div id="scroll-progress" style={{ width: `${width}%` }} />;
}

/**
 * Page-level client effects: the reading-progress bar and the scroll-reveal
 * observer for every `.reveal` element on the page.
 */
export default function ScrollEffects() {
  useReveal();

  return <ScrollProgress />;
}
