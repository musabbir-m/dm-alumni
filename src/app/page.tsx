import Header from '@/components/Header';
import Hero from '@/components/Hero';
import About from '@/components/About';
import Batches from '@/components/Batches';
import Impact from '@/components/Impact';
import Events from '@/components/Events';
import Connect from '@/components/Connect';
import Footer from '@/components/Footer';
import ScrollEffects from '@/components/ScrollEffects';
import { getVerifiedBatchCounts } from '@/lib/directory';

// ISR — the homepage stays a prerendered shell (no per-user data in it;
// UserMenu resolves the session client-side) and re-fetches the verified
// batch counts at most once a minute. Actions that move verified counts
// (verification decisions, batch-changing profile edits) also call
// revalidatePath('/'). Note: `revalidate` exists only while cacheComponents
// stays OFF in next.config.ts.
export const revalidate = 60;

export default async function Home() {
  // DB outage → null → the Batches cards fall back to the static estimates
  const counts = await getVerifiedBatchCounts().catch(() => null);

  return (
    <div className="min-h-screen bg-[#f8fbfd] text-ocean-900 antialiased dark:bg-ocean-950 dark:text-white">
      <ScrollEffects />
      <Header />
      <main>
        <Hero />
        <About />
        <Batches counts={counts} />
        <Impact />
        <Events />
        <Connect />
      </main>
      <Footer />
    </div>
  );
}
