import React from 'react';
import { motion } from 'framer-motion';
import {
  PackagePlus,
  SearchCheck,
  ShieldCheck,
  ArrowUpRight,
  UserCircle2,
  MapPin,
  Library,
  BadgeCheck,
  Clock3,
} from 'lucide-react';

const riseIn = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
};

export default function EntryGateway({ onChooseList, onChooseFind, onChooseProfile }) {
  return (
    <section className="entry-gateway relative min-h-screen overflow-hidden bg-[#020406]">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,4,6,0.96),rgba(3,7,11,0.98))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(64,221,255,0.18),transparent_28%),radial-gradient(circle_at_82%_8%,rgba(0,122,255,0.16),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(91,232,255,0.08),transparent_30%)]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:42px_42px]" />
      </div>

      <div className="relative z-10">
        <div className="safe-inline border-b border-cyan-300/14 bg-black/22 py-2 text-center text-xs font-semibold uppercase tracking-[0.22em] text-cyan-50/76 backdrop-blur-md">
          Saharanpur used books exchange - trusted handovers - zero shipping
        </div>

        <header className="safe-inline mx-auto flex w-full max-w-[1760px] items-center justify-between py-5">
          <div className="flex min-w-0 flex-1 items-center">
            <img
              src="/brand-logo.svg"
              alt="Vidya Share"
              className="h-14 w-auto max-w-[min(78vw,18rem)] drop-shadow-[0_16px_36px_rgba(0,0,0,0.35)] sm:h-16"
            />
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <span className="rounded-full border border-cyan-300/15 bg-white/6 px-4 py-2 text-xs font-semibold text-cyan-50/78">
              Direct peer-to-peer book exchange
            </span>
            <span className="rounded-full border border-cyan-300/15 bg-white/6 px-4 py-2 text-xs font-semibold text-cyan-50/78">
              Built for Saharanpur students
            </span>
          </div>
        </header>

        <div className="safe-inline mx-auto w-full max-w-[1760px] pb-12 pt-4 sm:pb-16 lg:pt-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_420px]">
            <motion.div {...riseIn} className="editorial-shell p-6 sm:p-8 xl:p-10">
              <div className="relative z-10 max-w-4xl">
                <p className="section-kicker">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Premium local marketplace
                </p>
                <h1 className="font-display mt-6 max-w-5xl text-4xl font-semibold leading-[0.98] text-white sm:text-6xl xl:text-[5.6rem]">
                  The used-book network
                  <span className="font-accent ml-3 text-cyan-300">Saharanpur students trust</span>
                </h1>
                <p className="mt-6 max-w-3xl text-base leading-relaxed text-cyan-50/72 sm:text-[1.08rem]">
                  Vidya Share helps students exchange books with direct handovers, cleaner trust signals, and a marketplace that finally looks serious.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <button
                    onClick={onChooseList}
                    className="btn-primary rounded-full px-7 py-3.5 text-sm font-bold sm:text-base"
                  >
                    List an item
                  </button>
                  <button
                    onClick={onChooseFind}
                    className="rounded-full border border-cyan-300/20 bg-white/5 px-6 py-3.5 text-sm font-semibold text-cyan-50 transition hover:bg-white/10 sm:text-base"
                  >
                    Explore the market
                  </button>
                  <button
                    onClick={onChooseProfile}
                    className="rounded-full border border-cyan-300/14 bg-black/12 px-6 py-3.5 text-sm font-semibold text-cyan-50/86 transition hover:bg-white/8 sm:text-base"
                  >
                    Open your profile
                  </button>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-50/60">
                  <span className="rounded-full border border-cyan-300/15 bg-white/6 px-3 py-1">Zero shipping</span>
                  <span className="rounded-full border border-cyan-300/15 bg-white/6 px-3 py-1">Verified pickups</span>
                  <span className="rounded-full border border-cyan-300/15 bg-white/6 px-3 py-1">Book-first network</span>
                </div>

                <div className="mt-10 grid gap-3 sm:grid-cols-3">
                  <div className="metric-tile p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-50/56">Market style</p>
                    <p className="mt-2 text-lg font-semibold text-white">Direct pickup</p>
                    <p className="mt-1 text-sm text-cyan-50/68">No courier friction and no shop middlemen.</p>
                  </div>
                  <div className="metric-tile p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-50/56">Trust layer</p>
                    <p className="mt-2 text-lg font-semibold text-white">Profile-backed</p>
                    <p className="mt-1 text-sm text-cyan-50/68">Listings carry real seller context and faster confidence.</p>
                  </div>
                  <div className="metric-tile p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-50/56">Focus</p>
                    <p className="mt-2 text-lg font-semibold text-white">Used books only</p>
                    <p className="mt-1 text-sm text-cyan-50/68">Designed around fast local book exchange across the city.</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.aside
              {...riseIn}
              transition={{ ...riseIn.transition, delay: 0.08 }}
              className="flex flex-col gap-4"
            >
              <div className="metric-tile p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="section-kicker">
                      <MapPin className="h-3.5 w-3.5" />
                      SRE Network
                    </p>
                    <h2 className="font-display mt-4 text-2xl font-semibold text-white">Built for readers, not random classifieds</h2>
                  </div>
                  <BadgeCheck className="h-6 w-6 text-cyan-100/80" />
                </div>

                <div className="mt-5 space-y-3">
                  <div className="field-shell flex items-center gap-3 px-4 py-3">
                    <Library className="h-5 w-5 text-cyan-100/78" />
                    <div>
                      <p className="text-sm font-semibold text-white">Library-grade presentation</p>
                      <p className="text-xs text-cyan-50/64">Premium browsing built specifically for books.</p>
                    </div>
                  </div>
                  <div className="field-shell flex items-center gap-3 px-4 py-3">
                    <ShieldCheck className="h-5 w-5 text-cyan-100/78" />
                    <div>
                      <p className="text-sm font-semibold text-white">Trust-first profiles</p>
                      <p className="text-xs text-cyan-50/64">Real handover details, not anonymous spam listings.</p>
                    </div>
                  </div>
                  <div className="field-shell flex items-center gap-3 px-4 py-3">
                    <Clock3 className="h-5 w-5 text-cyan-100/78" />
                    <div>
                      <p className="text-sm font-semibold text-white">Faster local response</p>
                      <p className="text-xs text-cyan-50/64">City-focused handovers mean quicker deal completion.</p>
                    </div>
                  </div>
                </div>
              </div>

              <button
                id="item-zone"
                onClick={onChooseList}
                className="metric-tile group p-5 text-left transition-all hover:-translate-y-1 hover:border-cyan-300/28"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/12 text-cyan-100">
                    <PackagePlus className="h-6 w-6" />
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-cyan-100/76 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-50/62">For sellers</p>
                <h3 className="font-display mt-2 text-2xl font-semibold text-white">Create a book listing</h3>
                <p className="mt-2 text-sm leading-relaxed text-cyan-50/68">
                  Upload the book, set the price, and let nearby students discover it with far more trust than a random marketplace.
                </p>
              </button>

              <button
                id="buyers-zone"
                onClick={onChooseFind}
                className="metric-tile group p-5 text-left transition-all hover:-translate-y-1 hover:border-cyan-300/28"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/12 text-cyan-100">
                    <SearchCheck className="h-6 w-6" />
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-cyan-100/76 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-50/62">For buyers</p>
                <h3 className="font-display mt-2 text-2xl font-semibold text-white">Browse or request the right book</h3>
                <p className="mt-2 text-sm leading-relaxed text-cyan-50/68">
                  Scan live offers, shortlist strong deals, or post a request so the right seller can reach out directly.
                </p>
              </button>

              <button
                id="profile-zone"
                onClick={onChooseProfile}
                className="metric-tile group p-5 text-left transition-all hover:-translate-y-1 hover:border-cyan-300/28"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/12 text-cyan-100">
                    <UserCircle2 className="h-6 w-6" />
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-cyan-100/76 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-50/62">Your identity</p>
                <h3 className="font-display mt-2 text-2xl font-semibold text-white">Build the trust layer</h3>
                <p className="mt-2 text-sm leading-relaxed text-cyan-50/68">
                  Add school, response speed, and handover details so every listing feels safer and more credible.
                </p>
              </button>
            </motion.aside>
          </div>
        </div>
      </div>
    </section>
  );
}
