import React, { useEffect, useRef, useState } from 'react';
import { Share2, Flag, Clock, AlertTriangle, PackageOpen, ShieldCheck, User, X, ShoppingBag, Loader2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { generateWhatsAppLink } from '../utils/whatsapp';
import { normalizeSchoolInput } from '../data/schools';

const timeAgo = (timestamp) => {
  if (!timestamp) return 'Just now';
  const timestampDate =
    typeof timestamp?.toDate === 'function'
      ? timestamp.toDate()
      : timestamp instanceof Date
        ? timestamp
        : null;
  if (!timestampDate || Number.isNaN(timestampDate.getTime?.())) return 'Just now';
  const seconds = Math.floor((new Date() - timestampDate) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const withinOneEdit = (source, target) => {
  if (source === target) return true;
  const sourceLen = source.length;
  const targetLen = target.length;
  if (Math.abs(sourceLen - targetLen) > 1) return false;

  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < sourceLen && j < targetLen) {
    if (source[i] === target[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (sourceLen > targetLen) {
      i += 1;
    } else if (targetLen > sourceLen) {
      j += 1;
    } else {
      i += 1;
      j += 1;
    }
  }
  if (i < sourceLen || j < targetLen) edits += 1;
  return edits <= 1;
};

const fuzzyMatchText = (sourceText, queryText) => {
  const queryParts = (queryText || '').split(/\s+/).filter(Boolean);
  if (queryParts.length === 0) return true;
  const sourceParts = (sourceText || '').split(/\s+/).filter(Boolean);
  if (sourceParts.length === 0) return false;

  return queryParts.every((queryPart) =>
    sourceParts.some((sourcePart) => {
      if (sourcePart.includes(queryPart) || queryPart.includes(sourcePart)) return true;
      if (queryPart.length < 5 || sourcePart.length < 5) return false;
      return withinOneEdit(sourcePart, queryPart);
    })
  );
};

const DEMO_LISTINGS = [
  {
    id: 'demo-1',
    _isPreview: true,
    title: 'NCERT Class 10 Maths Combo',
    category: 'Books',
    subject: 'Mathematics',
    condition: 'Good',
    price: 180,
    school: '',
    colony: 'Aliganj',
    sellerName: 'Suhani Parent',
    photoUrl: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1200&q=80',
    status: 'active',
    successNote: 'Textbook plus exemplar set with neat pencil work only on a few pages.',
  },
  {
    id: 'demo-2',
    _isPreview: true,
    title: 'Oswaal Physics Question Bank',
    category: 'Books',
    subject: 'Physics',
    condition: 'Like New',
    price: 140,
    school: '',
    colony: 'Gomti Nagar',
    sellerName: 'Dev Student',
    photoUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=80',
    status: 'active',
    successNote: 'Useful for board numericals and chapter-wise revision.',
  },
  {
    id: 'demo-3',
    _isPreview: true,
    title: 'Together With English Practice Book',
    category: 'Books',
    subject: 'English',
    condition: 'Good',
    price: 95,
    school: '',
    colony: 'Indira Nagar',
    sellerName: 'Rhea Guardian',
    photoUrl: 'https://images.unsplash.com/photo-1491841550275-ad7854e35ca6?auto=format&fit=crop&w=1200&q=80',
    status: 'active',
    successNote: 'Most worksheets untouched, cover slightly folded.',
  },
  {
    id: 'demo-4',
    _isPreview: true,
    title: 'Class 12 Chemistry Notes Bundle',
    category: 'Books',
    subject: 'Chemistry',
    condition: 'Fair',
    price: 70,
    school: '',
    colony: 'Mahanagar',
    sellerName: 'Aditi Student',
    photoUrl: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1200&q=80',
    status: 'active',
    successNote: 'Organic, inorganic, and practical notes clipped together.',
  },
  {
    id: 'demo-5',
    _isPreview: true,
    title: 'Biology NCERT + Diagrams Notebook',
    category: 'Books',
    subject: 'Biology',
    condition: 'Good',
    price: 130,
    school: '',
    colony: 'Hazratganj',
    sellerName: 'Kashvi Student',
    photoUrl: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=1200&q=80',
    status: 'active',
    successNote: 'Helpful labeled diagrams and chapter summaries included.',
  },
  {
    id: 'demo-6',
    _isPreview: true,
    title: 'Accountancy Sample Papers 2026',
    category: 'Books',
    subject: 'Accountancy',
    condition: 'Like New',
    price: 110,
    school: '',
    colony: 'Ashiyana',
    sellerName: 'Vihaan Student',
    photoUrl: 'https://images.unsplash.com/photo-1524578271613-d550eacf6090?auto=format&fit=crop&w=1200&q=80',
    status: 'active',
    successNote: 'Latest sample paper edition with solved answers.',
  },
];

export default function Feed({
  notices,
  userProfile,
  onStartListing,
  onOpenRequests,
  onRequireAuth,
  cartToggleSignal = 0,
  onSavedCountChange,
}) {
  const NETWORK_CITY = 'Lucknow';
  const stageRef = useRef(null);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
  );
  const [schoolFilter, setSchoolFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Books');
  const [searchQuery, setSearchQuery] = useState('');
  const [recencyFilter, setRecencyFilter] = useState('all');
  const [sortMode, setSortMode] = useState('bestMatch');
  const [colonyFilter, setColonyFilter] = useState('all');
  const [showSold, setShowSold] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [reportedItems, setReportedItems] = useState([]);
  const [savedOffers, setSavedOffers] = useState([]);
  const [savingOfferId, setSavingOfferId] = useState('');
  const [cardImageIndexById, setCardImageIndexById] = useState({});
  const [sellerProfiles, setSellerProfiles] = useState({});
  const [activeProfile, setActiveProfile] = useState(null);
  const [featuredBookIndex, setFeaturedBookIndex] = useState(0);
  const [bookSubjectFilter, setBookSubjectFilter] = useState('all');
  const [showStageFilters, setShowStageFilters] = useState(false);
  const [reserveNotice, setReserveNotice] = useState(null);
  const [reserveForm, setReserveForm] = useState({ preferredMeetup: '', preferredTime: '', note: '' });
  const [isReserveSubmitting, setIsReserveSubmitting] = useState(false);
  const [reserveError, setReserveError] = useState('');
  const [reservedNoticeIds, setReservedNoticeIds] = useState([]);
  const [visibleNoticeCount, setVisibleNoticeCount] = useState(12);
  const currentUserId = auth.currentUser?.uid || '';

  const categories = ['Books'];
  const recencyOptions = [
    { value: 'all', label: 'All' },
    { value: '24h', label: '24h' },
    { value: '7d', label: '7d' },
    { value: '30d', label: '30d' },
  ];
  const sortOptions = [
    { value: 'bestMatch', label: 'Best match' },
    { value: 'newest', label: 'Newest first' },
    { value: 'priceLow', label: 'Price low-high' },
    { value: 'priceHigh', label: 'Price high-low' },
  ];
  const colonyOptions = [
    { value: 'all', label: 'All' },
    { value: 'myColony', label: 'My colony' },
    { value: 'sameSchool', label: 'Same institution' },
  ];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const schoolParam = params.get('school');
    if (schoolParam) setSchoolFilter(normalizeSchoolInput(schoolParam));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleViewportChange = (event) => {
      setIsDesktopViewport(event.matches);
    };

    setIsDesktopViewport(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleViewportChange);
      return () => mediaQuery.removeEventListener('change', handleViewportChange);
    }

    mediaQuery.addListener(handleViewportChange);
    return () => mediaQuery.removeListener(handleViewportChange);
  }, []);

  useEffect(() => {
    if (schoolFilter) {
      setSchoolFilter('');
    }
  }, [schoolFilter]);

  useEffect(() => {
    if (!currentUserId) {
      setSavedOffers([]);
      return undefined;
    }

    const savedQuery = query(collection(db, 'savedOffers'), where('userId', '==', currentUserId));
    const unsubscribe = onSnapshot(savedQuery, (snapshot) => {
      const nextSaved = [];
      snapshot.forEach((entry) => {
        const data = entry.data();
        if (data?.noticeId) nextSaved.push(data.noticeId);
      });
      setSavedOffers(nextSaved);
    });

    return () => unsubscribe();
  }, [currentUserId]);

  useEffect(() => {
    if (typeof onSavedCountChange === 'function') {
      onSavedCountChange(savedOffers.length);
    }
  }, [onSavedCountChange, savedOffers.length]);

  useEffect(() => {
    if (!cartToggleSignal) return;
    setShowSavedOnly((prev) => !prev);
  }, [cartToggleSignal]);

  useEffect(() => {
    const sellerIds = [...new Set((notices || []).map((notice) => notice.sellerId).filter(Boolean))];
    if (sellerIds.length === 0) return;
    let cancelled = false;

    const loadSellerProfiles = async () => {
      const profileEntries = await Promise.all(
        sellerIds.map(async (sellerId) => {
          try {
            const profileDoc = await getDoc(doc(db, 'users', sellerId));
            return [sellerId, profileDoc.exists() ? profileDoc.data() : null];
          } catch (error) {
            console.error('Failed to load seller profile', error);
            return [sellerId, null];
          }
        })
      );

      if (cancelled) return;
      setSellerProfiles((prev) => {
        const next = { ...prev };
        profileEntries.forEach(([sellerId, data]) => {
          if (data) next[sellerId] = data;
        });
        return next;
      });
    };

    loadSellerProfiles();
    return () => {
      cancelled = true;
    };
  }, [notices]);

  const handleReport = async (item) => {
    if (!window.confirm('Report this listing? It will be hidden from your feed immediately.')) return;

    setReportedItems((prev) => [...prev, item.id]);
    try {
      await addDoc(collection(db, 'reports'), {
        reportedItemId: item.id,
        sellerId: item.sellerId,
        reason: 'User Flagged',
        reportedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Report failed', error);
    }
  };

  const handleNativeShare = async (item) => {
    const shareUrl = `${window.location.origin}?item=${item.id}`;
    const shareData = {
      title: `Vidya Share: ${item.title}`,
      text: `Look at this ${item.title} on Vidya Share for ${item.price === 0 ? 'FREE' : `Rs ${item.price}`}.`,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        alert('Link copied to clipboard.');
      }
    } catch (error) {
      console.log('Share failed', error);
    }
  };

  const openSellerProfile = (notice) => {
    const profile = sellerProfiles[notice.sellerId] || {};
    if (profile.publicProfile === false) {
      alert('This seller has hidden their public profile.');
      return;
    }

    setActiveProfile({
      ...profile,
      fallbackSchool: notice.school || '',
      fallbackName: notice.sellerName || 'Community Member',
      phoneFromListing: notice.sellerPhone || '',
    });
  };

  const toggleSaveOffer = async (noticeId) => {
    if (!noticeId) return;

    if (!auth.currentUser) {
      if (onRequireAuth) {
        onRequireAuth();
      } else {
        alert('Please sign in to save offers.');
      }
      return;
    }

    const docId = `${auth.currentUser.uid}_${noticeId}`;
    const alreadySaved = savedOffers.includes(noticeId);
    setSavingOfferId(noticeId);
    try {
      if (alreadySaved) {
        await deleteDoc(doc(db, 'savedOffers', docId));
      } else {
        await setDoc(doc(db, 'savedOffers', docId), {
          userId: auth.currentUser.uid,
          noticeId,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Could not update saved offer', error);
      alert('Could not save this offer right now.');
    } finally {
      setSavingOfferId('');
    }
  };

  const openReserveModal = (notice) => {
    if (!auth.currentUser) {
      alert('Please sign in to reserve a listing.');
      return;
    }
    if (auth.currentUser.uid === notice.sellerId) {
      alert('This is your own listing.');
      return;
    }
    setReserveNotice(notice);
    setReserveError('');
    setReserveForm({
      preferredMeetup: userProfile?.preferredMeetup || '',
      preferredTime: '',
      note: '',
    });
  };

  const closeReserveModal = () => {
    setReserveNotice(null);
    setReserveError('');
    setReserveForm({ preferredMeetup: '', preferredTime: '', note: '' });
  };

  const submitReserveRequest = async (event) => {
    event.preventDefault();
    if (!reserveNotice || !auth.currentUser) return;
    const buyerPhone = userProfile?.contactPhone || userProfile?.phone || auth.currentUser.phoneNumber || '';
    if (!buyerPhone) {
      setReserveError('Add your contact number in profile before sending reserve requests.');
      return;
    }
    setIsReserveSubmitting(true);
    setReserveError('');
    try {
      await addDoc(collection(db, 'dealRequests'), {
        noticeId: reserveNotice.id,
        noticeTitle: reserveNotice.title || 'Listing',
        noticePhotoUrl: reserveNotice.photoUrl || '',
        sellerId: reserveNotice.sellerId || '',
        sellerName: reserveNotice.sellerName || '',
        buyerId: auth.currentUser.uid,
        buyerName: userProfile?.displayName || auth.currentUser.displayName || 'Community member',
        buyerPhone,
        buyerSchool: userProfile?.primarySchool || '',
        preferredMeetup: reserveForm.preferredMeetup.trim(),
        preferredTime: reserveForm.preferredTime.trim(),
        note: reserveForm.note.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setReservedNoticeIds((prev) => (prev.includes(reserveNotice.id) ? prev : [...prev, reserveNotice.id]));
      closeReserveModal();
      alert('Reserve request sent to seller.');
    } catch (error) {
      console.error('Failed to send reserve request', error);
      setReserveError('Could not send reserve request right now.');
    } finally {
      setIsReserveSubmitting(false);
    }
  };

  const getStatusMeta = (status) => {
    if (status === 'sold') return { label: 'Sold', badgeClass: 'bg-rose-300/90 text-[#4a1b25]' };
    if (status === 'reserved') return { label: 'Reserved', badgeClass: 'bg-cyan-200 text-[#082231]' };
    return { label: 'Active', badgeClass: 'bg-emerald-200/90 text-[#153421]' };
  };

  const getRecencyCutoffMs = (value) => {
    const now = Date.now();
    if (value === '24h') return now - 24 * 60 * 60 * 1000;
    if (value === '7d') return now - 7 * 24 * 60 * 60 * 1000;
    if (value === '30d') return now - 30 * 24 * 60 * 60 * 1000;
    return null;
  };

  const normalizeText = (value) => (value || '').toString().toLowerCase();
  const formatLabelValue = (label, value) => `${label}: ${value}`;
  const getCategoryLabel = (category) => category;
  const getMetadataChips = (notice) => {
    const chips = [];
    if (notice.condition) chips.push(formatLabelValue('Condition', notice.condition));
    if (notice.subject) chips.push(formatLabelValue('Subject', notice.subject));
    return chips;
  };
  const sellerStatsMap = (notices || []).reduce((acc, notice) => {
    if (!notice?.sellerId) return acc;
    if (!acc[notice.sellerId]) {
      acc[notice.sellerId] = { total: 0, sold: 0 };
    }
    acc[notice.sellerId].total += 1;
    if ((notice.status || 'active') === 'sold') {
      acc[notice.sellerId].sold += 1;
    }
    return acc;
  }, {});

  const getTrustLine = (notice) => {
    const profile = sellerProfiles[notice.sellerId] || {};
    const hasProfileData = Object.keys(profile).length > 0;
    const stats = sellerStatsMap[notice.sellerId] || { total: 0, sold: 0 };
    if (!hasProfileData) {
      return `Verified account | ${stats.sold} successful exchanges`;
    }
    const verifiedPart = profile.isVerifiedParent === false ? 'Unverified profile' : 'Verified profile';
    const visibilityPart = profile.publicProfile === false ? 'Private profile' : 'Public profile';
    const completionSignals = [
      profile.primarySchool,
      profile.colony,
      profile.preferredMeetup,
      profile.availability,
      profile.bio,
    ].filter((value) => Boolean((value || '').toString().trim())).length;
    const completionPart = completionSignals >= 3 ? 'Profile details added' : 'Basic profile details';
    return `${verifiedPart} | ${visibilityPart} | ${completionPart} | ${stats.sold} successful exchanges`;
  };

  const sanitizeTrustLine = (value) => (value || '').replaceAll('Ã¢â‚¬Â¢', '|').replaceAll('â€¢', '|').replaceAll('•', '|');
  const buildGhostWord = (value) => {
    const clean = (value || 'BOOKS').replace(/[^a-z0-9 ]/gi, ' ').trim();
    const firstWord = clean.split(/\s+/)[0] || 'BOOKS';
    return firstWord.toUpperCase().slice(0, 10);
  };
  const getNoticeImageUrls = (notice) => {
    const listed = Array.isArray(notice?.photoUrls) ? notice.photoUrls.filter(Boolean) : [];
    if (listed.length > 0) return listed;
    return notice?.photoUrl ? [notice.photoUrl] : [];
  };
  const getCardImageIndex = (noticeId, imageCount) => {
    if (imageCount <= 1) return 0;
    const savedIndex = cardImageIndexById[noticeId] || 0;
    return Math.min(savedIndex, imageCount - 1);
  };
  const shiftCardImage = (noticeId, imageCount, direction) => {
    if (!noticeId || imageCount <= 1) return;
    setCardImageIndexById((prev) => {
      const currentIndex = prev[noticeId] || 0;
      const nextIndex = (currentIndex + direction + imageCount) % imageCount;
      return { ...prev, [noticeId]: nextIndex };
    });
  };
  const normalizedUserSchool = normalizeSchoolInput(userProfile?.primarySchool || '');
  const normalizedUserColony = normalizeText(userProfile?.colony);
  const searchTerm = normalizeText(searchQuery).trim();
  const recencyCutoffMs = getRecencyCutoffMs(recencyFilter);

  const processedNotices = (notices || [])
    .filter((notice) => !reportedItems.includes(notice.id))
    .filter((notice) => {
      const status = notice.status || 'active';
      return showSold ? true : status !== 'sold';
    })
    .filter((notice) => notice.category === 'Books')
    .filter((notice) => {
      if (!schoolFilter) return true;
      const noticeSchool = normalizeSchoolInput(notice.school || sellerProfiles[notice.sellerId]?.primarySchool || '');
      return noticeSchool === schoolFilter;
    })
    .filter((notice) => {
      if (!searchTerm) return true;
      const keywordText = Array.isArray(notice.keywords) ? notice.keywords.join(' ') : notice.keywords || '';
      const searchableText = normalizeText(
        `${notice.title || ''} ${notice.school || ''} ${notice.category || ''} ${notice.successNote || ''} ${notice.classGrade || ''} ${notice.subject || ''} ${notice.size || ''} ${notice.condition || ''} ${keywordText}`
      );
      return searchableText.includes(searchTerm) || fuzzyMatchText(searchableText, searchTerm);
    })
    .filter((notice) => {
      if (!recencyCutoffMs) return true;
      const createdMs = notice.createdAt?.toMillis?.() || notice.createdAt?.toDate?.()?.getTime?.() || 0;
      return createdMs >= recencyCutoffMs;
    })
    .filter((notice) => {
      if (colonyFilter === 'all') return true;
      if (colonyFilter === 'myColony') {
        if (!normalizedUserColony) return true;
        return normalizeText(notice.colony) === normalizedUserColony;
      }
      if (colonyFilter === 'sameSchool') {
        if (!normalizedUserSchool) return true;
        if (!notice.school) return true;
        return normalizeSchoolInput(notice.school) === normalizedUserSchool;
      }
      return true;
    })
    .sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || a.createdAt?.toDate?.()?.getTime?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || b.createdAt?.toDate?.()?.getTime?.() || 0;
      const priceA = Number(a.price || 0) || 0;
      const priceB = Number(b.price || 0) || 0;

      if (sortMode === 'newest') return timeB - timeA;
      if (sortMode === 'priceLow') {
        if (priceA === priceB) return timeB - timeA;
        return priceA - priceB;
      }
      if (sortMode === 'priceHigh') {
        if (priceA === priceB) return timeB - timeA;
        return priceB - priceA;
      }

      const userSchool = userProfile?.primarySchool;
      const aMatches = userSchool && a.school === userSchool ? 1 : 0;
      const bMatches = userSchool && b.school === userSchool ? 1 : 0;
      if (aMatches !== bMatches) return bMatches - aMatches;
      return timeB - timeA;
    });
  const hasLiveListings = processedNotices.length > 0;
  const previewFilteredNotices = DEMO_LISTINGS
    .filter((notice) => notice.category === 'Books')
    .filter((notice) => {
      if (!searchTerm) return true;
      const searchableText = normalizeText(
        `${notice.title || ''} ${notice.school || ''} ${notice.category || ''} ${notice.successNote || ''} ${notice.classGrade || ''} ${notice.subject || ''} ${notice.size || ''} ${notice.condition || ''}`
      );
      return searchableText.includes(searchTerm) || fuzzyMatchText(searchableText, searchTerm);
    });
  const baseRenderedNotices = hasLiveListings ? processedNotices : previewFilteredNotices;
  const renderedNotices = showSavedOnly ? baseRenderedNotices.filter((notice) => savedOffers.includes(notice.id)) : baseRenderedNotices;
  const bookNotices = renderedNotices.filter((notice) => notice.category === 'Books');
  const bookSubjectOptions = ['all', ...new Set(bookNotices.map((notice) => (notice.subject || '').trim()).filter(Boolean))];
  const filteredBookNotices = bookNotices.filter((notice) => {
    if (bookSubjectFilter !== 'all' && (notice.subject || '').trim() !== bookSubjectFilter) return false;
    return true;
  });

  useEffect(() => {
    if (filteredBookNotices.length === 0) {
      setFeaturedBookIndex(0);
      return;
    }
    setFeaturedBookIndex((prev) => Math.min(prev, filteredBookNotices.length - 1));
  }, [filteredBookNotices.length]);

  const featuredBook = filteredBookNotices[featuredBookIndex] || null;
  const featuredStatusMeta = getStatusMeta(featuredBook?.status || 'active');
  const featuredMetadata = featuredBook ? getMetadataChips(featuredBook) : [];
  const featuredTrust = featuredBook ? sanitizeTrustLine(getTrustLine(featuredBook)) : '';
  const featuredSaved = featuredBook ? savedOffers.includes(featuredBook.id) : false;
  const featuredIsSaving = !!(featuredBook && savingOfferId === featuredBook.id);
  const featuredGhostWord = buildGhostWord(featuredBook?.title || 'Books');
  const featuredCountLabel =
    filteredBookNotices.length > 0
      ? `${String(featuredBookIndex + 1).padStart(2, '0')} / ${String(filteredBookNotices.length).padStart(2, '0')}`
      : '00 / 00';
  const featuredLocationLine = featuredBook?.school
    ? featuredBook.school
    : featuredBook
      ? `City-wide exchange across ${NETWORK_CITY}`
      : 'Library showcase loading';
  const featuredConnectLink = featuredBook
    ? generateWhatsAppLink(featuredBook.sellerPhone || '', featuredBook.title, featuredBook.school, 'EN', featuredBook.successNote)
    : null;
  const featuredIsSelfListing = !!(featuredBook && auth.currentUser?.uid && featuredBook.sellerId === auth.currentUser.uid);
  const featuredReserveSent = !!(featuredBook && reservedNoticeIds.includes(featuredBook.id));
  const featuredCanReserve = !!(featuredBook && (featuredBook.status || 'active') === 'active' && !featuredIsSelfListing);
  const visibleSavedCount = baseRenderedNotices.filter((notice) => savedOffers.includes(notice.id)).length;
  const recentNotices = renderedNotices.filter((notice) => {
    const createdMs = notice.createdAt?.toMillis?.() || notice.createdAt?.toDate?.()?.getTime?.() || 0;
    return createdMs >= Date.now() - 24 * 60 * 60 * 1000;
  });
  const visibleNotices = renderedNotices.slice(0, visibleNoticeCount);
  const hasMoreNotices = renderedNotices.length > visibleNotices.length;

  useEffect(() => {
    setVisibleNoticeCount(12);
  }, [categoryFilter, schoolFilter, searchTerm, recencyFilter, sortMode, colonyFilter, showSold, showSavedOnly, notices?.length]);

  const loadMoreNotices = () => {
    setVisibleNoticeCount((prev) => Math.min(prev + 12, renderedNotices.length));
  };

  const shiftFeaturedBook = (direction) => {
    if (filteredBookNotices.length <= 1) return;
    setFeaturedBookIndex((prev) => {
      const nextIndex = prev + direction;
      if (nextIndex < 0) return filteredBookNotices.length - 1;
      if (nextIndex >= filteredBookNotices.length) return 0;
      return nextIndex;
    });
  };

  const handleStageMouseMove = (event) => {
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    stageRef.current.style.setProperty('--book-tilt-y', `${x * 14}deg`);
    stageRef.current.style.setProperty('--book-tilt-x', `${-y * 10}deg`);
  };

  const resetStageTilt = () => {
    if (!stageRef.current) return;
    stageRef.current.style.setProperty('--book-tilt-y', '0deg');
    stageRef.current.style.setProperty('--book-tilt-x', '0deg');
  };

  const activeListingsCount = renderedNotices.filter((notice) => (notice.status || 'active') === 'active').length;
  const liveBooksCount = renderedNotices.filter((notice) => notice.category === 'Books').length;
  const activeFilterCount = [
    searchTerm,
    recencyFilter !== 'all',
    sortMode !== 'bestMatch',
    colonyFilter !== 'all',
    schoolFilter,
    showSold,
    showSavedOnly,
    bookSubjectFilter !== 'all',
  ].filter(Boolean).length;
  const clearFilters = () => {
    setSearchQuery('');
    setRecencyFilter('all');
    setSortMode('bestMatch');
    setColonyFilter('all');
    setCategoryFilter('Books');
    setSchoolFilter('');
    setBookSubjectFilter('all');
    setShowSold(false);
  };

  return (
    <div className="market-feed mx-auto w-full max-w-[1760px] pb-16 pt-3 lg:pb-20">
      <>
        <section className="mobile-toolbar mb-4 p-3 md:hidden">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-50/54">Explore books</p>
              <h2 className="mt-1 text-lg font-semibold leading-tight text-white">{renderedNotices.length} live listings</h2>
              <p className="mt-1 text-xs text-cyan-50/62">Built for quick book browsing, not heavy scrolling.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowSavedOnly((prev) => !prev)}
              className={`inline-flex shrink-0 items-center rounded-full border px-3 py-2 text-xs font-semibold transition ${
                showSavedOnly
                  ? 'border-cyan-300/34 bg-cyan-300/[0.14] text-white'
                  : 'border-cyan-300/18 bg-[#09111a]/78 text-cyan-50/82'
              }`}
            >
              Cart {visibleSavedCount}
            </button>
          </div>

          <div className="mobile-search-shell">
            <Search className="h-4 w-4 shrink-0 text-cyan-50/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, subject, keyword"
              className="lux-input min-w-0 flex-1 text-sm"
            />
          </div>

          <div className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition-all ${
                  categoryFilter === cat
                    ? 'bg-cyan-300 text-[#041018]'
                    : 'border border-cyan-300/18 bg-cyan-300/[0.04] text-cyan-50/82'
                }`}
              >
                {getCategoryLabel(cat)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowStageFilters((prev) => !prev)}
              className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                showStageFilters
                  ? 'border-cyan-300/34 bg-cyan-300/[0.14] text-white'
                  : 'border-cyan-300/18 bg-cyan-300/[0.04] text-cyan-50/82'
              }`}
            >
              Filters
            </button>
          </div>

          <div className={`${showStageFilters ? 'grid' : 'hidden'} mt-3 gap-2`}>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
              className="lux-select text-sm font-medium"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#08111a]">
                  {option.label}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowSold((prev) => !prev)}
                className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  showSold
                    ? 'border-cyan-300/34 bg-cyan-300/[0.14] text-white'
                    : 'border-cyan-300/18 bg-cyan-300/[0.04] text-cyan-50/82'
                }`}
              >
                {showSold ? 'Hide sold' : 'Show sold'}
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="flex-1 rounded-full border border-cyan-300/18 bg-cyan-300/[0.04] px-3 py-2 text-xs font-semibold text-cyan-50/82"
              >
                Clear
              </button>
            </div>
          </div>
        </section>

      </>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 [@media(min-width:1800px)]:grid-cols-5">
        {renderedNotices.length === 0 ? (
          <div className="lux-panel relative col-span-full overflow-hidden px-6 py-16 text-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(91,232,255,0.16),transparent_56%),linear-gradient(180deg,rgba(4,10,16,0.18),rgba(3,7,12,0.28))]" />
            <div className="relative z-10">
              <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-cyan-300/70" />
              <h3 className="font-display text-2xl font-semibold text-white">{showSavedOnly ? 'No saved offers yet' : 'No listings yet'}</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm text-cyan-50/78">
                {showSavedOnly
                  ? 'Save offers from Explore to build your shortlist here.'
                  : `Be first to post an item in ${NETWORK_CITY}, or check requests from students who are already looking for one.`}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {showSavedOnly && (
                  <button
                    onClick={() => setShowSavedOnly(false)}
                    className="rounded-full border border-cyan-300/30 px-5 py-2.5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/[0.1]"
                  >
                    Show all listings
                  </button>
                )}
                <button
                  onClick={() => onStartListing && onStartListing()}
                  className="rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-[#041018] transition hover:brightness-105"
                >
                  List New Item
                </button>
                <button
                  onClick={() => onOpenRequests && onOpenRequests()}
                  className="rounded-full border border-cyan-300/30 px-5 py-2.5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/[0.1]"
                >
                  View Requests
                </button>
              </div>
            </div>
          </div>
        ) : (
          visibleNotices.map((notice) => {
            const isPreview = notice._isPreview === true;
            const status = notice.status || 'active';
            const statusMeta = getStatusMeta(status);
            const metadataChips = getMetadataChips(notice);
            const imageUrls = getNoticeImageUrls(notice);
            const imageCount = imageUrls.length;
            const imageIndex = getCardImageIndex(notice.id, imageCount);
            const activeImage = imageUrls[imageIndex] || '';
            const trustLine = isPreview ? 'Curated preview listing | Demo mode' : sanitizeTrustLine(getTrustLine(notice));
            const connectLink = isPreview ? '' : generateWhatsAppLink(notice.sellerPhone || '', notice.title, notice.school, 'EN', notice.successNote);
            const sellerStats = sellerStatsMap[notice.sellerId] || { sold: 0, total: 0 };
            const isSelfListing = !!(auth.currentUser?.uid && auth.currentUser.uid === notice.sellerId);
            const reserveSent = reservedNoticeIds.includes(notice.id);
            const offerSaved = savedOffers.includes(notice.id);
            const offerSaving = savingOfferId === notice.id;

            return (
              notice.category === 'Books' ? (
              <React.Fragment key={notice.id}>
              <article className="mobile-list-card group relative overflow-hidden p-0 md:hidden">
                <button
                  onClick={() => !isPreview && handleReport(notice)}
                  className={`absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                    isPreview
                      ? 'bg-emerald-200/20 text-emerald-100 opacity-100'
                      : 'bg-black/50 text-cyan-50/75'
                  }`}
                  title={isPreview ? 'Preview listing' : 'Report Listing'}
                >
                  {isPreview ? <ShieldCheck className="h-3.5 w-3.5" /> : <Flag className="h-3.5 w-3.5" />}
                </button>

                <div className="flex items-stretch">
                  <div className="relative w-[34%] max-w-[118px] min-w-[104px] shrink-0 overflow-hidden border-r border-cyan-300/10 bg-[linear-gradient(180deg,#0d1722,#08111a)]">
                    <div className="aspect-[2.8/4.15] w-full">
                      {activeImage ? (
                        <div className="mobile-list-card__cover h-full w-full">
                          <img
                            src={activeImage}
                            alt={notice.title}
                            className="h-full w-full object-cover object-center"
                          />
                        </div>
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#0a141f] to-[#08111a] text-cyan-50/60">
                          <PackageOpen className="mb-2 h-7 w-7" />
                          <span className="px-2 text-center text-[11px]">No image</span>
                        </div>
                      )}
                    </div>
                    <div className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold ${statusMeta.badgeClass}`}>
                      {statusMeta.label}
                    </div>
                    {isPreview && (
                      <div className="absolute bottom-2 left-2 rounded-full border border-emerald-200/45 bg-emerald-200/20 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-100">
                        Demo
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 px-3 py-3 pr-9">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="line-clamp-2 text-[1rem] font-semibold leading-tight text-white">
                        {notice.title}
                      </h3>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-50/38">
                        Books
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-cyan-50/60">
                      {notice.subject || 'General'}{notice.colony ? ` • ${notice.colony}` : ''}
                    </p>
                    <p className="mt-2 text-[12px] text-cyan-50/60">
                      by {sellerProfiles[notice.sellerId]?.displayName || notice.sellerName || 'Community member'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-cyan-50/62">
                      <span className="rounded-full border border-cyan-300/18 bg-[#07111a]/70 px-2.5 py-1">
                        {notice.condition || 'Good condition'}
                      </span>
                      <span className="rounded-full border border-cyan-300/18 bg-[#07111a]/70 px-2.5 py-1">
                        {timeAgo(notice.createdAt)}
                      </span>
                    </div>
                    <p className="mt-3 text-[1.9rem] font-semibold leading-none text-cyan-100">
                      {Number(notice.price) === 0 ? 'Free' : `Rs ${notice.price}`}
                    </p>
                    <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-cyan-50/65">
                      {notice.successNote || (notice.colony ? `${notice.colony} exchange zone` : `${NETWORK_CITY} student book network`)}
                    </p>
                    <button
                      type="button"
                      onClick={() => toggleSaveOffer(notice.id)}
                      disabled={offerSaving}
                      className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-cyan-100/40 bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-[#041018] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {offerSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className={`h-4 w-4 ${offerSaved ? 'fill-current' : ''}`} />}
                      {offerSaving ? 'Updating...' : offerSaved ? 'Added to Cart' : 'Add to Cart'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-cyan-300/12 px-3 py-2.5 text-[11px] text-cyan-50/68">
                  {!isPreview ? (
                    <button
                      type="button"
                      onClick={() => openSellerProfile(notice)}
                      className="rounded-full border border-cyan-300/25 px-2.5 py-2 font-semibold text-cyan-50"
                    >
                      Profile
                    </button>
                  ) : (
                    <span className="rounded-full border border-cyan-300/12 px-2.5 py-2 text-center font-semibold text-cyan-50/42">
                      Preview
                    </span>
                  )}
                  {connectLink ? (
                    <a
                      href={connectLink}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-cyan-200 px-2.5 py-2 text-center font-bold text-[#082231]"
                    >
                      Connect
                    </a>
                  ) : (
                    <span className="rounded-full border border-cyan-300/12 px-2.5 py-2 text-center font-semibold text-cyan-50/42">
                      Share
                    </span>
                  )}
                  {!isSelfListing && !isPreview ? (
                    <button
                      type="button"
                      onClick={() => openReserveModal(notice)}
                      disabled={reserveSent}
                      className="rounded-full border border-cyan-300/20 bg-white/6 px-2.5 py-2 font-bold text-cyan-50 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {reserveSent ? 'Requested' : 'Reserve'}
                    </button>
                  ) : (
                    <span className="rounded-full border border-cyan-300/12 px-2.5 py-2 text-center font-semibold text-cyan-50/42">
                      Listing
                    </span>
                  )}
                </div>
              </article>

              <article
                className="group relative hidden h-full flex-col overflow-hidden rounded-[1.8rem] border border-cyan-300/12 bg-[linear-gradient(160deg,rgba(9,14,22,0.96),rgba(14,20,32,0.92))] p-3.5 transition-all hover:-translate-y-1.5 hover:border-cyan-300/32 hover:shadow-[0_32px_80px_-44px_rgba(0,0,0,0.95)] md:flex sm:p-4"
              >
              <button
                onClick={() => !isPreview && handleReport(notice)}
                className={`absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                  isPreview
                    ? 'bg-emerald-200/20 text-emerald-100 opacity-100'
                    : 'bg-black/50 text-cyan-50/75 opacity-0 hover:bg-rose-500/85 hover:text-white group-hover:opacity-100'
                }`}
                title={isPreview ? 'Preview listing' : 'Report Listing'}
              >
                {isPreview ? <ShieldCheck className="h-3.5 w-3.5" /> : <Flag className="h-3.5 w-3.5" />}
              </button>

              <div className="relative mb-3 aspect-[4/4.7] overflow-hidden rounded-[1.35rem] border border-cyan-300/10 bg-[#071019] shadow-[0_20px_50px_-34px_rgba(0,0,0,0.9)]">
                {activeImage ? (
                  <img
                    src={activeImage}
                    alt={notice.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#0a141f] to-[#08111a] text-cyan-50/60">
                    <PackageOpen className="mb-2 h-8 w-8" />
                    <span className="text-xs">No image uploaded</span>
                  </div>
                )}

                {activeImage && (
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(12,8,4,0.08),rgba(12,8,4,0.6))]" />
                )}

                {imageCount > 1 && (
                  <>
                      <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-cyan-300/35 bg-black/65 px-2.5 py-1 text-[10px] font-semibold text-cyan-50/95 backdrop-blur">
                      {imageIndex + 1}/{imageCount}
                    </div>
                    <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => shiftCardImage(notice.id, imageCount, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-300/35 bg-black/65 text-cyan-50 transition hover:bg-black/85"
                        aria-label="Previous photo"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => shiftCardImage(notice.id, imageCount, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-300/35 bg-black/65 text-cyan-50 transition hover:bg-black/85"
                        aria-label="Next photo"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}

                <div className="absolute bottom-3 left-3 rounded-xl bg-black/70 px-3 py-1.5 text-xs font-bold text-cyan-50 backdrop-blur">
                  {Number(notice.price) === 0 ? 'Gifted Item' : `Rs ${notice.price}`}
                </div>
                <div className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusMeta.badgeClass}`}>
                  {statusMeta.label}
                </div>
                {isPreview && (
                  <div className="absolute right-3 top-3 rounded-full border border-emerald-200/45 bg-emerald-200/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-100">
                    Demo
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col px-1">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display line-clamp-2 text-[1.08rem] font-semibold leading-tight text-white">
                    {notice.title}
                  </h3>
                  <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-50/46">{getCategoryLabel(notice.category)}</p>
                </div>
                <p className="mt-1 text-xs text-cyan-50/65">
                  {notice.colony ? `${notice.colony} exchange zone` : `${NETWORK_CITY} student book network.`}
                </p>
                {notice.colony && notice.colony === userProfile?.colony && (
                  <p className="mt-2 inline-flex rounded-full bg-cyan-300/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#041018]">
                    Walking Distance
                  </p>
                )}
                {metadataChips.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {metadataChips.slice(0, 2).map((chip) => (
                      <span
                        key={`${notice.id}-${chip}`}
                        className="rounded-full border border-cyan-300/25 bg-[#07111a] px-2.5 py-1 text-[10px] font-semibold text-cyan-50/88"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-300/25 bg-[#07111a] text-cyan-50/80">
                      <User className="h-3.5 w-3.5" />
                    </span>
                    <p className="truncate text-xs font-semibold text-cyan-50/82">
                      {sellerProfiles[notice.sellerId]?.displayName || notice.sellerName || 'Community member'}
                    </p>
                  </div>
                  {!isPreview && (
                    <button
                      type="button"
                      onClick={() => openSellerProfile(notice)}
                      className="inline-flex items-center gap-1 rounded-full border border-cyan-300/35 px-2.5 py-1 text-[11px] font-semibold text-cyan-50 transition hover:bg-cyan-300/[0.1]"
                    >
                      Profile
                    </button>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-cyan-300/25 bg-[#07111a] px-2.5 py-0.5 text-[10px] font-semibold text-cyan-50/84">
                    {sellerProfiles[notice.sellerId]?.role || 'Parent'}
                  </span>
                  <span className="rounded-full border border-emerald-200/30 bg-emerald-200/12 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-100">
                    {sellerStats.sold} exchanges
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-cyan-50/65">{trustLine}</p>
              </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-cyan-300/12 pt-3">
                  <div className="flex items-center gap-1.5 rounded-full border border-cyan-300/18 bg-[#07111a]/70 px-2.5 py-1 text-xs font-medium text-cyan-50/75">
                    <Clock className="h-3.5 w-3.5" />
                    {timeAgo(notice.createdAt)}
                  </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSaveOffer(notice.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/14 bg-cyan-300/[0.05] text-cyan-50/85 transition hover:bg-cyan-300/[0.1] disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={offerSaved ? 'Unsave offer' : 'Save offer'}
                    disabled={offerSaving}
                    title={offerSaved ? 'Saved offer' : 'Save offer'}
                  >
                    {offerSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className={`h-4 w-4 ${offerSaved ? 'fill-current' : ''}`} />}
                  </button>
                  <button
                    onClick={() => !isPreview && handleNativeShare(notice)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/14 bg-cyan-300/[0.05] text-cyan-50/85 transition hover:bg-cyan-300/[0.1]"
                    aria-label="Share listing"
                    disabled={isPreview}
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                  {connectLink && (
                    <a
                      href={connectLink}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-cyan-200 px-3.5 py-1.5 text-xs font-bold text-[#082231] transition hover:brightness-105"
                    >
                      Connect
                    </a>
                  )}
                  {!isSelfListing && !isPreview && (
                    <button
                      type="button"
                      onClick={() => openReserveModal(notice)}
                      disabled={reserveSent}
                      className="rounded-full border border-cyan-300/20 bg-white/6 px-3 py-1.5 text-xs font-bold text-cyan-50 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {reserveSent ? 'Requested' : 'Reserve'}
                    </button>
                  )}
                </div>
              </div>
            </article>
            </React.Fragment>
            ) : (
              <article
                key={notice.id}
                className="group relative flex h-full flex-col overflow-hidden rounded-[1.8rem] border border-cyan-300/12 bg-[linear-gradient(160deg,rgba(9,14,22,0.96),rgba(14,20,32,0.92))] p-3.5 transition-all hover:-translate-y-1.5 hover:border-cyan-300/32 hover:shadow-[0_32px_80px_-44px_rgba(0,0,0,0.95)] sm:p-4"
              >
              <button
                onClick={() => !isPreview && handleReport(notice)}
                className={`absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                  isPreview
                    ? 'bg-emerald-200/20 text-emerald-100 opacity-100'
                    : 'bg-black/50 text-cyan-50/75 opacity-0 hover:bg-rose-500/85 hover:text-white group-hover:opacity-100'
                }`}
                title={isPreview ? 'Preview listing' : 'Report Listing'}
              >
                {isPreview ? <ShieldCheck className="h-3.5 w-3.5" /> : <Flag className="h-3.5 w-3.5" />}
              </button>

              <div className="relative mb-3 aspect-[4/4.7] overflow-hidden rounded-[1.35rem] border border-cyan-300/10 bg-[#071019] shadow-[0_20px_50px_-34px_rgba(0,0,0,0.9)]">
                {activeImage ? (
                  <img
                    src={activeImage}
                    alt={notice.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#0a141f] to-[#08111a] text-cyan-50/60">
                    <PackageOpen className="mb-2 h-8 w-8" />
                    <span className="text-xs">No image uploaded</span>
                  </div>
                )}

                {activeImage && (
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(12,8,4,0.08),rgba(12,8,4,0.6))]" />
                )}

                {imageCount > 1 && (
                  <>
                      <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-cyan-300/35 bg-black/65 px-2.5 py-1 text-[10px] font-semibold text-cyan-50/95 backdrop-blur">
                      {imageIndex + 1}/{imageCount}
                    </div>
                    <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => shiftCardImage(notice.id, imageCount, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-300/35 bg-black/65 text-cyan-50 transition hover:bg-black/85"
                        aria-label="Previous photo"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => shiftCardImage(notice.id, imageCount, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-300/35 bg-black/65 text-cyan-50 transition hover:bg-black/85"
                        aria-label="Next photo"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}

                <div className="absolute bottom-3 left-3 rounded-xl bg-black/70 px-3 py-1.5 text-xs font-bold text-cyan-50 backdrop-blur">
                  {Number(notice.price) === 0 ? 'Gifted Item' : `Rs ${notice.price}`}
                </div>
                <div className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusMeta.badgeClass}`}>
                  {statusMeta.label}
                </div>
                {isPreview && (
                  <div className="absolute right-3 top-3 rounded-full border border-emerald-200/45 bg-emerald-200/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-100">
                    Demo
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col px-1">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display line-clamp-2 text-[1.08rem] font-semibold leading-tight text-white">
                    {notice.title}
                  </h3>
                  <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-50/46">{getCategoryLabel(notice.category)}</p>
                </div>
                <p className="mt-1 text-xs text-cyan-50/65">
                  {notice.colony ? `${notice.colony} exchange zone` : `${NETWORK_CITY} student book network.`}
                </p>
                {notice.colony && notice.colony === userProfile?.colony && (
                  <p className="mt-2 inline-flex rounded-full bg-cyan-300/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#041018]">
                    Walking Distance
                  </p>
                )}
                {metadataChips.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {metadataChips.slice(0, 2).map((chip) => (
                      <span
                        key={`${notice.id}-${chip}`}
                        className="rounded-full border border-cyan-300/25 bg-[#07111a] px-2.5 py-1 text-[10px] font-semibold text-cyan-50/88"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-300/25 bg-[#07111a] text-cyan-50/80">
                      <User className="h-3.5 w-3.5" />
                    </span>
                    <p className="truncate text-xs font-semibold text-cyan-50/82">
                      {sellerProfiles[notice.sellerId]?.displayName || notice.sellerName || 'Community member'}
                    </p>
                  </div>
                  {!isPreview && (
                    <button
                      type="button"
                      onClick={() => openSellerProfile(notice)}
                      className="inline-flex items-center gap-1 rounded-full border border-cyan-300/35 px-2.5 py-1 text-[11px] font-semibold text-cyan-50 transition hover:bg-cyan-300/[0.1]"
                    >
                      Profile
                    </button>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-cyan-300/25 bg-[#07111a] px-2.5 py-0.5 text-[10px] font-semibold text-cyan-50/84">
                    {sellerProfiles[notice.sellerId]?.role || 'Parent'}
                  </span>
                  <span className="rounded-full border border-emerald-200/30 bg-emerald-200/12 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-100">
                    {sellerStats.sold} exchanges
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-cyan-50/65">{trustLine}</p>
              </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-cyan-300/12 pt-3">
                  <div className="flex items-center gap-1.5 rounded-full border border-cyan-300/18 bg-[#07111a]/70 px-2.5 py-1 text-xs font-medium text-cyan-50/75">
                    <Clock className="h-3.5 w-3.5" />
                    {timeAgo(notice.createdAt)}
                  </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSaveOffer(notice.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/14 bg-cyan-300/[0.05] text-cyan-50/85 transition hover:bg-cyan-300/[0.1] disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={offerSaved ? 'Unsave offer' : 'Save offer'}
                    disabled={offerSaving}
                    title={offerSaved ? 'Saved offer' : 'Save offer'}
                  >
                    {offerSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className={`h-4 w-4 ${offerSaved ? 'fill-current' : ''}`} />}
                  </button>
                  <button
                    onClick={() => !isPreview && handleNativeShare(notice)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/14 bg-cyan-300/[0.05] text-cyan-50/85 transition hover:bg-cyan-300/[0.1]"
                    aria-label="Share listing"
                    disabled={isPreview}
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                  {connectLink && (
                    <a
                      href={connectLink}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-cyan-200 px-3.5 py-1.5 text-xs font-bold text-[#082231] transition hover:brightness-105"
                    >
                      Connect
                    </a>
                  )}
                  {!isSelfListing && !isPreview && (
                    <button
                      type="button"
                      onClick={() => openReserveModal(notice)}
                      disabled={reserveSent}
                      className="rounded-full border border-cyan-300/20 bg-white/6 px-3 py-1.5 text-xs font-bold text-cyan-50 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {reserveSent ? 'Requested' : 'Reserve'}
                    </button>
                  )}
                </div>
              </div>
            </article>
            )
            );
          })
        )}
      </div>

      {hasMoreNotices && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={loadMoreNotices}
            className="rounded-full border border-cyan-300/22 bg-[#08111a]/88 px-6 py-2.5 text-sm font-semibold text-cyan-50/86 transition hover:border-cyan-300/42 hover:bg-[#0b1824] hover:text-white"
          >
            Load more listings ({renderedNotices.length - visibleNotices.length} left)
          </button>
        </div>
      )}

      {reserveNotice && (
        <div className="fixed inset-0 z-[195] flex items-center justify-center bg-black/78 p-4 backdrop-blur-md">
          <form onSubmit={submitReserveRequest} className="glass-panel w-full max-w-md rounded-[1.6rem] border border-cyan-300/16 bg-[#07111a]/96 p-5 shadow-[0_30px_90px_rgba(2,10,16,0.68)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-cyan-100/62">Reserve Pickup</p>
                <h3 className="font-display mt-1 text-2xl font-semibold text-white">{reserveNotice.title}</h3>
              </div>
              <button
                type="button"
                onClick={closeReserveModal}
                className="rounded-lg border border-cyan-300/20 bg-[#08111a]/88 p-2 text-cyan-50/82 transition hover:border-cyan-300/40 hover:text-white"
                aria-label="Close reserve modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Preferred meetup spot"
                className="w-full rounded-xl border border-cyan-300/18 bg-[#08111a] px-3.5 py-3 text-sm font-medium text-white outline-none placeholder:text-cyan-50/32 focus:border-cyan-300/42"
                value={reserveForm.preferredMeetup}
                onChange={(e) => setReserveForm((prev) => ({ ...prev, preferredMeetup: e.target.value }))}
              />
              <input
                type="text"
                placeholder="Preferred time (e.g., Today 5pm)"
                className="w-full rounded-xl border border-cyan-300/18 bg-[#08111a] px-3.5 py-3 text-sm font-medium text-white outline-none placeholder:text-cyan-50/32 focus:border-cyan-300/42"
                value={reserveForm.preferredTime}
                onChange={(e) => setReserveForm((prev) => ({ ...prev, preferredTime: e.target.value }))}
              />
              <textarea
                rows="3"
                placeholder="Add a short note (optional)"
                className="w-full resize-none rounded-xl border border-cyan-300/18 bg-[#08111a] px-3.5 py-3 text-sm font-medium text-white outline-none placeholder:text-cyan-50/32 focus:border-cyan-300/42"
                value={reserveForm.note}
                onChange={(e) => setReserveForm((prev) => ({ ...prev, note: e.target.value }))}
              />
            </div>

            <button
              type="submit"
              disabled={isReserveSubmitting}
              className="btn-primary mt-4 w-full rounded-xl py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isReserveSubmitting ? 'Sending request...' : 'Send Reserve Request'}
            </button>
            {reserveError && <p className="mt-3 rounded-lg border border-rose-200/45 bg-rose-300/20 px-3 py-2 text-sm font-semibold text-rose-100">{reserveError}</p>}
          </form>
        </div>
      )}

      {activeProfile && (
        <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/78 p-4 backdrop-blur-md">
          <div className="glass-panel w-full max-w-md rounded-[1.6rem] border border-cyan-300/16 bg-[#07111a]/96 p-5 shadow-[0_30px_90px_rgba(2,10,16,0.68)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-cyan-100/62">Seller Profile</p>
                <h3 className="font-display mt-1 text-2xl font-semibold text-white">
                  {activeProfile.displayName || activeProfile.fallbackName || 'Community Member'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveProfile(null)}
                className="rounded-lg border border-cyan-300/20 bg-[#08111a]/88 p-2 text-cyan-50/82 transition hover:border-cyan-300/40 hover:text-white"
                aria-label="Close profile view"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-cyan-50/82">
              <p>
                Role: <span className="text-white">{activeProfile.role || 'Parent'}</span>
              </p>
              <p>
                School / college: <span className="text-white">{activeProfile.primarySchool || activeProfile.fallbackSchool || 'Not shared'}</span>
              </p>
              <p>
                Colony: <span className="text-white">{activeProfile.colony || 'Not shared'}</span>
              </p>
              {activeProfile.responseSpeed && (
                <p>
                  Response: <span className="text-white">{activeProfile.responseSpeed}</span>
                </p>
              )}
              {activeProfile.profileTagline && (
                <p className="rounded-xl border border-cyan-300/16 bg-[#08111a]/86 p-3 text-cyan-50/82">{activeProfile.profileTagline}</p>
              )}
              {activeProfile.preferredMeetup && (
                <p>
                  Preferred handover: <span className="text-white">{activeProfile.preferredMeetup}</span>
                </p>
              )}
              {activeProfile.availability && (
                <p>
                  Availability: <span className="text-white">{activeProfile.availability}</span>
                </p>
              )}
              {activeProfile.bio && (
                <p className="rounded-xl border border-cyan-300/16 bg-[#08111a]/86 p-3 text-cyan-50/82">{activeProfile.bio}</p>
              )}
              {activeProfile.showPhoneOnProfile && (activeProfile.phone || activeProfile.phoneFromListing) && (
                <p>
                  Contact: <span className="text-white">{activeProfile.phone || activeProfile.phoneFromListing}</span>
                </p>
              )}
              <p>
                Successful handovers: <span className="text-emerald-200">{activeProfile.successfulHandovers || 0}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
