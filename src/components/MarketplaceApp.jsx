import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Home, LogIn, PlusCircle, ShieldAlert, UserCircle2 } from 'lucide-react';
import { collection, deleteField, doc, getDoc, limit, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { getIdTokenResult, onAuthStateChanged, signOut } from 'firebase/auth';
import { useLocation, useNavigate } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import Feed from './Feed';
import ComplianceFooter from './ComplianceFooter';
import { auth, db } from '../firebase';
import { sendLocalNotification } from '../utils/notifications';
import { buildListingPath } from '../utils/listings';
import { fetchListingFeedPage } from '../utils/firestoreMarketplaceQueries';
import { syncAnalyticsUserContext, trackListingClick } from '../utils/analytics';
import { getOrCreateConversation } from '../utils/chat';

const lazyWithReload = (importer, cacheKey) =>
  lazy(async () => {
    try {
      const module = await importer();
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(cacheKey);
      }
      return module;
    } catch (error) {
      const isChunkIssue =
        error?.name === 'ChunkLoadError' ||
        /Failed to fetch dynamically imported module/i.test(error?.message || '') ||
        /Importing a module script failed/i.test(error?.message || '');

      if (typeof window !== 'undefined' && isChunkIssue) {
        const hasRetried = window.sessionStorage.getItem(cacheKey) === '1';
        if (!hasRetried) {
          window.sessionStorage.setItem(cacheKey, '1');
          window.location.reload();
        }
      }

      throw error;
    }
  });

const Requests = lazyWithReload(() => import('./Requests'), 'vidya-share:retry:requests');
const MyPosts = lazyWithReload(() => import('./MyPosts'), 'vidya-share:retry:myposts');
const Admin = lazyWithReload(() => import('./Admin'), 'vidya-share:retry:admin');
const PostFlow = lazyWithReload(() => import('./PostFlow'), 'vidya-share:retry:postflow');
const ProfileSetup = lazyWithReload(() => import('./ProfileSetup'), 'vidya-share:retry:profilesetup');
const AuthModal = lazyWithReload(() => import('./AuthModal'), 'vidya-share:retry:authmodal');
const ProfilePanel = lazyWithReload(() => import('./ProfilePanel'), 'vidya-share:retry:profilepanel');
const ListingDetailPage = lazyWithReload(() => import('./ListingDetailPage'), 'vidya-share:retry:listingdetail');
const Chats = lazyWithReload(() => import('./Chats'), 'vidya-share:retry:chats');

