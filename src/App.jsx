import React, { useEffect, useRef, useState } from 'react';
import { Home, Search, ShieldAlert, PlusCircle, Package2, Sparkles } from 'lucide-react';
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Feed from './components/Feed';
import MyPosts from './components/MyPosts';
import Requests from './components/Requests';
import Admin from './components/Admin';
import PostFlow from './components/PostFlow';
import ProfileSetup from './components/ProfileSetup';
import AuthModal from './components/AuthModal';
import EntryGateway from './components/EntryGateway';
import ProfilePanel from './components/ProfilePanel';
import { GlobalProvider } from './context/GlobalState';
import { db, auth } from './firebase';
import { requestNotificationPermission, sendLocalNotification } from './utils/notifications';

export default function App() {
  const [hasEnteredApp, setHasEnteredApp] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [isPostFlowOpen, setIsPostFlowOpen] = useState(false);
  const [isProfilePanelOpen, setIsProfilePanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('feed');
  const [selectedItem, setSelectedItem] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [notices, setNotices] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const deliveredAlertsRef = useRef(new Set());
  const currentUserUid = auth.currentUser?.uid || '';
  const currentUserPhone = auth.currentUser?.phoneNumber || '';
  const currentUserEmail = auth.currentUser?.email || '';
  const ADMIN_NUMBER = (import.meta.env.VITE_ADMIN_PHONE || '').replace(/\D/g, '');
  const normalizedCurrentPhone = currentUserPhone.replace(/\D/g, '');
  const isAdmin = !!auth.currentUser && ((ADMIN_NUMBER && normalizedCurrentPhone === ADMIN_NUMBER) || userProfile?.isAdmin === true);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get('item');

    if (!itemId) return;
    setHasEnteredApp(true);

    const fetchSingleItem = async () => {
      try {
        const docRef = doc(db, 'notices', itemId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSelectedItem({ id: docSnap.id, ...docSnap.data() });
          setActiveTab('feed');
        } else {
          console.warn('Deep-linked item not found:', itemId);
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
        const data = snapshot.docs.map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }));
        setNotices(data);
      },
      (error) => {
        console.error('Could not load notices', error);
      }
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const isAuth = !!user;
      setIsAuthenticated(isAuth);
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
            displayName: user.displayName || 'Parent',
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
        if (alertData.read) return;
        if (deliveredAlertsRef.current.has(alertDoc.id)) return;

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

      if (showAuthModal) {
        setShowAuthModal(false);
        return;
      }
      if (showProfileSetup) {
        setShowProfileSetup(false);
        return;
      }
      if (selectedItem) {
        setSelectedItem(null);
        return;
      }
      if (isPostFlowOpen) {
        setIsPostFlowOpen(false);
        return;
      }
      if (isProfilePanelOpen) {
        setIsProfilePanelOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showAuthModal, showProfileSetup, selectedItem, isPostFlowOpen, isProfilePanelOpen]);

  const handleProtectedAction = (action) => {
    if (isAuthenticated || auth.currentUser) {
      action();
    } else {
      setPendingAction(() => action);
      setShowAuthModal(true);
    }
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const flushPendingAction = () => {
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const openPostFlow = () => {
    handleProtectedAction(() => {
      setActiveTab('feed');
      setIsPostFlowOpen(true);
      setIsProfilePanelOpen(false);
    });
  };

  const openMyPosts = () => {
    handleProtectedAction(() => {
      setActiveTab('profile');
      setIsProfilePanelOpen(false);
    });
  };

  const openProfileView = () => {
    setIsProfilePanelOpen(true);
  };

  const openProfileEditor = () => {
    setIsProfilePanelOpen(false);
    setShowProfileSetup(true);
  };

  const openRequests = () => {
    setActiveTab('requests');
    setIsProfilePanelOpen(false);
  };

  const openAdmin = () => {
    setActiveTab('admin');
    setIsProfilePanelOpen(false);
  };

  const enterForListing = () => {
    setHasEnteredApp(true);
    setActiveTab('feed');
    openPostFlow();
  };

  const enterForFindRequest = () => {
    setHasEnteredApp(true);
    setActiveTab('requests');
  };

  const enterForProfile = () => {
    setHasEnteredApp(true);
    setActiveTab('feed');
    setIsProfilePanelOpen(true);
  };

  const getTopTabClass = (tabKey) =>
    `rounded-full px-5 py-2.5 text-sm font-semibold transition ${
      activeTab === tabKey
        ? 'bg-amber-200 text-[#2f2208] shadow-[0_16px_28px_-18px_rgba(250,209,110,0.88)]'
        : 'text-amber-100/82 hover:bg-amber-100/12 hover:text-amber-50'
    }`;

  const getMobileTabClass = (tabKey) =>
    `relative flex flex-col items-center justify-center rounded-xl px-3 py-2.5 transition-all ${
      activeTab === tabKey
        ? 'bg-amber-200/24 text-amber-50 border border-amber-200/50 shadow-[0_14px_24px_-18px_rgba(250,209,110,0.75)]'
        : 'text-amber-100/72 border border-transparent'
    }`;

  const activeTabMeta = {
    feed: 'Explore live student listings',
    requests: 'Post what you need and get matched',
    profile: 'Manage your listings and pickups',
    admin: 'Moderation and reports console',
  };

  return (
    <GlobalProvider>
      <div className={`app-shell overflow-x-hidden ${hasEnteredApp ? 'app-shell-market' : ''}`}>
        {!hasEnteredApp ? (
          <EntryGateway onChooseList={enterForListing} onChooseFind={enterForFindRequest} onChooseProfile={enterForProfile} />
        ) : (
          <>
            <div className="market-shell relative z-10 min-h-screen">
              <div className="market-topbar sticky top-0 z-40 border-b border-amber-300/30 bg-black/45 backdrop-blur-xl">
                <div className="safe-inline mx-auto flex w-full max-w-[1720px] items-center justify-between gap-3 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="brand-mark hidden h-11 w-11 items-center justify-center rounded-2xl border border-amber-100/45 bg-amber-200/20 text-amber-100 sm:flex">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100/65">Trusted Student Marketplace</p>
                      <h1 className="font-display mt-0.5 truncate text-[1.75rem] font-semibold text-amber-50 sm:text-[2rem]">Vidya Share</h1>
                      <p className="hidden text-[11px] text-amber-100/72 lg:block">{activeTabMeta[activeTab] || activeTabMeta.feed}</p>
                    </div>
                  </div>

                  <nav className="hidden items-center gap-2 lg:flex">
                    <button onClick={() => setActiveTab('feed')} className={getTopTabClass('feed')}>Explore</button>
                    <button onClick={openRequests} className={getTopTabClass('requests')}>Requests</button>
                    <button onClick={openMyPosts} className={getTopTabClass('profile')}>My items</button>
                  </nav>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={openPostFlow}
                      className="btn-primary hidden items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold md:inline-flex"
                    >
                      <PlusCircle className="h-4 w-4" />
                      New Listing
                    </button>
                    <button
                      onClick={() => setIsProfilePanelOpen(true)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-200/25 bg-[#1d1506]/80 text-amber-100 transition hover:border-amber-200/45 hover:text-amber-50 sm:h-11 sm:w-11"
                      aria-label="Open profile"
                    >
                      <Package2 className="h-5 w-5" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={openAdmin}
                        className="rounded-full border border-amber-200/30 px-4 py-2 text-xs font-semibold text-amber-100/85 transition hover:bg-amber-100/10"
                      >
                        Admin
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <main className="market-main safe-inline mx-auto mt-3 w-full max-w-[1700px] pt-4 sm:mt-4">
                {activeTab === 'feed' && (
                  <Feed
                    notices={notices}
                    userProfile={userProfile}
                    onStartListing={openPostFlow}
                    onOpenRequests={openRequests}
                    onRequireAuth={() => setShowAuthModal(true)}
                    onConnectClick={(itemId) => handleProtectedAction(() => console.log('Connecting to item', itemId))}
                  />
                )}
                {activeTab === 'requests' && <Requests userProfile={userProfile} onRequireAuth={() => setShowAuthModal(true)} />}
                {activeTab === 'profile' && <MyPosts />}
                {activeTab === 'admin' && <Admin isAdmin={isAdmin} />}
              </main>
            </div>

            <div className="safe-inline fixed inset-x-0 bottom-0 z-40 pb-[max(env(safe-area-inset-bottom),0.45rem)] lg:hidden">
              <div className="surface-panel gold-ring mx-auto flex max-w-md items-center justify-between rounded-[1.4rem] px-2 py-2">
                <button onClick={() => setActiveTab('feed')} className={getMobileTabClass('feed')} aria-label="Explore listings">
                  <Home className="h-5 w-5" />
                  <span className="mt-0.5 text-[11px] font-semibold">Explore</span>
                </button>
                <button onClick={openRequests} className={getMobileTabClass('requests')} aria-label="Find or request">
                  <Search className="h-5 w-5" />
                  <span className="mt-0.5 text-[11px] font-semibold">Request</span>
                </button>
                <button
                  onClick={openPostFlow}
                  className="btn-primary -mt-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-100/50 shadow-lg"
                  aria-label="List a new item"
                >
                  <PlusCircle className="h-7 w-7" />
                </button>
                <button onClick={openMyPosts} className={getMobileTabClass('profile')} aria-label="My posts">
                  <Package2 className="h-5 w-5" />
                  <span className="mt-0.5 text-[11px] font-semibold">My Posts</span>
                </button>
                {isAdmin ? (
                  <button onClick={openAdmin} className={getMobileTabClass('admin')} aria-label="Admin">
                    <ShieldAlert className="h-5 w-5" />
                    <span className="mt-0.5 text-[11px] font-semibold">Admin</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsProfilePanelOpen(true)}
                    className="rounded-xl border border-amber-200/20 px-3 py-2 text-[11px] font-semibold text-amber-100/80"
                    aria-label="Profile"
                  >
                    Profile
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        <ProfilePanel
          isOpen={hasEnteredApp && isProfilePanelOpen}
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
          onEditProfile={openProfileEditor}
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

        {hasEnteredApp && isPostFlowOpen && (
          <div className="fixed inset-0 z-[190] flex items-end justify-center bg-black/52 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-[2px] sm:items-center sm:p-6">
            <PostFlow userProfile={userProfile} onSuccess={() => setIsPostFlowOpen(false)} />
          </div>
        )}

        {showAuthModal && (
          <AuthModal
            key="auth"
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => {
              setShowAuthModal(false);
              handleLoginSuccess();
            }}
          />
        )}

        {hasEnteredApp && showProfileSetup && (
          <ProfileSetup
            initialProfile={userProfile || {}}
            onClose={() => setShowProfileSetup(false)}
            onComplete={(savedProfile) => {
              if (savedProfile) setUserProfile(savedProfile);
              setShowProfileSetup(false);
              flushPendingAction();
            }}
          />
        )}

        {hasEnteredApp && selectedItem && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/78 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md">
            <div className="surface-panel w-full max-w-lg rounded-[1.7rem] p-6">
              <div className="mb-4 flex items-start justify-between">
                <h2 className="font-display text-xl font-semibold text-amber-50">Shared Listing</h2>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="rounded-lg border border-amber-200/20 px-3 py-1.5 text-sm text-amber-100/80 transition hover:border-amber-200/40 hover:text-amber-50"
                >
                  Close
                </button>
              </div>
              <p className="mb-2 text-xs text-amber-100/60">Listing ID: {selectedItem.id}</p>
              <h3 className="font-display mb-2 text-2xl font-semibold text-amber-50">{selectedItem.title || 'Untitled'}</h3>
              <p className="text-sm leading-relaxed text-amber-100/80">
                {selectedItem.description || 'No description available for this listing yet.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </GlobalProvider>
  );
}
