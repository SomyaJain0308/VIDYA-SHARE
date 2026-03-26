import React from 'react';
import { X, LogIn, LogOut, User, PlusCircle, Search, Package2, ShieldAlert, PencilLine, MessageCircle } from 'lucide-react';
import { BrandMark } from './BrandLogo';
import { SUPPORT_EMAIL } from '../config/compliance';
import { getSellerVerificationSummary } from '../utils/marketplaceCompliance';

export default function ProfilePanel({
  isOpen,
  onClose,
  isAuthenticated,
  userProfile,
  userPhone,
  userEmail,
  onOpenAuth,
  onOpenPostFlow,
  onOpenChats,
  onOpenRequests,
  onOpenMyPosts,
  onOpenAdmin,
  onSignOut,
  onEditProfile,
  isAdmin,
}) {
  if (!isOpen) return null;

  const displayName = userProfile?.displayName || 'Parent Member';
  const displayRole = userProfile?.role || 'Parent';
  const displaySchool = userProfile?.primarySchool || 'Institution not set';
  const displayColony = userProfile?.colony || 'Colony not set';
  const displayPhone = userProfile?.contactPhone || userPhone || 'Phone not available';
  const displayEmail = userProfile?.email || userEmail || 'Email not available';
  const handovers = userProfile?.successfulHandovers || 0;
  const karma = userProfile?.karmaPoints || 0;
  const hasPhone = Boolean(userProfile?.contactPhone || userPhone);
  const hasEmail = Boolean(userProfile?.email || userEmail);
  const sellerVerification = getSellerVerificationSummary(userProfile || {});

  return (
    <div className="fixed inset-0 z-[180]">
      <button
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close profile panel backdrop"
      />

      <aside className="surface-panel hide-scrollbar absolute inset-0 flex w-full flex-col overflow-hidden rounded-none border-0 p-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:max-h-full sm:max-w-[26rem] sm:border-l sm:border-cyan-300/18">
        <div className="sticky top-0 z-10 border-b border-cyan-300/12 bg-[linear-gradient(180deg,rgba(8,13,20,0.98),rgba(8,13,20,0.9))] px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 backdrop-blur-xl sm:px-6 sm:pt-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/62">Profile</p>
              <div className="mt-2 flex items-center gap-3">
                <BrandMark className="h-10 w-10 shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-display truncate text-2xl font-semibold text-white">{displayName}</h3>
                  <p className="mt-1 truncate text-xs text-cyan-50/62">{displayRole} account</p>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl border border-cyan-300/18 bg-[#08111a]/88 p-2 text-cyan-50 transition hover:border-cyan-300/34 hover:text-white"
              aria-label="Close profile panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="lux-panel-soft rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-50/54">Handovers</p>
              <p className="mt-1 text-base font-semibold text-emerald-100">{handovers}</p>
            </div>
            <div className="lux-panel-soft rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-50/54">Aura</p>
              <p className="mt-1 text-base font-semibold text-cyan-100">{karma}</p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          <div className="lux-panel-soft mb-4 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-300/12 text-cyan-100">
                <User className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="inline-flex rounded-full border border-cyan-300/22 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-50/86">
                  {displayRole} account
                </p>
                <p className="mt-2 break-words text-sm font-semibold leading-5 text-white">{displaySchool}</p>
                <p className="mt-1 break-words text-xs text-cyan-50/62">{displayColony}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-50/58">
              <span className="rounded-full border border-cyan-300/18 bg-white/5 px-3 py-1">{sellerVerification}</span>
              {hasPhone && <span className="rounded-full border border-emerald-200/30 bg-emerald-200/15 px-3 py-1">Phone ready</span>}
              {hasEmail && <span className="rounded-full border border-cyan-300/18 bg-white/5 px-3 py-1">Email ready</span>}
            </div>

            <div className="mt-3 space-y-2">
              <div className="lux-panel-soft rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-50/54">Phone</p>
                <p className="mt-1 break-all text-sm text-cyan-50/80">{displayPhone}</p>
              </div>
              <div className="lux-panel-soft rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-50/54">Email</p>
                <p className="mt-1 break-all text-sm text-cyan-50/80">{displayEmail}</p>
              </div>
              {(userProfile?.responseSpeed || userProfile?.preferredMeetup) && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {userProfile?.responseSpeed && (
                    <div className="lux-panel-soft rounded-xl px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-50/54">Response</p>
                      <p className="mt-1 text-sm text-cyan-50/80">{userProfile.responseSpeed}</p>
                    </div>
                  )}
                  {userProfile?.preferredMeetup && (
                    <div className="lux-panel-soft rounded-xl px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-50/54">Meetup</p>
                      <p className="mt-1 text-sm text-cyan-50/80">{userProfile.preferredMeetup}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {userProfile?.profileTagline && (
              <p className="lux-panel-soft mt-3 rounded-xl px-3 py-3 text-sm leading-relaxed text-cyan-50/84">
                {userProfile.profileTagline}
              </p>
            )}
            {userProfile?.bio && (
              <p className="lux-panel-soft mt-2 rounded-xl px-3 py-3 text-sm leading-relaxed text-cyan-50/76">
                {userProfile.bio}
              </p>
            )}
            <p className="lux-panel-soft mt-3 rounded-xl px-3 py-3 text-xs leading-relaxed text-cyan-50/72">
              For grievances, privacy requests, or unsafe-listing reports, contact {SUPPORT_EMAIL}.
            </p>
          </div>

          <div className="mb-4">
            <button onClick={onEditProfile} className="profile-action-btn">
              <PencilLine className="h-4 w-4 shrink-0" />
              Edit profile
            </button>
          </div>

          {isAuthenticated ? (
            <div className="mb-4">
              <button onClick={onSignOut} className="profile-action-btn text-cyan-50">
                <LogOut className="h-4 w-4 shrink-0" />
                Sign out
              </button>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-50/56">Quick actions</p>
            <div className="grid gap-2">
              <button onClick={onOpenPostFlow} className="profile-action-btn">
                <PlusCircle className="h-4 w-4 shrink-0" />
                List an item
              </button>
              <button onClick={onOpenChats} className="profile-action-btn">
                <MessageCircle className="h-4 w-4 shrink-0" />
                Chats
              </button>
              <button onClick={onOpenRequests} className="profile-action-btn">
                <Search className="h-4 w-4 shrink-0" />
                Find or request
              </button>
              <button onClick={onOpenMyPosts} className="profile-action-btn">
                <Package2 className="h-4 w-4 shrink-0" />
                My posts
              </button>
              {isAdmin && (
                <button onClick={onOpenAdmin} className="profile-action-btn">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  Admin room
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-cyan-300/12 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          {isAuthenticated ? (
            <button onClick={onSignOut} className="profile-action-btn text-cyan-50">
              <LogOut className="h-4 w-4 shrink-0" />
              Sign out
            </button>
          ) : (
            <button onClick={onOpenAuth} className="profile-action-btn text-cyan-50">
              <LogIn className="h-4 w-4 shrink-0" />
              Sign in
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
