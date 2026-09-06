import Header from '@/components/Header';
import Hero from '@/components/Hero';
import About from '@/components/About';
import Batches from '@/components/Batches';
import Impact from '@/components/Impact';
import Events from '@/components/Events';
import Connect from '@/components/Connect';
import Footer from '@/components/Footer';
import ScrollEffects from '@/components/ScrollEffects';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f8fbfd] text-ocean-900 antialiased dark:bg-ocean-950 dark:text-white">
      <ScrollEffects />
      <Header />
      <main>
        <Hero />
        <About />
        <Batches />
        <Impact />
        <Events />
        <Connect />
      </main>
      <Footer />
    </div>
  );
}
