import React from 'react';
import { PlusCircle, UserCircle2, ShieldCheck } from 'lucide-react';

export default function AppHeader({ userProfile, onCreateListing, onOpenProfilePanel }) {
  return (
    <header className="surface-panel relative rounded-[1.5rem] px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-amber-200/75 uppercase">Trust-first marketplace</p>
          <h2 className="font-display mt-1 text-2xl font-semibold text-amber-50 sm:text-[1.9rem]">School Swap</h2>
          <p className="mt-1 text-xs text-amber-100/60 sm:text-sm">Books, uniforms, and school gear for local families.</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-xl border border-amber-200/20 bg-amber-100/5 px-3 py-2 text-xs font-semibold text-amber-100/80 md:flex">
            <ShieldCheck className="h-3.5 w-3.5" />
            Verified network
          </div>

          <button
            onClick={onCreateListing}
            className="btn-primary hidden items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold sm:flex"
          >
            <PlusCircle className="h-4 w-4" />
            New Listing
          </button>

          <button
            onClick={onOpenProfilePanel}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-amber-200/25 bg-[#1d1506]/85 text-amber-100 transition hover:border-amber-200/45 hover:text-amber-50"
            aria-label="Open profile panel"
            title={userProfile?.displayName || 'Profile'}
          >
            <UserCircle2 className="h-6 w-6" />
          </button>
        </div>
      </div>
    </header>
  );
}
