import React, { useEffect, useRef, useState } from 'react';
import { Share2, Flag, Clock, AlertTriangle, PackageOpen, User, ShoppingBag, Loader2, Search, ChevronLeft, ChevronRight, MapPin, MessageCircle } from 'lucide-react';
import { collection, serverTimestamp, doc, setDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { normalizeSchoolInput } from '../data/schools';
import { DIRECT_TRANSACTION_NOTICE } from '../config/compliance';
import { buildListingShareUrl, getListingLocationLabel } from '../utils/listings';
import { createReserveRequest } from '../utils/requestIntegrity';
import ReportListingModal from './ReportListingModal';
import { MARKETPLACE_SAFETY_TIPS } from '../utils/marketplaceCompliance';
import { submitListingReport } from '../utils/reporting';
import { trackContactInitiated, trackListingSaved } from '../utils/analytics';

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

const getSellerVerificationLabel = (listing = {}) =>
  listing?.sellerVerificationStatus === 'basic-self-declared'
    ? 'Basic seller check completed'
    : 'Basic seller check pending';

const PREFERRED_CLASS_EXAM_OPTIONS = [
  'Class 9',
  'Class 10',
  'Class 11',
  'Class 12',
  'JEE',
  'NEET',
  'CUET',
  'BITSAT',
  'NDA',
  'CLAT',
  'CA Foundation',
  'UGEE',
  'IPMAT',
  'NIFT',
  'NID',
  'AIIMS',
  'Olympiad',
  'Class 6',
  'Class 7',
  'Class 8',
];

const normalizeClassExamLabel = (value = '') => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');
  const aliasMap = {
    '6': 'Class 6',
    'class 6': 'Class 6',
    'grade 6': 'Class 6',
    '6th': 'Class 6',
    '7': 'Class 7',
    'class 7': 'Class 7',
    'grade 7': 'Class 7',
    '7th': 'Class 7',
    '8': 'Class 8',
    'class 8': 'Class 8',
    'grade 8': 'Class 8',
    '8th': 'Class 8',
    '9': 'Class 9',
    'class 9': 'Class 9',
    'grade 9': 'Class 9',
    '9th': 'Class 9',
    '10': 'Class 10',
    'class 10': 'Class 10',
    'grade 10': 'Class 10',
    '10th': 'Class 10',
    '11': 'Class 11',
    'class 11': 'Class 11',
    'grade 11': 'Class 11',
    '11th': 'Class 11',
    '12': 'Class 12',
    'class 12': 'Class 12',
    'grade 12': 'Class 12',
    '12th': 'Class 12',
    jee: 'JEE',
    'jee mains': 'JEE',
    'jee advanced': 'JEE',
    neet: 'NEET',
    'neet ug': 'NEET',
    cuet: 'CUET',
    'cuet ug': 'CUET',
    bitsat: 'BITSAT',
    nda: 'NDA',
    clat: 'CLAT',
    'ca foundation': 'CA Foundation',
    ugee: 'UGEE',
    ipmat: 'IPMAT',
    nift: 'NIFT',
    nid: 'NID',
    aiims: 'AIIMS',
    olympiad: 'Olympiad',
    olympiads: 'Olympiad',
  };

  return aliasMap[normalized] || trimmed;
};

const buildClassExamOptions = (notices = []) => {
  const normalizedValues = notices
    .map((notice) => normalizeClassExamLabel(notice.classGrade || ''))
    .filter(Boolean);

  const uniqueValues = [...new Set(normalizedValues)];
  const preferredValues = PREFERRED_CLASS_EXAM_OPTIONS.filter((option) => uniqueValues.includes(option));
  const remainingValues = uniqueValues
    .filter((option) => !PREFERRED_CLASS_EXAM_OPTIONS.includes(option))
    .sort((left, right) => left.localeCompare(right));

  return ['all', ...preferredValues, ...remainingValues];
};

