import React from 'react';
import { PlusCircle, UserCircle2, ShieldCheck } from 'lucide-react';
import BrandLogo from './BrandLogo';

export default function AppHeader({ userProfile, onCreateListing, onOpenProfilePanel }) {
  return (
    <header className="surface-panel relative rounded-[1.5rem] px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-cyan-100/70 uppercase">Trust-first marketplace</p>
          <div className="mt-2">
            <BrandLogo
              markClassName="h-11 w-11"
              title="Vidya Share"
              subtitle=""
              titleClassName="font-display text-2xl font-semibold leading-none text-white sm:text-[1.9rem]"
            />
          </div>
          <p className="mt-1 text-xs text-cyan-50/62 sm:text-sm">Used books for local students with faster, safer direct pickups.</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/8 px-3 py-2 text-xs font-semibold text-cyan-50/82 md:flex">
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
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/20 bg-[#08111a]/88 text-cyan-100 transition hover:border-cyan-300/40 hover:text-white"
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
