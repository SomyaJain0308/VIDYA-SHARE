import React from 'react';
import { MessagesSquare } from 'lucide-react';

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

export default function RequestBoard({ requests }) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="glass-panel rounded-2xl p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm text-amber-100/88">
          <MessagesSquare className="h-4 w-4 text-amber-100/90" />
          Requests are visible to the neighborhood so families can respond directly.
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 text-center text-sm text-amber-100/78">
          No wishlist posts yet. Be the first to request something.
        </div>
      ) : (
        requests.map((req) => (
          <article
            key={req.id}
            className="glass-panel flex flex-col items-start justify-between gap-3 rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:border-amber-200/45 sm:flex-row sm:items-center sm:p-5"
          >
            <div className="min-w-0 flex-1">
              <h4 className="line-clamp-2 font-semibold text-amber-50">{req.text}</h4>
              <p className="mt-1 text-xs text-amber-100/68">{timeAgo(req.createdAt)}</p>
            </div>
            {req.requesterPhone && (
              <a
                href={`https://wa.me/${req.requesterPhone.replace(/\D/g, '')}?text=Hi! I saw your request for "${req.text}" on School Swap. I might have it.`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-amber-200 px-3.5 py-1.5 text-xs font-bold text-[#3a2807] transition hover:brightness-105 whitespace-nowrap"
              >
                I have this
              </a>
            )}
          </article>
        ))
      )}
    </div>
  );
}
