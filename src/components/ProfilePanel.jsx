import React from 'react';
import { X, LogIn, LogOut, User, PlusCircle, Search, Package2, ShieldAlert, PencilLine } from 'lucide-react';
import { BrandMark } from './BrandLogo';

export default function ProfilePanel({
  isOpen,
  onClose,
  isAuthenticated,
  userProfile,
  userPhone,
  userEmail,
  onOpenAuth,
  onOpenPostFlow,
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

  return (
    <div className="fixed inset-0 z-[180]">
      <button
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close profile panel backdrop"
      />
      <aside className="surface-panel hide-scrollbar absolute inset-x-0 bottom-0 max-h-[88dvh] w-full overflow-y-auto rounded-t-[1.6rem] border-t border-cyan-300/18 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(0.9rem,env(safe-area-inset-bottom))] sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:max-h-full sm:max-w-sm sm:rounded-none sm:border-t-0 sm:border-l sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/62">Profile</p>
            <div className="mt-2 flex items-center gap-3">
              <BrandMark className="h-10 w-10" />
              <h3 className="font-display truncate text-2xl font-semibold text-white">{displayName}</h3>
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

        <div className="lux-panel-soft mb-4 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-300/12 text-cyan-100">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="inline-flex rounded-full border border-cyan-300/22 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-50/86">
                {displayRole} account
              </p>
              <p className="mt-2 truncate text-sm font-semibold text-white">{displaySchool}</p>
              <p className="mt-1 text-xs text-cyan-50/62">{displayColony}</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="lux-panel-soft rounded-lg px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-50/54">Handovers</p>
              <p className="mt-1 text-sm font-semibold text-emerald-100">{handovers}</p>
            </div>
            <div className="lux-panel-soft rounded-lg px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-50/54">Aura</p>
              <p className="mt-1 text-sm font-semibold text-cyan-100">{karma}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-50/58">
            <span className="rounded-full border border-cyan-300/18 bg-white/5 px-3 py-1">Verified network</span>
            {hasPhone && <span className="rounded-full border border-emerald-200/30 bg-emerald-200/15 px-3 py-1">Phone ready</span>}
            {hasEmail && <span className="rounded-full border border-cyan-300/18 bg-white/5 px-3 py-1">Email ready</span>}
          </div>

          <div className="mt-3 space-y-1.5">
            <p className="text-xs text-cyan-50/68">{displayPhone}</p>
            <p className="text-xs text-cyan-50/68">{displayEmail}</p>
            {userProfile?.responseSpeed && <p className="text-xs text-cyan-50/74">Response: {userProfile.responseSpeed}</p>}
            {userProfile?.preferredMeetup && <p className="text-xs text-cyan-50/74">Handover: {userProfile.preferredMeetup}</p>}
          </div>

          {userProfile?.profileTagline && (
            <p className="lux-panel-soft mt-3 rounded-lg px-3 py-2 text-xs text-cyan-50/84">
              {userProfile.profileTagline}
            </p>
          )}
          {userProfile?.bio && (
            <p className="lux-panel-soft mt-2 rounded-lg px-3 py-2 text-xs text-cyan-50/76">
              {userProfile.bio}
            </p>
          )}
        </div>

        <div className="mb-5">
          <button onClick={onEditProfile} className="profile-action-btn">
            <PencilLine className="h-4 w-4" />
            Edit profile
          </button>
        </div>

        <div className="space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-50/56">Quick actions</p>
          <button onClick={onOpenPostFlow} className="profile-action-btn">
            <PlusCircle className="h-4 w-4" />
            List an item
          </button>
          <button onClick={onOpenRequests} className="profile-action-btn">
            <Search className="h-4 w-4" />
            Find or request
          </button>
          <button onClick={onOpenMyPosts} className="profile-action-btn">
            <Package2 className="h-4 w-4" />
            My posts
          </button>
          {isAdmin && (
            <button onClick={onOpenAdmin} className="profile-action-btn">
              <ShieldAlert className="h-4 w-4" />
              Admin room
            </button>
          )}
        </div>

        <div className="mt-6 border-t border-cyan-300/12 pt-4">
          {isAuthenticated ? (
            <button onClick={onSignOut} className="profile-action-btn text-cyan-50">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          ) : (
            <button onClick={onOpenAuth} className="profile-action-btn text-cyan-50">
              <LogIn className="h-4 w-4" />
              Sign in
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
