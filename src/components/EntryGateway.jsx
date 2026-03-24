import React from 'react';
import { PackagePlus, SearchCheck, ShieldCheck, ArrowUpRight, Sparkles, Download, UserCircle2 } from 'lucide-react';

export default function EntryGateway({ onChooseList, onChooseFind, onChooseProfile }) {
  return (
    <section className="entry-gateway relative min-h-screen overflow-hidden bg-[#040302]">
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&w=1920&q=80"
          alt="Campus style backdrop"
          className="h-full w-full object-cover opacity-28"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/78 to-[#070503]" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_2%,rgba(255,213,108,0.2),transparent_34%),radial-gradient(circle_at_84%_4%,rgba(255,177,54,0.1),transparent_32%)]" />

      <div className="relative z-10">
        <div className="border-b border-amber-300/25 bg-black/55 px-4 py-2 text-center text-sm font-semibold text-amber-100 sm:px-8">
          Trusted Local Exchange for Saharanpur Families
        </div>

        <header className="mx-auto flex w-full max-w-[1400px] items-center justify-start border-b border-amber-300/40 px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-300 text-[#2d2007]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-[1.8rem] font-semibold leading-none text-amber-50">VIDYA SHARE</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-amber-100/62">Student Economy Network</p>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1400px] px-4 pb-12 pt-12 sm:px-8 sm:pb-16">
          <div className="max-w-5xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-100/25 bg-amber-100/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-amber-100 uppercase">
              <ShieldCheck className="h-3.5 w-3.5" />
              Trusted Parent Exchange
            </p>
            <h1 className="font-display text-4xl font-semibold leading-[1.08] text-amber-50 sm:text-6xl lg:text-[5rem]">
              India&apos;s local student marketplace for
              <span className="font-accent ml-3 text-amber-300">smarter handovers</span>
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-amber-100/80 sm:text-[1.18rem]">
              Built for Saharanpur families to exchange books, uniforms, and school gear without shop middlemen or shipping cost.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={onChooseList}
                className="rounded-full bg-amber-300 px-7 py-3 text-base font-semibold text-[#302208] transition hover:brightness-105"
              >
                Start Listing
              </button>
              <button
                onClick={onChooseFind}
                className="rounded-full border border-amber-100/35 bg-black/35 px-6 py-3 text-base font-semibold text-amber-100 transition hover:bg-amber-100/10"
              >
                <Download className="mr-2 inline h-4 w-4" />
                Browse Requests
              </button>
            </div>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2 lg:gap-8">
            <button
              id="item-zone"
              onClick={onChooseList}
              className="gateway-option group rounded-[2rem] border border-amber-100/25 bg-gradient-to-br from-[#130e05]/94 to-[#0a0703]/96 p-6 text-left transition-all hover:-translate-y-1 hover:border-amber-200/55 sm:p-8"
            >
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-300/20 text-amber-100">
                <PackagePlus className="h-7 w-7" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100/65">For Sellers</p>
              <h2 className="font-display mt-1 text-3xl font-semibold text-amber-50">List Your Item</h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-amber-100/72 sm:text-[0.97rem]">
                Add your book or uniform in minutes so nearby families can discover and collect it quickly.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-amber-200/25 bg-amber-100/10 px-3 py-2 text-sm font-semibold text-amber-100">
                Continue
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </button>

            <button
              id="buyers-zone"
              onClick={onChooseFind}
              className="gateway-option group rounded-[2rem] border border-amber-100/25 bg-gradient-to-br from-[#130e05]/94 to-[#0a0703]/96 p-6 text-left transition-all hover:-translate-y-1 hover:border-amber-200/55 sm:p-8"
            >
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-300/20 text-amber-100">
                <SearchCheck className="h-7 w-7" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100/65">For Buyers</p>
              <h2 className="font-display mt-1 text-3xl font-semibold text-amber-50">Find What You Need</h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-amber-100/72 sm:text-[0.97rem]">
                Explore active listings or post a request, and local families who have it can respond.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-amber-200/25 bg-amber-100/10 px-3 py-2 text-sm font-semibold text-amber-100">
                Continue
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </button>
          </div>

          <div id="profile-zone" className="mt-5">
            <button
              onClick={onChooseProfile}
              className="w-full rounded-[1.5rem] border border-amber-100/25 bg-gradient-to-r from-[#130e05]/90 to-[#0a0703]/95 p-5 text-left transition hover:border-amber-200/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-300/20 text-amber-100">
                  <UserCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-100/62">Account</p>
                  <h3 className="font-display text-2xl font-semibold text-amber-50">Your profile</h3>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
