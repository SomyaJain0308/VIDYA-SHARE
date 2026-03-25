import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Home, Package2, PlusCircle, Search, ShieldAlert, ShoppingCart, UserCircle2 } from 'lucide-react';
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import BrandLogo from './components/BrandLogo';
import Feed from './components/Feed';
import AppErrorBoundary from './components/AppErrorBoundary';
import { auth, db } from './firebase';
import { requestNotificationPermission, sendLocalNotification } from './utils/notifications';

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

const Requests = lazyWithReload(() => import('./components/Requests'), 'vidya-share:retry:requests');
const MyPosts = lazyWithReload(() => import('./components/MyPosts'), 'vidya-share:retry:myposts');
const Admin = lazyWithReload(() => import('./components/Admin'), 'vidya-share:retry:admin');
const PostFlow = lazyWithReload(() => import('./components/PostFlow'), 'vidya-share:retry:postflow');
const ProfileSetup = lazyWithReload(() => import('./components/ProfileSetup'), 'vidya-share:retry:profilesetup');
const AuthModal = lazyWithReload(() => import('./components/AuthModal'), 'vidya-share:retry:authmodal');
const ProfilePanel = lazyWithReload(() => import('./components/ProfilePanel'), 'vidya-share:retry:profilepanel');

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [isPostFlowOpen, setIsPostFlowOpen] = useState(false);
  const [isProfilePanelOpen, setIsProfilePanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('feed');
  const [feedCartToggleSignal, setFeedCartToggleSignal] = useState(0);
  const [feedSavedCount, setFeedSavedCount] = useState(0);
  const [selectedItem, setSelectedItem] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [notices, setNotices] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const deliveredAlertsRef = useRef(new Set());

  const currentUserUid = auth.currentUser?.uid || '';
  const currentUserPhone = auth.currentUser?.phoneNumber || '';
  const currentUserEmail = auth.currentUser?.email || '';
  const adminNumber = (import.meta.env.VITE_ADMIN_PHONE || '').replace(/\D/g, '');
  const normalizedPhone = currentUserPhone.replace(/\D/g, '');
  const isAdmin = !!auth.currentUser && ((adminNumber && normalizedPhone === adminNumber) || userProfile?.isAdmin === true);

  useEffect(() => {
    if (!isAuthenticated && !auth.currentUser) return undefined;

    const timer = window.setTimeout(() => {
      requestNotificationPermission();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [isAuthenticated]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get('item');
    if (!itemId) return;

    const fetchSingleItem = async () => {
      try {
        const docRef = doc(db, 'notices', itemId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSelectedItem({ id: docSnap.id, ...docSnap.data() });
          setActiveTab('feed');
        }
      } catch (error) {
        console.error('Error fetching deep-linked item:', error);
      }
    };

    fetchSingleItem();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'notices'),
      (snapshot) => {
        setNotices(snapshot.docs.map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() })));
      },
      (error) => {
        console.error('Could not load notices', error);
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsAuthenticated(!!user);

      if (!user) {
        setUserProfile(null);
        setShowProfileSetup(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
          setShowProfileSetup(false);
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
        console.error('Failed to load user profile:', error);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUserUid) return undefined;

    const alertsQuery = query(collection(db, 'alerts'), where('recipientId', '==', currentUserUid));
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
      if (selectedItem) return setSelectedItem(null);
      if (isPostFlowOpen) return setIsPostFlowOpen(false);
      if (isProfilePanelOpen) return setIsProfilePanelOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showAuthModal, showProfileSetup, selectedItem, isPostFlowOpen, isProfilePanelOpen]);

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

  const requireAuth = (action) => {
    if (isAuthenticated || auth.currentUser) {
      action();
      return;
    }

    setPendingAction(() => action);
    setShowAuthModal(true);
  };

  const openPostFlow = () => {
    requireAuth(() => {
      setActiveTab('feed');
      setIsProfilePanelOpen(false);
      setIsPostFlowOpen(true);
    });
  };

  const openMyPosts = () => {
    requireAuth(() => {
      setActiveTab('profile');
      setIsProfilePanelOpen(false);
    });
  };

  const openRequests = () => {
    setActiveTab('requests');
    setIsProfilePanelOpen(false);
  };

  const openAdmin = () => {
    setActiveTab('admin');
    setIsProfilePanelOpen(false);
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
    `rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
      activeTab === tabKey
        ? 'bg-cyan-200/90 text-[#041018] shadow-[0_20px_38px_-22px_rgba(91,232,255,0.48)]'
        : 'text-cyan-50/78 hover:bg-white/10 hover:text-white'
    }`;

  const mobileTabClass = (tabKey) =>
    `mobile-dock-tab relative flex flex-col items-center justify-center rounded-xl px-3 py-2.5 transition-all ${
      activeTab === tabKey
        ? 'bg-cyan-300/18 text-white border border-cyan-300/45 shadow-[0_14px_24px_-18px_rgba(91,232,255,0.34)]'
        : 'text-cyan-50/72 border border-transparent'
    }`;

  const openProfilePanel = () => setIsProfilePanelOpen(true);

  return (
    <AppErrorBoundary>
      <div className="app-shell app-shell-market overflow-x-hidden">
        <div className="market-shell relative z-10 min-h-screen">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[360px] bg-[radial-gradient(circle_at_15%_0%,rgba(79,215,255,0.18),transparent_34%),radial-gradient(circle_at_84%_8%,rgba(0,122,255,0.12),transparent_32%),linear-gradient(180deg,rgba(0,0,0,0.36),transparent)]" />

          <div className="market-topbar fixed inset-x-0 top-0 z-50">
            <div className="safe-inline py-3.5">
              <div className="topbar-shell mx-auto flex w-full max-w-[1760px] flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-5 sm:py-3.5 lg:flex-nowrap lg:gap-4 lg:px-7">
                <div className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none">
                  <BrandLogo
                    className="min-w-0 flex-1"
                    markClassName="h-11 w-11 sm:h-14 sm:w-14"
                    title="Vidya Share"
                    subtitle=""
                    titleClassName="font-display truncate text-[1.42rem] font-semibold tracking-[0.04em] text-white sm:text-[1.96rem]"
                  />
                </div>

                <nav className="hidden items-center gap-2 rounded-full border border-cyan-300/14 bg-white/[0.03] px-2 py-2 lg:flex">
                  <button onClick={() => setActiveTab('feed')} className={topTabClass('feed')}>Explore</button>
                  <button onClick={openRequests} className={topTabClass('requests')}>Requests</button>
                  <button onClick={openMyPosts} className={topTabClass('profile')}>My items</button>
                </nav>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setActiveTab('feed');
                      setFeedCartToggleSignal((prev) => prev + 1);
                    }}
                    className="topbar-action relative min-w-[5.2rem] px-3 py-2 text-sm font-semibold"
                    aria-label="Open saved cart"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    <span className="hidden sm:inline">Cart</span>
                    <span className="inline-flex min-w-[1.35rem] items-center justify-center rounded-full bg-cyan-300 px-1.5 py-0.5 text-[11px] font-bold leading-none text-[#041018]">
                      {feedSavedCount}
                    </span>
                  </button>

                  <button
                    onClick={openProfilePanel}
                    className="topbar-action hidden px-4 py-2 text-sm font-semibold md:inline-flex"
                    aria-label="Open profile"
                  >
                    <UserCircle2 className="h-4 w-4" />
                    Profile
                  </button>

                  <button
                    onClick={openPostFlow}
                    className="btn-primary hidden items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold md:inline-flex"
                  >
                    <PlusCircle className="h-4 w-4" />
                    New Listing
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

          <main className="market-main safe-inline mx-auto mt-1 w-full max-w-[1760px] pt-24 sm:pt-28">
            {activeTab === 'feed' ? (
              <Feed
                notices={notices}
                userProfile={userProfile}
                onStartListing={openPostFlow}
                onOpenRequests={openRequests}
                onRequireAuth={() => setShowAuthModal(true)}
                cartToggleSignal={feedCartToggleSignal}
                onSavedCountChange={setFeedSavedCount}
              />
            ) : null}

            {activeTab === 'requests' ? (
              <Suspense fallback={screenFallback('Loading requests')}>
                <Requests userProfile={userProfile} onRequireAuth={() => setShowAuthModal(true)} />
              </Suspense>
            ) : null}

            {activeTab === 'profile' ? (
              <Suspense fallback={screenFallback('Loading my posts')}>
                <MyPosts />
              </Suspense>
            ) : null}

            {activeTab === 'admin' ? (
              <Suspense fallback={screenFallback('Loading admin')}>
                <Admin isAdmin={isAdmin} />
              </Suspense>
            ) : null}
          </main>
        </div>

        <div className="safe-inline fixed inset-x-0 bottom-0 z-40 pb-[max(env(safe-area-inset-bottom),0.45rem)] lg:hidden">
          <div className="mobile-bottom-dock gold-ring mx-auto grid max-w-md grid-cols-5 items-center gap-1 px-2 py-2 shadow-[0_24px_50px_-30px_rgba(0,0,0,0.92)]">
            <button onClick={() => setActiveTab('feed')} className={mobileTabClass('feed')} aria-label="Explore listings">
              <Home className="h-5 w-5" />
              <span className="mt-0.5 text-[11px] font-semibold">Explore</span>
            </button>
            <button onClick={openRequests} className={mobileTabClass('requests')} aria-label="Find or request">
              <Search className="h-5 w-5" />
              <span className="mt-0.5 text-[11px] font-semibold">Request</span>
            </button>
            <button
              onClick={openPostFlow}
              className="mobile-bottom-dock__center btn-primary flex h-14 w-full items-center justify-center border border-cyan-100/50 shadow-lg"
              aria-label="List a new item"
            >
              <PlusCircle className="h-7 w-7" />
            </button>
            <button onClick={openMyPosts} className={mobileTabClass('profile')} aria-label="My posts">
              <Package2 className="h-5 w-5" />
              <span className="mt-0.5 text-[11px] font-semibold">My Posts</span>
            </button>
            {isAdmin ? (
              <button onClick={openAdmin} className={mobileTabClass('admin')} aria-label="Admin">
                <ShieldAlert className="h-5 w-5" />
                <span className="mt-0.5 text-[11px] font-semibold">Admin</span>
              </button>
            ) : (
              <button onClick={openProfilePanel} className={mobileTabClass('account')} aria-label="Profile">
                <UserCircle2 className="h-5 w-5" />
                <span className="mt-0.5 text-[11px] font-semibold">Profile</span>
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
            onOpenRequests={openRequests}
            onOpenMyPosts={openMyPosts}
            onOpenAdmin={openAdmin}
            onEditProfile={() => {
              setIsProfilePanelOpen(false);
              setShowProfileSetup(true);
            }}
            onSignOut={async () => {
              try {
                await signOut(auth);
              } catch (error) {
                console.error('Sign out failed', error);
              } finally {
                setIsProfilePanelOpen(false);
                setActiveTab('feed');
              }
            }}
          />
        </Suspense>

        {isPostFlowOpen ? (
          <Suspense fallback={overlayFallback('Loading listing flow')}>
            <div className="fixed inset-0 z-[190] overflow-y-auto bg-[#071019] p-0 sm:flex sm:items-center sm:justify-center sm:bg-black/78 sm:p-6 sm:backdrop-blur-[2px]">
              <PostFlow
                userProfile={userProfile}
                onSuccess={() => setIsPostFlowOpen(false)}
                onClose={() => setIsPostFlowOpen(false)}
                onOpenProfileSetup={openProfileEditorFromPostFlow}
              />
            </div>
          </Suspense>
        ) : null}

        {showAuthModal ? (
          <Suspense fallback={overlayFallback('Loading sign in')}>
            <AuthModal
              onClose={() => setShowAuthModal(false)}
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

        {selectedItem ? (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/78 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md">
            <div className="surface-panel w-full max-w-lg rounded-[1.7rem] border border-cyan-300/16 p-6">
              <div className="mb-4 flex items-start justify-between">
                <h2 className="font-display text-xl font-semibold text-white">Shared Listing</h2>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="rounded-lg border border-cyan-300/18 bg-[#08111a]/86 px-3 py-1.5 text-sm text-cyan-50/82 transition hover:border-cyan-300/36 hover:text-white"
                >
                  Close
                </button>
              </div>
              <p className="mb-2 text-xs text-cyan-50/56">Listing ID: {selectedItem.id}</p>
              <h3 className="font-display mb-2 text-2xl font-semibold text-white">{selectedItem.title || 'Untitled'}</h3>
              <p className="text-sm leading-relaxed text-cyan-50/78">
                {selectedItem.description || 'No description available for this listing yet.'}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </AppErrorBoundary>
  );
}
