import React from 'react';
import { MessagesSquare, CheckCircle2, Loader2 } from 'lucide-react';

const timeAgo = (timestamp) => {
  if (!timestamp?.toDate) return 'Just now';
  const seconds = Math.floor((Date.now() - timestamp.toDate().getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const getStatusMeta = (status) => {
  if (status === 'fulfilled')
    return { label: 'Fulfilled', className: 'border border-emerald-200/40 bg-emerald-200 text-[#173724]' };
  if (status === 'matched')
    return { label: 'Matched', className: 'border border-cyan-200/45 bg-cyan-200 text-[#082231]' };
  return { label: 'Open', className: 'border border-sky-200/45 bg-sky-200 text-[#17304a]' };
};

const buildRequestSummary = (request) => {
  const chips = [];
  if (request.category) chips.push(request.category);
  if (request.subject) chips.push(request.subject);
  if (request.school) chips.push(request.school);
  if (request.budget && Number(request.budget) > 0) chips.push(`Budget ₹${request.budget}`);
  if (request.urgency) chips.push(request.urgency);
  return chips;
};

export default function RequestBoard({
  requests,
  currentUserId = '',
  onMarkFulfilled,
  fulfillingRequestId = '',
}) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="lux-panel-soft rounded-2xl p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm text-cyan-50/84">
          <MessagesSquare className="h-4 w-4 text-cyan-100/90" />
          Structured requests are shared with nearby sellers and matched automatically.
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="lux-panel rounded-2xl p-8 text-center text-sm text-cyan-50/76">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
            <MessagesSquare className="h-5 w-5 text-cyan-100/70" />
          </div>
          No wishlist posts yet. Be the first to request something.
        </div>
      ) : (
        requests.map((request) => {
          const statusMeta = getStatusMeta(request.status || 'open');
          const chips = buildRequestSummary(request);
          const isOwnRequest = currentUserId && request.requesterId === currentUserId;
          const canMarkFulfilled = isOwnRequest && request.status !== 'fulfilled';
          const isBusy = fulfillingRequestId === request.id;

          return (
            <article
              key={request.id}
              className="lux-panel flex flex-col items-start justify-between gap-3 rounded-[1.4rem] p-4 transition-all hover:-translate-y-0.5 hover:border-cyan-300/28 sm:p-5"
            >
              <div className="w-full min-w-0">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="line-clamp-2 font-semibold text-white">{request.text}</h4>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusMeta.className}`}>
                      {statusMeta.label}
                    </span>
                    <span className="text-xs text-cyan-50/62">{timeAgo(request.createdAt)}</span>
                  </div>
                </div>

                {chips.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {chips.map((chip) => (
                      <span
                        key={`${request.id}-${chip}`}
                        className="rounded-full border border-cyan-300/18 bg-white/6 px-2.5 py-1 text-[10px] font-semibold text-cyan-50/84"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                )}

                {typeof request.matchedCount === 'number' && request.matchedCount > 0 && (
                  <p className="mt-2 text-xs font-semibold text-cyan-50/82">{request.matchedCount} seller matches found</p>
                )}
              </div>

              <div className="flex w-full flex-wrap items-center justify-end gap-2">
                {canMarkFulfilled && (
                  <button
                    type="button"
                    onClick={() => onMarkFulfilled && onMarkFulfilled(request)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-200/35 bg-emerald-200/15 px-3.5 py-1.5 text-xs font-bold text-emerald-100 transition hover:bg-emerald-200/25 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Mark fulfilled
                  </button>
                )}
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
