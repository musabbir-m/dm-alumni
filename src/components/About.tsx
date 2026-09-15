import { ShieldCheck, HeartHandshake, Globe2, BookOpen, Quote } from 'lucide-react';

const values = [
  {
    icon: ShieldCheck,
    title: 'Preparedness',
    desc: 'We equip communities before disaster strikes — training, drills, and risk literacy that save lives.',
  },
  {
    icon: HeartHandshake,
    title: 'Compassion',
    desc: 'Every response begins with empathy. We serve the most vulnerable with dignity and respect.',
  },
  {
    icon: Globe2,
    title: 'Global Reach',
    desc: 'Our alumni serve across continents — from urban flood zones to remote earthquake-affected valleys.',
  },
  {
    icon: BookOpen,
    title: 'Lifelong Learning',
    desc: 'We share research, field experience, and innovations so each cohort builds on the last.',
  },
];

export default function About() {
  return (
    <section id="about" className="relative overflow-hidden bg-white py-24 dark:bg-ocean-950 sm:py-32">
      <div className="absolute inset-0 bg-dots opacity-40 dark:opacity-20" />
      <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-ocean-100/40 blur-[100px] animate-pulse-slow dark:bg-reef-600/10" />
      <div className="absolute -right-40 bottom-20 h-96 w-96 rounded-full bg-reef-100/40 blur-[100px] animate-pulse-slow dark:bg-ocean-500/10" style={{ animationDelay: '2s' }} />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          {/* Left: narrative */}
          <div className="reveal">
            <span className="inline-flex items-center gap-2 rounded-full border border-reef-300/60 bg-reef-50/80 px-4 py-1.5 text-xs font-semibold tracking-wide text-reef-700 backdrop-blur-sm dark:border-reef-700/40 dark:bg-reef-900/30 dark:text-reef-300">
              Our Story
            </span>
            <h2 className="mt-5 font-display text-3xl font-bold leading-tight tracking-tight text-ocean-900 dark:text-white sm:text-4xl lg:text-5xl text-balance">
              From classroom to crisis zone —{' '}
              <span className="text-gradient">a bond that never breaks</span>
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-ocean-700/80 dark:text-ocean-100/75">
              <p>
                The Disaster Management Students&apos; Alumni Association unites
                graduates who trained together to understand risk, respond to
                emergencies, and rebuild communities in the wake of catastrophe.
              </p>
              <p>
                What began as a single cohort in 2011 has grown into a
                multi-generational network spanning ten batches and hundreds of
                professionals working in humanitarian aid, government agencies,
                research institutions, and grassroots organizations worldwide.
              </p>
              <p>
                We exist to keep that connection alive — to mentor the next
                batch, share field knowledge, and stand together when the ground
                shifts beneath us.
              </p>
            </div>

            {/* Quote block */}
            <div className="mt-8 rounded-2xl border border-ocean-200/60 bg-gradient-to-br from-ocean-50/60 to-reef-50/40 p-5 dark:border-ocean-800/60 dark:from-ocean-900/60 dark:to-reef-900/30">
              <Quote className="h-6 w-6 text-reef-400 dark:text-reef-300" />
              <p className="mt-2 text-sm italic leading-relaxed text-ocean-700 dark:text-ocean-100/80">
                We didn&apos;t just learn disaster management — we lived it. And the
                connections we built in those classrooms became the lifelines we
                still rely on in the field.
              </p>
              <p className="mt-3 text-xs font-semibold text-ocean-500 dark:text-ocean-300/60">
                — Founding member, 1st Batch (Session 2011-12)
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-6">
              {[
                { value: '10', label: 'Cohorts since 2011' },
                { value: '695', label: 'Alumni members' },
                { value: '24', label: 'Countries served' },
              ].map((stat, i) => (
                <div key={stat.label} className="group">
                  <p className="font-display text-3xl font-bold text-gradient">{stat.value}</p>
                  <p className="text-sm text-ocean-400 dark:text-ocean-300/60">{stat.label}</p>
                  {i < 2 && <div className="mt-1 h-0.5 w-0 bg-gradient-to-r from-ocean-400 to-reef-400 transition-all duration-500 group-hover:w-full" />}
                </div>
              ))}
            </div>
          </div>

          {/* Right: values grid */}
          <div className="grid gap-4 sm:grid-cols-2 reveal">
            {values.map((v, i) => (
              <div
                key={v.title}
                className="group relative overflow-hidden rounded-2xl border border-ocean-200/60 bg-gradient-to-b from-white to-ocean-50/30 p-6 transition-all duration-300 hover:border-ocean-300 hover:shadow-xl hover:shadow-ocean-200/20 hover:-translate-y-1 dark:border-ocean-800/60 dark:from-ocean-900/40 dark:to-ocean-950/60 dark:hover:border-reef-600/40"
                style={{ transitionDelay: `${i * 50}ms` }}
              >
                {/* Hover gradient glow */}
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-ocean-200/0 to-reef-200/0 blur-2xl transition-all duration-500 group-hover:from-ocean-200/30 group-hover:to-reef-200/30" />

                <span className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-ocean-500 to-reef-500 shadow-lg shadow-ocean-300/30 transition-transform group-hover:scale-110 group-hover:rotate-3">
                  <v.icon className="h-6 w-6 text-white" strokeWidth={1.8} />
                </span>
                <h3 className="relative mt-4 font-display text-lg font-semibold text-ocean-900 dark:text-white">
                  {v.title}
                </h3>
                <p className="relative mt-2 text-sm leading-relaxed text-ocean-600/70 dark:text-ocean-100/65">
                  {v.desc}
                </p>

                {/* Bottom accent line */}
                <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-gradient-to-r from-ocean-500 to-reef-500 transition-all duration-500 group-hover:w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
