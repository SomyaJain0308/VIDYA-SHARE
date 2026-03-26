import React from 'react';
import { DIRECT_TRANSACTION_NOTICE, GRIEVANCE_ACK_HOURS, SUPPORT_EMAIL } from '../config/compliance';

export default function MarketplaceNoticeBar() {
  return (
    <div className="safe-inline mt-3">
      <div className="mx-auto w-full max-w-[1760px] rounded-[1.5rem] border border-cyan-300/16 bg-[#08111a]/86 px-4 py-3 shadow-[0_24px_70px_-48px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:px-5">
        <div className="flex flex-wrap items-start gap-3 text-sm leading-relaxed text-cyan-50/76">
          <span className="rounded-full border border-cyan-300/22 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
            Marketplace only
          </span>
          <p className="max-w-6xl">
            {DIRECT_TRANSACTION_NOTICE} Report unsafe or misleading listings in-app or email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-cyan-100 underline-offset-4 hover:underline">
              {SUPPORT_EMAIL}
            </a>
            . Complaint acknowledgement target: within {GRIEVANCE_ACK_HOURS} hours.
          </p>
        </div>
      </div>
    </div>
  );
}
