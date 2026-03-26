import React from 'react';
import { AlertTriangle, Loader2, ShieldAlert, X } from 'lucide-react';
import { REPORT_REASON_OPTIONS } from '../utils/marketplaceCompliance';

export default function ReportListingModal({
  isOpen,
  listingTitle = '',
  reason = '',
  details = '',
  onReasonChange,
  onDetailsChange,
  onClose,
  onSubmit,
  isSubmitting = false,
  error = '',
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[205] flex items-center justify-center bg-black/78 p-4 backdrop-blur-md">
      <div className="glass-panel w-full max-w-lg rounded-[1.6rem] border border-cyan-300/16 bg-[#07111a]/96 p-5 shadow-[0_30px_90px_rgba(2,10,16,0.68)] sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-cyan-100/62">Report Listing</p>
            <h3 className="font-display mt-1 text-2xl font-semibold text-white">{listingTitle || 'Listing'}</h3>
            <p className="mt-2 text-sm text-cyan-50/72">
              Reports help us remove fake listings, suspicious payment asks, and unsafe meetup behavior faster.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-cyan-300/20 bg-[#08111a]/88 p-2 text-cyan-50/82 transition hover:border-cyan-300/40 hover:text-white"
            aria-label="Close report dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl border border-amber-200/20 bg-amber-200/10 p-3 text-sm leading-relaxed text-cyan-50/82">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-100" />
            <p>
              Choose the closest issue. Serious safety reports should mention if the seller asked for advance payment,
              moved the chat to Telegram or WhatsApp only, or pushed for a private meetup.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          {REPORT_REASON_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onReasonChange(option)}
              className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                reason === option
                  ? 'border-cyan-200/70 bg-cyan-300/14 text-white'
                  : 'border-cyan-300/16 bg-[#08111a]/88 text-cyan-50/78 hover:border-cyan-300/36 hover:text-white'
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100/62">
            <AlertTriangle className="h-3.5 w-3.5" />
            Extra details
          </span>
          <textarea
            rows="4"
            value={details}
            onChange={(event) => onDetailsChange(event.target.value)}
            placeholder="Tell the moderation team what happened. Example: seller demanded UPI payment before meetup."
            className="lux-textarea min-h-[120px] text-sm font-medium"
          />
        </label>

        {error ? (
          <p className="mt-3 rounded-lg border border-rose-200/45 bg-rose-300/20 px-3 py-2 text-sm font-semibold text-rose-100">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-relaxed text-cyan-50/66">
            We recommend public handovers only. Never share OTPs and never pay before inspection.
          </p>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || !reason}
            className="btn-primary min-h-[44px] rounded-xl px-5 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending report...
              </span>
            ) : (
              'Submit Report'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
