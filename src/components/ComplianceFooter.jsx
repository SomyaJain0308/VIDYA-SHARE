import React from 'react';
import { APP_NAME, SUPPORT_EMAIL } from '../config/compliance';

export default function ComplianceFooter() {
  return (
    <footer className="safe-inline pb-[max(6rem,env(safe-area-inset-bottom))] pt-6 lg:pb-10">
      <div className="mx-auto w-full max-w-[1760px] rounded-[2rem] border border-cyan-300/14 bg-[#07111a]/88 p-5 shadow-[0_28px_80px_-52px_rgba(0,0,0,0.96)] backdrop-blur-xl sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/62">{APP_NAME}</p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-cyan-50/76">
              Built for students. Focused on simplicity and safety.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-cyan-300/18 bg-white/[0.03] px-4 py-2 font-semibold text-cyan-50 transition hover:bg-white/[0.08]"
            >
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