export default function MarketplaceApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const [isAuthTransitioning, setIsAuthTransitioning] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [isPostFlowOpen, setIsPostFlowOpen] = useState(false);
  const [isProfilePanelOpen, setIsProfilePanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('feed');
  const [feedCartToggleSignal, setFeedCartToggleSignal] = useState(0);
  const [, setFeedSavedCount] = useState(0);
  const [pendingAction, setPendingAction] = useState(null);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [publicListings, setPublicListings] = useState([]);
  const [listingsCursor, setListingsCursor] = useState(null);
  const [hasMoreListings, setHasMoreListings] = useState(false);
  const [isListingsLoading, setIsListingsLoading] = useState(false);
  const [isLoadingMoreListings, setIsLoadingMoreListings] = useState(false);
  const [listingsLoadError, setListingsLoadError] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const authRequestIdRef = useRef(0);
  const deliveredAlertsRef = useRef(new Set());
  const listingRouteMatch = /^\/listing\/([^/]+)\/?$/.exec(location.pathname || '');
  const isListingRoute = Boolean(listingRouteMatch?.[1]);

  const currentUserUid = auth.currentUser?.uid || '';
  const currentUserPhone = auth.currentUser?.phoneNumber || '';
  const currentUserEmail = auth.currentUser?.email || '';

  const loadListingFeedPage = useCallback(async ({ reset = false } = {}) => {
    if (reset) {
      setIsListingsLoading(true);
      setListingsLoadError('');
    } else {
      if (!hasMoreListings && listingsCursor) return;
      setIsLoadingMoreListings(true);
    }

    try {
      const page = await fetchListingFeedPage({
        db,
        afterDoc: reset ? null : listingsCursor,
      });

      setPublicListings((prev) => {
        if (reset) return page.docs;
        const byId = new Map(prev.map((entry) => [entry.id, entry]));
        page.docs.forEach((entry) => byId.set(entry.id, entry));
        return Array.from(byId.values());
      });
      setListingsCursor(page.cursor);
      setHasMoreListings(page.hasMore);
    } catch (error) {
      console.error('Could not load public listings', error);
      setListingsLoadError(String(error?.message || 'Could not load listings right now.'));
    } finally {
      setIsListingsLoading(false);
      setIsLoadingMoreListings(false);
    }
  }, [hasMoreListings, listingsCursor]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const itemId = params.get('item');
    if (!itemId) return undefined;
    navigate(buildListingPath(itemId), { replace: true });
    return undefined;
  }, [location.search, navigate]);

  useEffect(() => {
    loadListingFeedPage({ reset: true });
  }, [loadListingFeedPage]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const requestId = authRequestIdRef.current + 1;
      authRequestIdRef.current = requestId;
      setIsAuthTransitioning(true);
      setIsAuthenticated(!!user);

      if (!user) {
        setIsAdmin(false);
        setUserProfile(null);
        setShowProfileSetup(false);
        setShowAuthModal(false);
        setFeedSavedCount(0);
        if (authRequestIdRef.current === requestId) {
          setIsAuthResolved(true);
          setIsAuthTransitioning(false);
        }
        return;
      }

      try {
        const tokenResult = await getIdTokenResult(user);
        if (authRequestIdRef.current !== requestId || auth.currentUser?.uid !== user.uid) return;
        setIsAdmin(Boolean(tokenResult?.claims?.admin === true));

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (authRequestIdRef.current !== requestId || auth.currentUser?.uid !== user.uid) return;
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
          setShowProfileSetup(false);
          setShowAuthModal(false);
          setPendingAction((prev) => {
            if (prev) prev();
            return null;
          });
        } else {
          setUserProfile({
            displayName: user.displayName || '',
            primarySchool: user.school || '',
            publicProfile: true,
            email: user.email || '',
            phone: user.phoneNumber || '',
            contactPhone: user.phoneNumber || '',
          });
          setShowProfileSetup(true);
        }
      } catch (error) {
        if (authRequestIdRef.current !== requestId) return;
        setIsAdmin(false);
        setUserProfile(null);
        setShowProfileSetup(false);
        console.error('Failed to load user profile:', error);
      } finally {
        if (authRequestIdRef.current === requestId) {
          setIsAuthResolved(true);
          setIsAuthTransitioning(false);
        }
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    syncAnalyticsUserContext({
      isAuthenticated: Boolean(isAuthenticated || auth.currentUser),
      role: userProfile?.role || '',
      primarySchool: userProfile?.primarySchool || '',
      isAdmin,
    });
  }, [isAdmin, isAuthenticated, userProfile?.primarySchool, userProfile?.role]);

  useEffect(() => {
    if (!currentUserUid) return undefined;

    const alertsQuery = query(collection(db, 'alerts'), where('recipientId', '==', currentUserUid), limit(10));
    const unsubscribe = onSnapshot(alertsQuery, (snapshot) => {
      snapshot.docs.forEach(async (alertDoc) => {
        const alertData = alertDoc.data();
        if (alertData.read || deliveredAlertsRef.current.has(alertDoc.id)) return;

        deliveredAlertsRef.current.add(alertDoc.id);
        sendLocalNotification(alertData.title || 'New Alert', alertData.body || 'There is a new match for you.');

        try {
          await updateDoc(doc(db, 'alerts', alertDoc.id), {
            read: true,
            readAt: serverTimestamp(),
            recipientPhone: deleteField(),
          });
        } catch (error) {
          console.error('Failed to mark alert as read', error);
        }
      });
    });

    return unsubscribe;
  }, [currentUserUid]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (showAuthModal) return setShowAuthModal(false);
      if (showProfileSetup) return setShowProfileSetup(false);
      if (isPostFlowOpen) return setIsPostFlowOpen(false);
      if (isProfilePanelOpen) return setIsProfilePanelOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showAuthModal, showProfileSetup, isPostFlowOpen, isProfilePanelOpen]);

  useEffect(() => {
    if (!isPostFlowOpen) return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isPostFlowOpen]);

  const goHome = () => {
    if (location.pathname !== '/') {
      navigate('/');
    }
  };

  const requireAuth = (action = () => {}) => {
    if (!isAuthResolved || isAuthTransitioning) {
      return;
    }
    if (isAuthenticated || auth.currentUser) {
      action();
      return;
    }

    setPendingAction(() => action);
    setShowAuthModal(true);
  };

  const closeAuthModal = () => {
    setPendingAction(null);
    setShowAuthModal(false);
  };

  const openListing = (listingId, analyticsContext = null) => {
    if (!listingId) return;
    setIsProfilePanelOpen(false);
    setIsPostFlowOpen(false);
    if (analyticsContext?.listing) {
      trackListingClick({
        listing: analyticsContext.listing,
        surface: analyticsContext.surface || 'feed',
        authState: auth.currentUser?.uid ? 'signed_in' : 'guest',
        index: analyticsContext.index,
      });
    }
    navigate(buildListingPath(listingId));
  };

  const openFeed = () => {
    setActiveTab('feed');
    setIsProfilePanelOpen(false);
    goHome();
  };

  const openPostFlow = () => {
    requireAuth(() => {
      setActiveTab('feed');
      setIsProfilePanelOpen(false);
      goHome();
      setIsPostFlowOpen(true);
    });
  };

  const openMyPosts = () => {
    requireAuth(() => {
      setActiveTab('profile');
      setIsProfilePanelOpen(false);
      goHome();
    });
  };

  const openRequests = () => {
    requireAuth(() => {
      setActiveTab('requests');
      setIsProfilePanelOpen(false);
      goHome();
    });
  };

  const openChats = () => {
    requireAuth(() => {
      setActiveTab('chats');
      setIsProfilePanelOpen(false);
      goHome();
    });
  };

  const openChatFromListing = (listing) => {
    if (!listing?.id || !listing?.sellerId) return;

    requireAuth(async () => {
      if (auth.currentUser?.uid === listing.sellerId) {
        window.alert('This is your own listing.');
        return;
      }

      try {
        const conversationId = await getOrCreateConversation(listing.id, auth.currentUser.uid, listing.sellerId);
        setSelectedConversationId(conversationId);
        setActiveTab('chats');
        setIsProfilePanelOpen(false);
        goHome();
      } catch (error) {
        console.error('Could not open listing chat', error);
        window.alert(error?.message || 'Could not open chat right now.');
      }
    });
  };

  const openAdmin = () => {
    setActiveTab('admin');
    setIsProfilePanelOpen(false);
    goHome();
  };

  const openProfileEditorFromPostFlow = () => {
    setPendingAction(() => () => {
      setActiveTab('feed');
      setIsPostFlowOpen(true);
    });
    setIsPostFlowOpen(false);
    setIsProfilePanelOpen(false);
    setShowProfileSetup(true);
  };

  const flushPendingAction = () => {
    if (!pendingAction) return;
    pendingAction();
    setPendingAction(null);
  };

  const screenFallback = (label) => (
    <div className="safe-inline mx-auto mt-4 w-full max-w-[1760px]">
      <div className="lux-panel flex min-h-[240px] items-center justify-center p-6 text-sm font-semibold text-cyan-50/78">
        {label}...
      </div>
    </div>
  );

  const overlayFallback = (label) => (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/72 p-4 backdrop-blur-md">
      <div className="lux-panel rounded-[1.6rem] px-6 py-4 text-sm font-semibold text-cyan-50/82">{label}...</div>
    </div>
  );

  const topTabClass = (tabKey) =>
    `rounded-full px-4 py-2.5 text-[13px] font-semibold transition-all ${
      activeTab === tabKey
        ? 'bg-cyan-200/90 text-[#041018] shadow-[0_20px_38px_-22px_rgba(91,232,255,0.48)]'
        : 'text-cyan-50/78 hover:bg-white/10 hover:text-white'
    }`;

  const topUtilityClass = (isActive = false) =>
    `inline-flex items-center rounded-full px-4 py-2.5 text-[13px] font-semibold transition-all ${
      isActive
        ? 'bg-cyan-200/90 text-[#041018] shadow-[0_20px_38px_-22px_rgba(91,232,255,0.48)]'
        : 'border border-cyan-300/14 bg-white/[0.03] text-cyan-50/78 hover:bg-white/10 hover:text-white'
    }`;

  const mobileTabClass = (tabKey) =>
    `mobile-dock-tab relative flex flex-col items-center justify-center rounded-xl px-3 py-2.5 transition-all ${
      activeTab === tabKey
        ? 'bg-cyan-300/18 text-white border border-cyan-300/45 shadow-[0_14px_24px_-18px_rgba(91,232,255,0.34)]'
        : 'text-cyan-50/72 border border-transparent'
    }`;

  const openProfilePanel = () => setIsProfilePanelOpen(true);
  const openDesktopProfile = () => {
    if (!isAuthResolved || isAuthTransitioning) return;
    if (isAuthenticated || auth.currentUser) {
      setIsPostFlowOpen(false);
      setIsProfilePanelOpen(false);
      setShowProfileSetup(true);
      return;
    }
    setShowAuthModal(true);
  };

  const handleSignOut = async () => {
    if (isAuthTransitioning) return;
    setIsAuthTransitioning(true);
    setPendingAction(null);
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out failed', error);
      setIsAuthTransitioning(false);
    } finally {
      setShowAuthModal(false);
      setShowProfileSetup(false);
      setIsProfilePanelOpen(false);
      openFeed();
    }
  };

  return (
    <div className="app-shell app-shell-market overflow-x-hidden">
      <div className="market-shell relative z-10 min-h-screen">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[360px] bg-[radial-gradient(circle_at_15%_0%,rgba(79,215,255,0.18),transparent_34%),radial-gradient(circle_at_84%_8%,rgba(0,122,255,0.12),transparent_32%),linear-gradient(180deg,rgba(0,0,0,0.36),transparent)]" />

        <div className="market-topbar fixed inset-x-0 top-0 z-50">
          <div className="safe-inline py-2">
            <div className="topbar-shell mx-auto flex w-full max-w-[1760px] flex-wrap items-center justify-between gap-2.5 px-3 py-2 sm:px-4 sm:py-2.5 lg:flex-nowrap lg:gap-3 lg:px-6">
              <div className="flex min-w-0 flex-1 items-center gap-2.5 lg:flex-none">
                <BrandLogo
                  className="min-w-0 flex-1"
                  markClassName="h-10 w-10 sm:h-11 sm:w-11"
                  title="Vidya Share"
                  subtitle="Used school books in Saharanpur"
                  titleClassName="font-display truncate text-[1.28rem] font-semibold tracking-[0.04em] text-white sm:text-[1.6rem]"
                />
              </div>

              <nav className="hidden items-center gap-1.5 rounded-full border border-cyan-300/14 bg-white/[0.03] px-1.5 py-1.5 md:flex">
                <button onClick={openFeed} className={topTabClass('feed')}>Explore</button>
                <button onClick={openPostFlow} className={topUtilityClass(isPostFlowOpen)}>Sell</button>
                {isAuthenticated || auth.currentUser ? (
                  <>
                    <button onClick={openChats} className={topUtilityClass(activeTab === 'chats')}>
                      Chats
                    </button>
                    <button onClick={openRequests} className={topUtilityClass(activeTab === 'requests')}>
                      Requests
                    </button>
                    <button onClick={openMyPosts} className={topUtilityClass(activeTab === 'profile')}>
                      My Posts
                    </button>
                  </>
                ) : null}
                {isAuthenticated || auth.currentUser ? (
                  <button onClick={openDesktopProfile} className={topUtilityClass(showProfileSetup || isProfilePanelOpen)}>
                    Account
                  </button>
                ) : null}
                {!(isAuthenticated || auth.currentUser) ? (
                  <button onClick={() => {
                    if (!isAuthResolved || isAuthTransitioning) return;
                    setShowAuthModal(true);
                  }} className={topUtilityClass()}>
                    <LogIn className="h-4 w-4" />
                    Sign in
                  </button>
                ) : null}
              </nav>

              <div className="flex items-center gap-2">
                <button
                  onClick={openPostFlow}
                  className="btn-primary hidden items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold md:inline-flex"
                >
                  <PlusCircle className="h-4 w-4" />
                  Sell
                </button>

                {isAdmin ? (
                  <button
                    onClick={openAdmin}
                    className="rounded-full border border-cyan-300/18 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-cyan-50/85 transition hover:border-cyan-300/34 hover:bg-white/[0.08]"
                  >
                    Admin
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <main className="market-main safe-inline mx-auto mt-1 w-full max-w-[1760px] pt-20 sm:pt-[5.5rem]">
          {isListingRoute ? (
            <Suspense fallback={screenFallback('Loading listing')}>
              <ListingDetailPage
                listingId={listingRouteMatch?.[1] || ''}
                userProfile={userProfile}
                onRequireAuth={requireAuth}
                onNavigateHome={goHome}
                onOpenChat={openChatFromListing}
              />
            </Suspense>
          ) : null}

          {!isListingRoute && activeTab === 'feed' ? (
            <Feed
              listings={publicListings}
              listingsLoadError={listingsLoadError}
              userProfile={userProfile}
              onStartListing={openPostFlow}
              onOpenRequests={openRequests}
              onOpenListing={openListing}
              onOpenChat={openChatFromListing}
              onRequireAuth={requireAuth}
              cartToggleSignal={feedCartToggleSignal}
              onSavedCountChange={setFeedSavedCount}
              onLoadMoreListings={() => loadListingFeedPage({ reset: false })}
              hasMoreListings={hasMoreListings}
              isLoadingMoreListings={isListingsLoading || isLoadingMoreListings}
              isListingsLoading={isListingsLoading && publicListings.length === 0}
            />
          ) : null}

          {!isListingRoute && activeTab === 'requests' ? (
            <Suspense fallback={screenFallback('Loading requests')}>
              <Requests userProfile={userProfile} onRequireAuth={requireAuth} />
            </Suspense>
          ) : null}

          {!isListingRoute && activeTab === 'chats' ? (
            <Suspense fallback={screenFallback('Loading chats')}>
              <Chats
                initialConversationId={selectedConversationId}
                onConversationConsumed={() => setSelectedConversationId('')}
                onRequireAuth={requireAuth}
                onNavigateHome={goHome}
              />
            </Suspense>
          ) : null}

          {!isListingRoute && activeTab === 'profile' ? (
            <Suspense fallback={screenFallback('Loading my posts')}>
              <MyPosts />
            </Suspense>
          ) : null}

          {!isListingRoute && activeTab === 'admin' ? (
            <Suspense fallback={screenFallback('Loading admin')}>
              <Admin isAdmin={isAdmin} />
            </Suspense>
          ) : null}
        </main>

      <ComplianceFooter />
      </div>

      <div className="safe-inline fixed inset-x-0 bottom-0 z-40 pb-[max(env(safe-area-inset-bottom),0.45rem)] lg:hidden">
        <div className="mobile-bottom-dock gold-ring mx-auto grid max-w-md grid-cols-4 items-center gap-1 px-2 py-2 shadow-[0_24px_50px_-30px_rgba(0,0,0,0.92)]">
          <button onClick={openFeed} className={mobileTabClass('feed')} aria-label="Explore listings">
            <Home className="h-5 w-5" />
            <span className="mt-0.5 text-[11px] font-semibold">Explore</span>
          </button>
            <button
              onClick={openPostFlow}
              className="mobile-bottom-dock__center btn-primary flex h-14 w-full flex-col items-center justify-center gap-0.5 border border-cyan-100/50 shadow-lg"
              aria-label="Sell your books"
            >
              <PlusCircle className="h-6 w-6" />
              <span className="text-[11px] font-semibold">Sell</span>
            </button>
          {isAuthenticated || auth.currentUser ? (
            <button onClick={openProfilePanel} className={mobileTabClass('account')} aria-label="Account">
              <UserCircle2 className="h-5 w-5" />
              <span className="mt-0.5 text-[11px] font-semibold">Account</span>
            </button>
          ) : (
            <button onClick={() => {
              if (!isAuthResolved || isAuthTransitioning) return;
              setShowAuthModal(true);
            }} className={mobileTabClass('auth')} aria-label="Sign in">
              <LogIn className="h-5 w-5" />
              <span className="mt-0.5 text-[11px] font-semibold">Sign in</span>
            </button>
          )}
        </div>
      </div>

      <Suspense fallback={isProfilePanelOpen ? overlayFallback('Loading profile') : null}>
        <ProfilePanel
          isOpen={isProfilePanelOpen}
          onClose={() => setIsProfilePanelOpen(false)}
          isAuthenticated={isAuthenticated || !!auth.currentUser}
          userProfile={userProfile}
          userPhone={currentUserPhone}
          userEmail={currentUserEmail}
          isAdmin={isAdmin}
          onOpenAuth={() => {
            setIsProfilePanelOpen(false);
            setShowAuthModal(true);
          }}
          onOpenPostFlow={openPostFlow}
          onOpenChats={openChats}
          onOpenRequests={openRequests}
          onOpenMyPosts={openMyPosts}
          onOpenAdmin={openAdmin}
          onEditProfile={() => {
            setIsProfilePanelOpen(false);
            setShowProfileSetup(true);
          }}
          onSignOut={handleSignOut}
        />
      </Suspense>

      {isPostFlowOpen ? (
        <Suspense fallback={overlayFallback('Loading listing flow')}>
          <div className="fixed inset-0 z-[190] overflow-y-auto bg-[#071019] p-0 sm:flex sm:items-start sm:justify-center sm:bg-black/78 sm:p-4 sm:pt-8 sm:backdrop-blur-[2px]">
            <PostFlow
              userProfile={userProfile}
              onSuccess={async (listingId) => {
                setIsPostFlowOpen(false);
                await loadListingFeedPage({ reset: true });
                if (listingId) openListing(listingId);
              }}
              onClose={() => setIsPostFlowOpen(false)}
              onOpenProfileSetup={openProfileEditorFromPostFlow}
            />
          </div>
        </Suspense>
      ) : null}

      {showAuthModal ? (
        <Suspense fallback={overlayFallback('Loading sign in')}>
          <AuthModal
            onClose={closeAuthModal}
            onSuccess={() => {
              setShowAuthModal(false);
              setIsAuthenticated(true);
              flushPendingAction();
            }}
          />
        </Suspense>
      ) : null}

      {showProfileSetup ? (
        <Suspense fallback={overlayFallback('Loading profile setup')}>
          <ProfileSetup
            initialProfile={userProfile || {}}
            onClose={() => setShowProfileSetup(false)}
            onComplete={(savedProfile) => {
              if (savedProfile) setUserProfile(savedProfile);
              setShowProfileSetup(false);
              flushPendingAction();
            }}
          />
        </Suspense>
      ) : null}

    </div>
  );
}