export default function Feed({
  listings,
  userProfile,
  onStartListing,
  onOpenListing,
  onOpenChat,
  onRequireAuth,
  cartToggleSignal = 0,
  onSavedCountChange,
  onLoadMoreListings,
  hasMoreListings = false,
  isLoadingMoreListings = false,
  isListingsLoading = false,
  listingsLoadError = '',
}) {
  const SAVE_TOGGLE_DEBOUNCE_MS = 500;
  const NETWORK_CITY = 'Saharanpur';
  const listingsRef = useRef(null);
  const saveToggleTimeoutRef = useRef({});
  const savedOffersRef = useRef([]);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
  );
  const [schoolFilter, setSchoolFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [recencyFilter, setRecencyFilter] = useState('all');
  const [sortMode, setSortMode] = useState('bestMatch');
  const [classFilter, setClassFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [colonyFilter, setColonyFilter] = useState('all');
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [reportedItems, setReportedItems] = useState([]);
  const [savedOffers, setSavedOffers] = useState([]);
  const [savingOfferIds, setSavingOfferIds] = useState({});
  const [cardImageIndexById, setCardImageIndexById] = useState({});
  const [brokenImageKeys, setBrokenImageKeys] = useState({});
  const [showStageFilters, setShowStageFilters] = useState(false);
  const [reserveNotice, setReserveNotice] = useState(null);
  const [reserveForm, setReserveForm] = useState({ preferredMeetup: '', preferredTime: '', note: '' });
  const [isReserveSubmitting, setIsReserveSubmitting] = useState(false);
  const [reserveError, setReserveError] = useState('');
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [isReportSubmitting, setIsReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reservedNoticeIds, setReservedNoticeIds] = useState([]);
  const [visibleNoticeCount, setVisibleNoticeCount] = useState(12);
  const currentUserId = auth.currentUser?.uid || '';
  const visibleSavedCount = listings
    ? [...new Set((listings || []).filter((notice) => savedOffers.includes(notice.id)).map((notice) => notice.id))].length
    : 0;

  const markImageBroken = (listingId, imageUrl) => {
    const key = `${listingId}:${imageUrl}`;
    setBrokenImageKeys((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  };

  const isImageBroken = (listingId, imageUrl) => Boolean(brokenImageKeys[`${listingId}:${imageUrl}`]);

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
  const priceOptions = [
    { value: 'all', label: 'Any price' },
    { value: 'free', label: 'Free' },
    { value: 'under200', label: 'Under Rs 200' },
    { value: '200to500', label: 'Rs 200-500' },
    { value: 'over500', label: 'Over Rs 500' },
  ];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const schoolParam = params.get('school');
    const searchParam = params.get('search');
    if (schoolParam) setSchoolFilter(normalizeSchoolInput(schoolParam));
    if (searchParam) setSearchQuery(searchParam);
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      setReservedNoticeIds([]);
      return undefined;
    }

    const loadReservedNoticeIds = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, 'dealRequests'), where('buyerId', '==', currentUserId)));
        const nextNoticeIds = snapshot.docs
          .map((entry) => entry.data()?.noticeId)
          .filter(Boolean);
        setReservedNoticeIds([...new Set(nextNoticeIds)]);
      } catch (error) {
        console.error('Failed to load reserve requests', error);
      }
    };

    loadReservedNoticeIds();
    return undefined;
  }, [currentUserId]);

  useEffect(() => {
    savedOffersRef.current = savedOffers;
  }, [savedOffers]);

  useEffect(() => {
    return () => {
      Object.values(saveToggleTimeoutRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      saveToggleTimeoutRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const title = 'Used School Books in Saharanpur | VidyaShare';
    const description =
      'Buy and sell used school books in Saharanpur. Save money and connect with local students easily.';
    const rootUrl = `${window.location.origin}/`;
    const updateMetaContent = (selector, value) => {
      const node = document.querySelector(selector);
      if (node) node.setAttribute('content', value);
    };

    document.documentElement.lang = 'en-IN';
    document.title = title;
    updateMetaContent('meta[name="description"]', description);
    updateMetaContent('meta[name="keywords"]', 'Saharanpur books, used books Saharanpur, class 11 books Saharanpur, class 12 books Saharanpur');
    updateMetaContent('meta[property="og:title"]', title);
    updateMetaContent('meta[property="og:description"]', description);
    updateMetaContent('meta[property="og:url"]', rootUrl);
    updateMetaContent('meta[property="og:image:alt"]', 'VidyaShare marketplace for used school books in Saharanpur');
    updateMetaContent('meta[name="twitter:title"]', title);
    updateMetaContent('meta[name="twitter:description"]', description);
    updateMetaContent('meta[name="twitter:image:alt"]', 'VidyaShare marketplace for used school books in Saharanpur');

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', rootUrl);
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
    if (!currentUserId) {
      setSavedOffers([]);
      return undefined;
    }

    const loadSavedOffers = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, 'savedOffers'), where('userId', '==', currentUserId)));
        const nextSaved = [];
        snapshot.forEach((entry) => {
          const data = entry.data();
          if (data?.noticeId) nextSaved.push(data.noticeId);
        });
        setSavedOffers(nextSaved);
      } catch (error) {
        console.error('Failed to load saved offers', error);
      }
    };

    loadSavedOffers();
    return undefined;
  }, [currentUserId]);

  useEffect(() => {
    if (typeof onSavedCountChange === 'function') {
      onSavedCountChange(visibleSavedCount);
    }
  }, [onSavedCountChange, visibleSavedCount]);

  useEffect(() => {
    if (!cartToggleSignal) return;
    setShowSavedOnly((prev) => !prev);
  }, [cartToggleSignal]);

  const handleReport = async (item) => {
    if (!auth.currentUser) {
      if (onRequireAuth) onRequireAuth();
      return;
    }

    setReportTarget(item);
    setReportReason('');
    setReportDetails('');
    setReportError('');
  };

  const closeReportModal = () => {
    if (isReportSubmitting) return;
    setReportTarget(null);
    setReportReason('');
    setReportDetails('');
    setReportError('');
  };

  const submitReport = async () => {
    if (!reportTarget || !auth.currentUser) return;
    if (!reportReason) {
      setReportError('Choose a report reason so the moderation queue can triage it correctly.');
      return;
    }

    setIsReportSubmitting(true);
    setReportError('');
    try {
      const result = await submitListingReport({
        db,
        listing: reportTarget,
        reporterId: auth.currentUser.uid,
        reporterName: userProfile?.displayName || auth.currentUser.displayName || '',
        reason: reportReason,
        details: reportDetails,
      });
      setReportedItems((prev) => (prev.includes(reportTarget.id) ? prev : [...prev, reportTarget.id]));
      if (result.alreadyExists) {
        window.alert('You already reported this listing. We kept it hidden from your feed.');
      }
      closeReportModal();
    } catch (error) {
      console.error('Report failed', error);
      setReportError(error?.message || 'Could not send this report right now.');
    } finally {
      setIsReportSubmitting(false);
    }
  };

  const handleNativeShare = async (item) => {
    const shareUrl = buildListingShareUrl(item.id);
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

  const openListing = (noticeId, analyticsContext = null) => {
    if (!noticeId || typeof onOpenListing !== 'function') return;
    onOpenListing(noticeId, analyticsContext);
  };

  const toggleSaveOffer = async (noticeId) => {
    if (!noticeId) return;
    if (savingOfferIds[noticeId] || saveToggleTimeoutRef.current[noticeId]) return;

    if (!auth.currentUser) {
      if (onRequireAuth) {
        onRequireAuth();
      } else {
        alert('Please sign in to save offers.');
      }
      return;
    }

    const docId = `${auth.currentUser.uid}_${noticeId}`;
    setSavingOfferIds((current) => ({ ...current, [noticeId]: true }));

    saveToggleTimeoutRef.current[noticeId] = window.setTimeout(async () => {
      try {
        const alreadySaved = savedOffersRef.current.includes(noticeId);
        if (alreadySaved) {
          await deleteDoc(doc(db, 'savedOffers', docId));
        } else {
          await setDoc(doc(db, 'savedOffers', docId), {
            userId: auth.currentUser.uid,
            noticeId,
            createdAt: serverTimestamp(),
          });
          const targetNotice = (listings || []).find((entry) => entry.id === noticeId);
          if (targetNotice) {
            trackListingSaved({
              listing: targetNotice,
              surface: 'feed',
              authState: 'signed_in',
            });
          }
        }
      } catch (error) {
        console.error('Could not update saved offer', error);
        alert('Could not save this offer right now.');
      } finally {
        window.clearTimeout(saveToggleTimeoutRef.current[noticeId]);
        delete saveToggleTimeoutRef.current[noticeId];
        setSavingOfferIds((current) => {
          const next = { ...current };
          delete next[noticeId];
          return next;
        });
      }
    }, SAVE_TOGGLE_DEBOUNCE_MS);
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
      await createReserveRequest({
        db,
        notice: reserveNotice,
        currentUser: auth.currentUser,
        buyerProfile: userProfile,
        buyerPhone,
        reserveForm,
      });
      setReservedNoticeIds((prev) => (prev.includes(reserveNotice.id) ? prev : [...prev, reserveNotice.id]));
      closeReserveModal();
      alert('Reserve request sent to seller.');
    } catch (error) {
      console.error('Failed to send reserve request', error);
      setReserveError(error?.message || 'Could not send reserve request right now.');
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
  const getCategoryChipLabel = (category) => (category ? `${category} listing` : 'Book listing');
  const formatPriceLabel = (price) => (Number(price) === 0 ? 'Free' : `Rs ${Number(price || 0).toLocaleString('en-IN')}`);
  const isSellerVerified = (notice = {}) => notice?.sellerVerificationStatus === 'basic-self-declared';
  const getSellerRoleLabel = (notice = {}) => {
    const normalizedRole = String(notice?.sellerRole || '').trim().toLowerCase();
    if (normalizedRole === 'student') return 'Student seller';
    if (normalizedRole === 'parent' || normalizedRole === 'guardian') return 'Parent seller';
    if (notice?.sellerSchool || notice?.school) return 'Student seller';
    return 'Local seller';
  };
  const getListingPreview = (notice = {}) =>
    String(
      notice.description
      || notice.successNote
      || `Pickup in ${getListingLocationLabel(notice)}. Ask about edition, quantity, and condition before you meet.`
    ).trim();
  const getKeyInfoChips = (notice = {}) =>
    [
      notice.classGrade ? `Class ${notice.classGrade}` : '',
      notice.condition || '',
      getListingLocationLabel(notice),
    ].filter(Boolean);
  const getMetadataChips = (notice) => {
    const chips = [];
    if (notice.condition) chips.push(formatLabelValue('Condition', notice.condition));
    if (notice.subject) chips.push(formatLabelValue('Subject', notice.subject));
    return chips;
  };
  const sellerStatsMap = (listings || []).reduce((acc, notice) => {
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
    const stats = sellerStatsMap[notice.sellerId] || { total: 0, sold: 0 };
    const verificationPart = getSellerVerificationLabel(notice);
    const visibilityPart = notice?.sellerSchool ? 'School visible' : 'School hidden';
    const contactPart = 'In-app chat only';
    return `${verificationPart} | ${visibilityPart} | ${contactPart} | ${stats.sold} successful exchanges`;
  };

  const sanitizeTrustLine = (value) => (value || '').replaceAll('Ã¢â‚¬Â¢', '|').replaceAll('â€¢', '|').replaceAll('•', '|');
  const getNoticeImageUrls = (notice) => {
    const listed = Array.isArray(notice?.photoUrls) ? notice.photoUrls.filter(Boolean) : [];
    if (listed.length > 0) return listed;
    return notice?.photoUrl ? [notice.photoUrl] : [];
  };
  const matchesPriceFilter = (notice, currentPriceFilter) => {
    if (currentPriceFilter === 'all') return true;
    const priceValue = Number(notice?.price || 0) || 0;
    if (currentPriceFilter === 'free') return priceValue === 0;
    if (currentPriceFilter === 'under200') return priceValue > 0 && priceValue < 200;
    if (currentPriceFilter === '200to500') return priceValue >= 200 && priceValue <= 500;
    if (currentPriceFilter === 'over500') return priceValue > 500;
    return true;
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
  const allBookNotices = (listings || []).filter((notice) => notice.category === 'Books');
  const classOptions = buildClassExamOptions(allBookNotices);
  const locationOptions = ['all', ...new Set(allBookNotices.map((notice) => (notice.colony || '').trim()).filter(Boolean))];

  const processedNotices = (listings || [])
    .filter((notice) => !reportedItems.includes(notice.id))
    .filter((notice) => {
      const status = notice.status || 'active';
      return status !== 'sold';
    })
    .filter((notice) => notice.category === 'Books')
    .filter((notice) => {
      if (!schoolFilter) return true;
      const noticeSchool = normalizeSchoolInput(notice.school || notice.sellerSchool || '');
      return noticeSchool === schoolFilter;
    })
    .filter((notice) => {
      if (!searchTerm) return true;
      const keywordText = Array.isArray(notice.keywords) ? notice.keywords.join(' ') : notice.keywords || '';
      const searchableText = normalizeText(
        `${notice.title || ''} ${notice.description || ''} ${notice.school || ''} ${notice.category || ''} ${notice.successNote || ''} ${notice.classGrade || ''} ${notice.subject || ''} ${notice.size || ''} ${notice.condition || ''} ${keywordText}`
      );
      return searchableText.includes(searchTerm) || fuzzyMatchText(searchableText, searchTerm);
    })
    .filter((notice) => {
      if (classFilter === 'all') return true;
      return normalizeClassExamLabel(notice.classGrade || '') === classFilter;
    })
    .filter((notice) => matchesPriceFilter(notice, priceFilter))
    .filter((notice) => {
      if (!recencyCutoffMs) return true;
      const createdMs = notice.createdAt?.toMillis?.() || notice.createdAt?.toDate?.()?.getTime?.() || 0;
      return createdMs >= recencyCutoffMs;
    })
    .filter((notice) => {
      if (locationFilter === 'all') return true;
      if (locationFilter === 'myArea') {
        if (!normalizedUserColony) return true;
        return normalizeText(notice.colony) === normalizedUserColony;
      }
      return normalizeText(notice.colony) === normalizeText(locationFilter);
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
  const baseRenderedNotices = processedNotices;
  const renderedNotices = showSavedOnly ? baseRenderedNotices.filter((notice) => savedOffers.includes(notice.id)) : baseRenderedNotices;
  const visibleNotices = renderedNotices.slice(0, visibleNoticeCount);
  const hasMoreListingsInView = renderedNotices.length > visibleNotices.length || hasMoreListings;

  useEffect(() => {
    setVisibleNoticeCount(12);
  }, [schoolFilter, searchTerm, recencyFilter, sortMode, classFilter, priceFilter, locationFilter, colonyFilter, showSavedOnly, listings?.length]);

  const loadMoreListings = async () => {
    const nextVisibleCount = visibleNoticeCount + 12;
    if (nextVisibleCount > renderedNotices.length && hasMoreListings && typeof onLoadMoreListings === 'function') {
      await onLoadMoreListings();
    }
    setVisibleNoticeCount((prev) => prev + 12);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setRecencyFilter('all');
    setSortMode('bestMatch');
    setClassFilter('all');
    setPriceFilter('all');
    setLocationFilter('all');
    setColonyFilter('all');
    setSchoolFilter('');
    setShowSavedOnly(false);
  };

  const scrollToListings = () => {
    listingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openChatForNotice = (notice, surface = 'feed_card_chat') => {
    if (!notice?.id) return;
    if (typeof onOpenChat === 'function') {
      onOpenChat(notice);
      return;
    }
    openListing(notice.id, { listing: notice, surface });
  };

  return (
    <div className="market-feed mx-auto w-full max-w-[1760px] pb-16 pt-1 lg:pb-20">
      <section className="editorial-shell overflow-hidden p-2.5 sm:p-3 lg:p-3">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_10%,rgba(91,232,255,0.14),transparent_26%),radial-gradient(circle_at_86%_16%,rgba(43,127,255,0.14),transparent_28%)]" />
        <div className="relative z-10 max-w-5xl">
          <h1 className="font-display text-[1.45rem] font-semibold leading-[1] text-white sm:text-[1.7rem] lg:text-[1.95rem] xl:text-[2.1rem]">
            Buy &amp; Sell School Books in {NETWORK_CITY}
          </h1>
          <p className="mt-1.5 text-[12px] leading-relaxed text-cyan-50/72 sm:text-[13px]">
            Save money, no middleman, chat with sellers directly and meet locally.
          </p>
        </div>
      </section>

      <section ref={listingsRef} id="browse-books-saharanpur" className="mt-1.5 scroll-mt-32">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="font-display text-[1.45rem] font-semibold text-white sm:text-[1.55rem]">Browse Books</h2>
          <span className="rounded-full border border-cyan-300/20 bg-[#07111a]/80 px-3 py-1 text-xs font-semibold text-cyan-50/85">
            {renderedNotices.length} results
          </span>
        </div>
      </section>

      <section className="mt-2 hidden md:block">
        <div className="lux-panel p-3 lg:p-3">
          <div className="grid gap-2 xl:grid-cols-[minmax(0,1.8fr)_repeat(5,minmax(0,0.72fr))]">
            <label className="flex items-center gap-3 rounded-[0.9rem] border border-cyan-300/18 bg-[#08111a]/88 px-3.5 py-2">
              <Search className="h-4 w-4 shrink-0 text-cyan-50/52" />
              <input
                name="desktop_search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, subject, class, condition, keyword"
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-cyan-50/34"
              />
            </label>
            <select
              name="desktop_class_filter"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="lux-select text-sm font-medium"
            >
              <option value="all" className="bg-[#08111a]">
                    Classes/Exams
              </option>
              {classOptions
                .filter((option) => option !== 'all')
                .map((option) => (
                  <option key={option} value={option} className="bg-[#08111a]">
                    {option}
                  </option>
                ))}
            </select>
            <select
              name="desktop_price_filter"
              value={priceFilter}
              onChange={(e) => setPriceFilter(e.target.value)}
              className="lux-select text-sm font-medium"
            >
              {priceOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#08111a]">
                  {option.label}
                </option>
              ))}
            </select>
            <select
              name="desktop_location_filter"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="lux-select text-sm font-medium"
            >
              <option value="all" className="bg-[#08111a]">
                All locations
              </option>
              {userProfile?.colony && (
                <option value="myArea" className="bg-[#08111a]">
                  My area
                </option>
              )}
              {locationOptions
                .filter((option) => option !== 'all')
                .map((option) => (
                  <option key={option} value={option} className="bg-[#08111a]">
                    {option}
                  </option>
                ))}
            </select>
            <select
              name="desktop_sort_mode"
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
            <select
              name="desktop_recency_filter"
              value={recencyFilter}
              onChange={(e) => setRecencyFilter(e.target.value)}
              className="lux-select text-sm font-medium"
            >
              <option value="all" className="bg-[#08111a]">
                Any recency
              </option>
              {recencyOptions
                .filter((option) => option.value !== 'all')
                .map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#08111a]">
                    Posted in {option.label}
                  </option>
                ))}
            </select>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSavedOnly((prev) => !prev)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  showSavedOnly
                    ? 'border-cyan-300/38 bg-cyan-300/[0.16] text-white'
                    : 'border-cyan-300/18 bg-cyan-300/[0.04] text-cyan-50/82'
                }`}
              >
                {showSavedOnly ? 'Showing saved' : 'Saved only'}
              </button>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full border border-cyan-300/20 bg-white/6 px-3 py-1 text-xs font-semibold text-cyan-50 transition hover:bg-white/10"
            >
              Clear filters
            </button>
          </div>
        </div>
      </section>

      <section className="mobile-toolbar mb-4 mt-4 p-3 md:hidden">
        <div className="mobile-search-shell">
          <Search className="h-4 w-4 shrink-0 text-cyan-50/50" />
          <input
            name="mobile_search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search book, subject, school, keyword"
            className="lux-input min-w-0 flex-1 text-sm"
          />
        </div>

        <div className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
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
            name="mobile_class_filter"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="lux-select text-sm font-medium"
          >
            <option value="all" className="bg-[#08111a]">
                    Classes/Exams
            </option>
            {classOptions
              .filter((option) => option !== 'all')
              .map((option) => (
                <option key={option} value={option} className="bg-[#08111a]">
                  {option}
                </option>
              ))}
          </select>
          <select
            name="mobile_price_filter"
            value={priceFilter}
            onChange={(e) => setPriceFilter(e.target.value)}
            className="lux-select text-sm font-medium"
          >
            {priceOptions.map((option) => (
              <option key={option.value} value={option.value} className="bg-[#08111a]">
                {option.label}
              </option>
            ))}
          </select>
          <select
            name="mobile_location_filter"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="lux-select text-sm font-medium"
          >
            <option value="all" className="bg-[#08111a]">
              All locations
            </option>
            {userProfile?.colony && (
              <option value="myArea" className="bg-[#08111a]">
                My area
              </option>
            )}
            {locationOptions
              .filter((option) => option !== 'all')
              .map((option) => (
                <option key={option} value={option} className="bg-[#08111a]">
                  {option}
                </option>
              ))}
          </select>
          <select
            name="mobile_sort_mode"
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
          <select
            name="mobile_recency_filter"
            value={recencyFilter}
            onChange={(e) => setRecencyFilter(e.target.value)}
            className="lux-select text-sm font-medium"
          >
            {recencyOptions.map((option) => (
              <option key={option.value} value={option.value} className="bg-[#08111a]">
                {option.value === 'all' ? 'Any recency' : `Posted in ${option.label}`}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowSavedOnly((prev) => !prev)}
              className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                showSavedOnly
                  ? 'border-cyan-300/34 bg-cyan-300/[0.14] text-white'
                  : 'border-cyan-300/18 bg-cyan-300/[0.04] text-cyan-50/82'
              }`}
            >
              {showSavedOnly ? 'Saved on' : 'Saved only'}
            </button>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full border border-cyan-300/18 bg-cyan-300/[0.04] px-3 py-2 text-xs font-semibold text-cyan-50/82"
          >
            Clear filters
          </button>
        </div>
      </section>

      <div className="mt-3 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 [@media(min-width:1800px)]:grid-cols-5">
        {renderedNotices.length === 0 ? (
          isListingsLoading ? (
            <div className="lux-panel col-span-full flex min-h-[240px] items-center justify-center px-6 py-16 text-center text-sm font-semibold text-cyan-50/78">
              Loading listings...
            </div>
          ) : listingsLoadError ? (
            <div className="lux-panel relative col-span-full overflow-hidden px-6 py-16 text-center">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(255,112,112,0.12),transparent_56%),linear-gradient(180deg,rgba(4,10,16,0.18),rgba(3,7,12,0.28))]" />
              <div className="relative z-10">
                <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-rose-200/80" />
                <h3 className="font-display text-2xl font-semibold text-white">Could not load listings</h3>
                <p className="mx-auto mt-2 max-w-2xl text-sm text-cyan-50/78">{listingsLoadError}</p>
                <p className="mx-auto mt-2 max-w-xl text-xs text-cyan-50/58">
                  This usually means the Firestore query failed, often because an index is missing or the deployed rules do not match the query.
                </p>
              </div>
            </div>
          ) : (
          <div className="lux-panel relative col-span-full overflow-hidden px-6 py-16 text-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(91,232,255,0.16),transparent_56%),linear-gradient(180deg,rgba(4,10,16,0.18),rgba(3,7,12,0.28))]" />
            <div className="relative z-10">
              <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-cyan-300/70" />
              <h3 className="font-display text-2xl font-semibold text-white">
                {showSavedOnly ? 'No saved offers yet' : 'No books listed yet in Saharanpur'}
              </h3>
              <p className="mx-auto mt-2 max-w-xl text-sm text-cyan-50/78">
                {showSavedOnly
                  ? 'Save offers from Explore to build your shortlist here.'
                  : 'Be the first to help other students save money'}
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
                  Sell Your Books
                </button>
              </div>
              {!showSavedOnly ? (
                <div className="mx-auto mt-8 max-w-sm rounded-[1.7rem] border border-cyan-300/14 bg-[linear-gradient(160deg,rgba(9,14,22,0.96),rgba(14,20,32,0.92))] p-4 text-left shadow-[0_32px_80px_-44px_rgba(0,0,0,0.95)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/62">Example listing</p>
                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-display line-clamp-2 text-lg font-semibold text-white">NCERT Physics Part 1</h4>
                      <p className="mt-2 text-sm text-cyan-50/72">Class 11</p>
                    </div>
                    <p className="shrink-0 text-lg font-semibold text-cyan-100">Rs 250</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-cyan-300/18 bg-[#07111a]/70 px-2.5 py-1 text-[11px] font-semibold text-cyan-50/76">
                      Saharanpur
                    </span>
                    <span className="rounded-full border border-cyan-300/18 bg-[#07111a]/70 px-2.5 py-1 text-[11px] font-semibold text-cyan-50/76">
                      Good condition
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          )
        ) : (
          visibleNotices.map((notice, index) => {
            const status = notice.status || 'active';
            const statusMeta = getStatusMeta(status);
            const metadataChips = getMetadataChips(notice);
            const imageUrls = getNoticeImageUrls(notice);
            const imageCount = imageUrls.length;
            const imageIndex = getCardImageIndex(notice.id, imageCount);
            const activeImage = imageUrls[imageIndex] || '';
            const showActiveImage = Boolean(activeImage) && !isImageBroken(notice.id, activeImage);
            const trustLine = sanitizeTrustLine(getTrustLine(notice));
            const sellerStats = sellerStatsMap[notice.sellerId] || { sold: 0, total: 0 };
            const sellerDisplayName = notice.sellerName || 'Community member';
            const sellerRoleLabel = getSellerRoleLabel(notice);
            const sellerVerified = isSellerVerified(notice);
            const keyInfoChips = getKeyInfoChips(notice);
            const listingPreview = getListingPreview(notice);
            const priceLabel = formatPriceLabel(notice.price);
            const locationLabel = getListingLocationLabel(notice);
            const isSelfListing = !!(auth.currentUser?.uid && auth.currentUser.uid === notice.sellerId);
            const reserveSent = reservedNoticeIds.includes(notice.id);
            const offerSaved = savedOffers.includes(notice.id);
            const offerSaving = Boolean(savingOfferIds[notice.id]);
            const isSetListing = (notice.listingType || 'single') === 'set';
            const classLabel = notice.classGrade ? `Class ${notice.classGrade}` : 'Class not listed';
            const cardLocation = String(notice.colony || '').trim();
            const compactTitle = notice.classGrade ? `${notice.title} - Class ${notice.classGrade}` : notice.title;

            return (
              notice.category === 'Books' ? (
              <React.Fragment key={notice.id}>
              <article
                className="mobile-list-card group relative overflow-hidden p-0 transition-transform duration-200 active:scale-[0.99] md:hidden"
                onClick={() => openListing(notice.id, { listing: notice, index, surface: 'mobile_card' })}
              >
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    handleReport(notice);
                  }}
                  className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-cyan-50/75 transition-all"
                  title="Report Listing"
                >
                  <Flag className="h-3.5 w-3.5" />
                </button>

                <div className="flex h-full flex-col">
                  <div className="relative overflow-hidden bg-[linear-gradient(180deg,#0d1722,#08111a)]">
                    <div className="listing-card-media aspect-[4/5] w-full">
                      {showActiveImage ? (
                        <div className="mobile-list-card__cover h-full w-full">
                          <img
                            src={activeImage}
                            alt={notice.title}
                            className="mobile-list-card__image h-full w-full"
                            onError={() => markImageBroken(notice.id, activeImage)}
                            loading="lazy"
                            decoding="async"
                            sizes="(max-width: 768px) 40vw, 160px"
                          />
                        </div>
                      ) : (
                        <div className="listing-card-placeholder h-full w-full">
                          <PackageOpen className="mb-2 h-7 w-7" />
                          <span className="px-2 text-center text-[11px]">Book image unavailable</span>
                        </div>
                      )}
                    </div>
                    {imageCount > 1 && (
                      <>
                        <div className="absolute right-2 top-2 rounded-full border border-cyan-300/30 bg-black/65 px-2 py-1 text-[10px] font-semibold text-cyan-50/92">
                          {imageIndex + 1}/{imageCount}
                        </div>
                        <div className="absolute inset-x-2 bottom-2 z-10 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              shiftCardImage(notice.id, imageCount, -1);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/35 bg-black/65 text-cyan-50 transition hover:bg-black/85"
                            aria-label="Previous photo"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              shiftCardImage(notice.id, imageCount, 1);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/35 bg-black/65 text-cyan-50 transition hover:bg-black/85"
                            aria-label="Next photo"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    )}
                    <div className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold ${statusMeta.badgeClass}`}>
                      {statusMeta.label}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 px-3 py-3 pr-9">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => openListing(notice.id, { listing: notice, index, surface: 'mobile_card_title' })}
                        className="min-w-0 text-left"
                      >
                        <h3 className="line-clamp-2 text-[0.98rem] font-semibold leading-tight text-white transition hover:text-cyan-100">
                          {compactTitle}
                        </h3>
                      </button>
                      <p className="shrink-0 text-[1.2rem] font-black tracking-[-0.02em] text-cyan-100">{priceLabel}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {isSetListing ? (
                        <span className="rounded-full border border-amber-200/30 bg-amber-200/12 px-2.5 py-1 text-[11px] font-semibold text-amber-100">
                          Book Set
                        </span>
                      ) : null}
                      <span className="rounded-full border border-cyan-300/18 bg-[#07111a]/70 px-2.5 py-1 text-[11px] font-semibold text-cyan-50/82">
                        {classLabel}
                      </span>
                      {cardLocation ? (
                        <span className="rounded-full border border-cyan-300/18 bg-[#07111a]/70 px-2.5 py-1 text-[11px] font-semibold text-cyan-50/76">
                          {cardLocation}
                        </span>
                      ) : null}
                      {false && sellerVerified ? (
                        <span className="rounded-full border border-emerald-200/30 bg-emerald-200/12 px-2 py-1 font-semibold text-emerald-100">
                          Verified
                        </span>
                      ) : null}
                    </div>
                    <p className="hidden mt-2 text-[12px] font-medium text-cyan-50/68">
                      Seller: {sellerDisplayName}
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => openChatForNotice(notice, 'mobile_card_chat')}
                        disabled={isSelfListing}
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-cyan-200 px-4 py-2.5 text-sm font-semibold text-[#041018] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Chat
                      </button>
                      <button
                        type="button"
                        onClick={() => openChatForNotice(notice, 'mobile_card_chat_secondary')}
                        disabled={isSelfListing}
                        className="hidden min-h-[44px] items-center justify-center rounded-full border border-cyan-300/24 bg-white/6 px-4 py-2.5 text-sm font-semibold text-cyan-50 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        💬 Chat with Seller
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-cyan-300/12 px-3 py-2.5 text-[11px] text-cyan-50/68">
                  <button
                    type="button"
                    onClick={() => openListing(notice.id, { listing: notice, index, surface: 'mobile_card_secondary' })}
                    className="hidden rounded-full border border-cyan-300/25 px-2.5 py-2 font-semibold text-cyan-50"
                  >
                    View details
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSaveOffer(notice.id)}
                    disabled={offerSaving}
                    className="rounded-full border border-cyan-300/20 bg-white/6 px-2.5 py-2 text-center font-bold text-cyan-50 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {offerSaving ? 'Saving...' : offerSaved ? 'Saved' : 'Save'}
                  </button>
                </div>
              </article>

              <article
                className="group relative hidden h-full cursor-pointer flex-col overflow-hidden rounded-[1.8rem] border border-cyan-300/12 bg-[linear-gradient(160deg,rgba(9,14,22,0.96),rgba(14,20,32,0.92))] p-3.5 transition-all hover:-translate-y-1 hover:scale-[1.01] hover:border-cyan-300/32 hover:shadow-[0_32px_80px_-44px_rgba(0,0,0,0.95)] md:flex sm:p-4"
                onClick={() => openListing(notice.id, { listing: notice, index, surface: 'desktop_card' })}
              >
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  handleReport(notice);
                }}
                className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-cyan-50/75 opacity-0 transition-all hover:bg-rose-500/85 hover:text-white group-hover:opacity-100"
                title="Report Listing"
              >
                <Flag className="h-3.5 w-3.5" />
              </button>

              <div className="listing-card-media relative mb-3 aspect-[4/5] overflow-hidden rounded-[1.35rem] border border-cyan-300/10 bg-[#071019] shadow-[0_20px_50px_-34px_rgba(0,0,0,0.9)]">
                {showActiveImage ? (
                  <img
                    src={activeImage}
                    alt={notice.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    onError={() => markImageBroken(notice.id, activeImage)}
                    loading="lazy"
                    decoding="async"
                    sizes="(min-width: 1800px) 18vw, (min-width: 1280px) 22vw, (min-width: 640px) 32vw, 100vw"
                  />
                ) : (
                  <div className="listing-card-placeholder h-full w-full">
                    <PackageOpen className="mb-2 h-8 w-8" />
                    <span className="text-xs">Book image unavailable</span>
                  </div>
                )}

                {showActiveImage && (
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
                        onClick={(event) => {
                          event.stopPropagation();
                          shiftCardImage(notice.id, imageCount, -1);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-300/35 bg-black/65 text-cyan-50 transition hover:bg-black/85"
                        aria-label="Previous photo"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          shiftCardImage(notice.id, imageCount, 1);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-300/35 bg-black/65 text-cyan-50 transition hover:bg-black/85"
                        aria-label="Next photo"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}

                <div className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusMeta.badgeClass}`}>
                  {statusMeta.label}
                </div>
              </div>

              <div className="flex flex-1 flex-col px-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display line-clamp-2 text-[1.08rem] font-semibold leading-tight text-white">
                      {compactTitle}
                    </h3>
                    <p className="hidden mt-2 text-sm font-medium text-cyan-50/72">Seller: {sellerDisplayName}</p>
                  </div>
                  <p className="shrink-0 text-[1.55rem] font-black tracking-[-0.03em] text-cyan-100">{priceLabel}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {isSetListing ? (
                    <span className="rounded-full border border-amber-200/30 bg-amber-200/12 px-2.5 py-1 text-[10px] font-semibold text-amber-100">
                      Full Set
                    </span>
                  ) : null}
                  <span className="rounded-full border border-cyan-300/20 bg-[#07111a] px-2.5 py-1 text-[10px] font-semibold text-cyan-50/88">
                    {classLabel}
                  </span>
                  {cardLocation ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-[#07111a] px-2.5 py-1 text-[10px] font-semibold text-cyan-50/82">
                      <MapPin className="h-3.5 w-3.5 text-cyan-100/72" />
                      {cardLocation}
                    </span>
                  ) : null}
                  {false && sellerVerified ? (
                    <span className="rounded-full border border-emerald-200/30 bg-emerald-200/12 px-2.5 py-1 text-[10px] font-semibold text-emerald-100">
                      Verified
                    </span>
                  ) : null}
                </div>
              </div>

                <div className="mt-auto border-t border-cyan-300/12 pt-3">
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => openChatForNotice(notice, 'desktop_card_chat')}
                      disabled={isSelfListing}
                      className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full bg-cyan-200 px-4 py-2 text-sm font-semibold text-[#082231] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Chat
                    </button>
                    <button
                      type="button"
                      onClick={() => openChatForNotice(notice, 'desktop_card_chat_secondary')}
                      disabled={isSelfListing}
                      className="hidden min-h-[42px] items-center justify-center rounded-full border border-cyan-300/20 bg-white/6 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      💬 Chat with Seller
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-cyan-50/48">Tap to open</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleSaveOffer(notice.id);
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/14 bg-cyan-300/[0.05] text-cyan-50/85 transition hover:bg-cyan-300/[0.1] disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={offerSaved ? 'Unsave offer' : 'Save offer'}
                      disabled={offerSaving}
                      title={offerSaved ? 'Saved offer' : 'Save offer'}
                    >
                      {offerSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className={`h-4 w-4 ${offerSaved ? 'fill-current' : ''}`} />}
                    </button>
                  </div>
                  <div className="hidden mt-3 items-center gap-1.5 text-xs text-cyan-50/62">
                    <Clock className="h-3.5 w-3.5" />
                    {timeAgo(notice.createdAt)}
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
                onClick={() => handleReport(notice)}
                className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-cyan-50/75 opacity-0 transition-all hover:bg-rose-500/85 hover:text-white group-hover:opacity-100"
                title="Report Listing"
              >
                <Flag className="h-3.5 w-3.5" />
              </button>

              <div className="relative mb-3 aspect-[4/4.7] overflow-hidden rounded-[1.35rem] border border-cyan-300/10 bg-[#071019] shadow-[0_20px_50px_-34px_rgba(0,0,0,0.9)]">
                {activeImage ? (
                  <img
                    src={activeImage}
                    alt={notice.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                    sizes="(min-width: 1800px) 18vw, (min-width: 1280px) 22vw, (min-width: 640px) 32vw, 100vw"
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
              </div>

              <div className="flex flex-1 flex-col px-1">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display line-clamp-2 text-[1.08rem] font-semibold leading-tight text-white">
                    {notice.title}
                  </h3>
                  <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-50/46">{getCategoryChipLabel(notice.category)}</p>
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
                      {notice.sellerName || 'Community member'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openListing(notice.id, { listing: notice, index, surface: 'compact_card_details' })}
                    className="inline-flex items-center gap-1 rounded-full border border-cyan-300/35 px-2.5 py-1 text-[11px] font-semibold text-cyan-50 transition hover:bg-cyan-300/[0.1]"
                  >
                    Details
                  </button>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-cyan-300/25 bg-[#07111a] px-2.5 py-0.5 text-[10px] font-semibold text-cyan-50/84">
                    {getSellerRoleLabel(notice)}
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
                    onClick={() => handleNativeShare(notice)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/14 bg-cyan-300/[0.05] text-cyan-50/85 transition hover:bg-cyan-300/[0.1]"
                    aria-label="Share listing"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                  {!isSelfListing && (
                    <button
                      type="button"
                      onClick={() => openChatForNotice(notice, 'compact_card_chat')}
                      className="rounded-full bg-cyan-200 px-3.5 py-1.5 text-xs font-bold text-[#082231] transition hover:brightness-105"
                    >
                      💬 Chat with Seller
                    </button>
                  )}
                  {!isSelfListing && (
                    <button
                      type="button"
                      onClick={() => openReserveModal(notice)}
                      disabled={reserveSent}
                      className="rounded-full border border-cyan-300/20 bg-white/6 px-3 py-1.5 text-xs font-bold text-cyan-50 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {reserveSent ? 'Reserve sent' : 'Reserve pickup'}
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

      {hasMoreListingsInView && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={loadMoreListings}
            disabled={isLoadingMoreListings}
            className="rounded-full border border-cyan-300/22 bg-[#08111a]/88 px-6 py-2.5 text-sm font-semibold text-cyan-50/86 transition hover:border-cyan-300/42 hover:bg-[#0b1824] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMoreListings
              ? 'Loading more listings...'
                : renderedNotices.length > visibleNotices.length
                ? `Load more listings (${renderedNotices.length - visibleNotices.length} left)`
                : 'Load more listings'}
          </button>
        </div>
      )}

      {false ? (
      <footer className="mt-6">
        <div className="lux-panel p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="section-kicker">Local Footer</p>
              <h2 className="font-display mt-4 text-2xl font-semibold text-white sm:text-[2rem]">
                Built for Saharanpur students and parents
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-cyan-50/78 sm:text-base">
                Vidya Share is a {NETWORK_CITY}-focused marketplace for second-hand school books, local pickups, and
                practical textbook reuse. The goal is simple: help families save money and make the city’s student resale
                network easier to understand.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <a
                href="/used-school-books-saharanpur.html"
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-cyan-300/20 bg-white/6 px-4 py-2.5 font-semibold text-cyan-50 transition hover:bg-white/10"
              >
                Saharanpur book guide
              </a>
            </div>
          </div>
        </div>
      </footer>
      ) : null}

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
            <p className="mt-3 rounded-lg border border-cyan-300/14 bg-[#08111a]/88 px-3 py-3 text-xs leading-relaxed text-cyan-50/68">
              {DIRECT_TRANSACTION_NOTICE}
            </p>
            {reserveError && <p className="mt-3 rounded-lg border border-rose-200/45 bg-rose-300/20 px-3 py-2 text-sm font-semibold text-rose-100">{reserveError}</p>}
          </form>
        </div>
      )}

      <ReportListingModal
        isOpen={Boolean(reportTarget)}
        listingTitle={reportTarget?.title || ''}
        reason={reportReason}
        details={reportDetails}
        onReasonChange={setReportReason}
        onDetailsChange={setReportDetails}
        onClose={closeReportModal}
        onSubmit={submitReport}
        isSubmitting={isReportSubmitting}
        error={reportError}
      />

    </div>
  );
}
