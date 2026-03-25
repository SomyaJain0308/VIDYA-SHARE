import React from 'react';
import { X, LogIn, LogOut, User, PlusCircle, Search, Package2, ShieldAlert, PencilLine } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 z-[180]">
      <button
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close profile panel backdrop"
      />
      <aside className="surface-panel absolute right-0 top-0 h-full w-full max-w-sm rounded-none border-l border-amber-200/25 p-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-amber-200/70 uppercase">Profile</p>
            <h3 className="font-display mt-1 text-2xl font-semibold text-amber-50">
              {userProfile?.displayName || 'Parent Member'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-amber-200/25 bg-[#1b1205]/80 p-2 text-amber-100 transition hover:border-amber-200/45 hover:text-amber-50"
            aria-label="Close profile panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 rounded-2xl border border-amber-200/20 bg-[#140f05]/85 p-4">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-200/15 text-amber-100">
            <User className="h-5 w-5" />
          </div>
          <p className="inline-flex rounded-full border border-amber-200/30 bg-amber-200/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100/86">
            {userProfile?.role || 'Parent'} account
          </p>
          <p className="text-sm font-semibold text-amber-50">{userProfile?.primarySchool || 'School not set'}</p>
          <p className="mt-1 text-xs text-amber-100/65">{userProfile?.colony || 'Colony not set'}</p>
          <p className="mt-1 text-xs text-amber-100/65">{userProfile?.contactPhone || userPhone || 'Phone not available'}</p>
          <p className="mt-1 text-xs text-amber-100/65">{userProfile?.email || userEmail || 'Email not available'}</p>
          {userProfile?.responseSpeed && <p className="mt-1 text-xs text-amber-100/75">Response: {userProfile.responseSpeed}</p>}
          {userProfile?.classFocus && <p className="mt-2 text-xs text-amber-100/75">Classes: {userProfile.classFocus}</p>}
          {userProfile?.preferredMeetup && (
            <p className="mt-1 text-xs text-amber-100/75">Handover: {userProfile.preferredMeetup}</p>
          )}
          {userProfile?.profileTagline && (
            <p className="mt-2 rounded-lg border border-amber-200/18 bg-[#120d05] px-3 py-2 text-xs text-amber-100/85">
              {userProfile.profileTagline}
            </p>
          )}
          <p className="mt-2 text-xs text-emerald-100/85">Successful handovers: {userProfile?.successfulHandovers || 0}</p>
          <p className="mt-3 text-xs text-amber-100/60">Karma points: {userProfile?.karmaPoints || 0}</p>
          {userProfile?.bio && (
            <p className="mt-3 rounded-lg border border-amber-200/20 bg-[#120d05] px-3 py-2 text-xs text-amber-100/78">
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

        <div className="mt-6 border-t border-amber-200/15 pt-4">
          {isAuthenticated ? (
            <button onClick={onSignOut} className="profile-action-btn text-amber-100">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          ) : (
            <button onClick={onOpenAuth} className="profile-action-btn text-amber-100">
              <LogIn className="h-4 w-4" />
              Sign in
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
