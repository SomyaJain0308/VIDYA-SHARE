import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Share2, Flag, Clock, AlertTriangle, PackageOpen, ShieldCheck, User, X, ShoppingBag, BookOpen, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { generateWhatsAppLink } from '../utils/whatsapp';
import SchoolSearchInput from './SchoolSearchInput';
import { SAHARANPUR_SCHOOLS, normalizeSchoolInput } from '../data/schools';

const timeAgo = (timestamp) => {
  if (!timestamp) return 'Just now';
  const seconds = Math.floor((new Date() - timestamp.toDate()) / 1000);
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
    title: 'Class 10 RD Sharma (Latest)',
    category: 'Books',
    classGrade: '10',
    subject: 'Mathematics',
    condition: 'Like New',
    price: 299,
    school: '',
    colony: 'Mission Compound',
    sellerName: 'Aarav Parent',
    photoUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=1200&q=80',
    status: 'active',
    successNote: 'Clean copy with all examples solved in pencil notes.',
  },
  {
    id: 'demo-2',
    _isPreview: true,
    title: 'NCERT Science Set (Class 8)',
    category: 'Books',
    classGrade: '8',
    subject: 'Science',
    condition: 'Good',
    price: 150,
    school: '',
    colony: 'Delhi Road',
    sellerName: 'Meera Family',
    photoUrl: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1200&q=80',
    status: 'active',
    successNote: 'All chapters covered, no torn pages.',
  },
  {
    id: 'demo-3',
    _isPreview: true,
    title: 'English Grammar Workbook',
    category: 'Books',
    classGrade: '9',
    subject: 'English',
    condition: 'Like New',
    price: 120,
    school: '',
    colony: 'Court Road',
    sellerName: 'Riya Guardian',
    photoUrl: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=80',
    status: 'active',
    successNote: 'Perfect for board prep and quick revision.',
  },
  {
    id: 'demo-4',
    _isPreview: true,
    title: "St. Mary's Summer Uniform",
    category: 'Uniforms',
    school: "St. Mary's Academy",
    size: '34',
    condition: 'Good',
    price: 350,
    colony: 'Pine Grove',
    sellerName: 'Nisha Parent',
    photoUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
    status: 'active',
    successNote: 'Neat condition, only one season used.',
  },
  {
    id: 'demo-5',
    _isPreview: true,
    title: 'Sports T-shirt + Track Pant',
    category: 'Uniforms',
    school: 'Doon Valley Public School',
    size: 'M',
    condition: 'Fair',
    price: 220,
    colony: 'Mission Compound',
    sellerName: 'Kabir Family',
    photoUrl: 'https://images.unsplash.com/photo-1618354691211-7e0d8060b60f?auto=format&fit=crop&w=1200&q=80',
    status: 'active',
    successNote: 'Good for practice days and PT classes.',
  },
  {
    id: 'demo-6',
    _isPreview: true,
    title: 'Complete Board Exam Notes Bundle',
    category: 'Books',
    classGrade: '10',
    subject: 'All Subjects',
    condition: 'Good',
    price: 500,
    school: '',
    colony: 'Hakikat Nagar',
    sellerName: 'Ananya Student',
    photoUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=80',
    status: 'active',
    successNote: "Handwritten toppers' notes + solved papers.",
  },
];

export default function Feed({ notices, userProfile, onStartListing, onOpenRequests, onRequireAuth }) {
  const stageRef = useRef(null);
  const [schoolFilter, setSchoolFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
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
  const [bookClassFilter, setBookClassFilter] = useState('all');
  const [bookSubjectFilter, setBookSubjectFilter] = useState('all');
  const [showStageFilters, setShowStageFilters] = useState(false);
  const [reserveNotice, setReserveNotice] = useState(null);
  const [reserveForm, setReserveForm] = useState({ preferredMeetup: '', preferredTime: '', note: '' });
  const [isReserveSubmitting, setIsReserveSubmitting] = useState(false);
  const [reserveError, setReserveError] = useState('');
  const [reservedNoticeIds, setReservedNoticeIds] = useState([]);
  const [visibleNoticeCount, setVisibleNoticeCount] = useState(12);
  const currentUserId = auth.currentUser?.uid || '';

  const categories = ['All', 'Books', 'Uniforms'];
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
    { value: 'sameSchool', label: 'Same school' },
  ];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const schoolParam = params.get('school');
    if (schoolParam) setSchoolFilter(normalizeSchoolInput(schoolParam));
  }, []);

  useEffect(() => {
    if (categoryFilter !== 'Uniforms' && schoolFilter) {
      setSchoolFilter('');
    }
  }, [categoryFilter, schoolFilter]);

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
      title: `School Swap: ${item.title}`,
      text: `Look at this ${item.title} on School Swap for ${item.price === 0 ? 'FREE' : `Rs ${item.price}`}.`,
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
    if (status === 'reserved') return { label: 'Reserved', badgeClass: 'bg-amber-200 text-[#3f2a02]' };
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
  const getMetadataChips = (notice) => {
    const chips = [];
    if (notice.condition) chips.push(formatLabelValue('Condition', notice.condition));

    if (notice.category === 'Books') {
      if (notice.classGrade) chips.push(formatLabelValue('Class', notice.classGrade));
      if (notice.subject) chips.push(formatLabelValue('Subject', notice.subject));
    }
    if (notice.category === 'Uniforms' && notice.size) {
      chips.push(formatLabelValue('Size', notice.size));
    }
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
      return `Verified account | ${stats.sold} handovers`;
    }
    const verifiedPart = profile.isVerifiedParent === false ? 'Unverified profile' : 'Verified profile';
    const visibilityPart = profile.publicProfile === false ? 'Private profile' : 'Public profile';
    const completionSignals = [
      profile.primarySchool,
      profile.colony,
      profile.classFocus,
      profile.preferredMeetup,
      profile.availability,
      profile.bio,
    ].filter((value) => Boolean((value || '').toString().trim())).length;
    const completionPart = completionSignals >= 3 ? 'Profile details added' : 'Basic profile details';
    return `${verifiedPart} | ${visibilityPart} | ${completionPart} | ${stats.sold} handovers`;
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
    .filter((notice) => categoryFilter === 'All' || notice.category === categoryFilter)
    .filter((notice) => {
      if (!schoolFilter) return true;
      return notice.category === 'Uniforms' ? normalizeSchoolInput(notice.school) === schoolFilter : true;
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
    .filter((notice) => categoryFilter === 'All' || notice.category === categoryFilter)
    .filter((notice) => {
      if (!schoolFilter) return true;
      return notice.category === 'Uniforms' ? normalizeSchoolInput(notice.school) === schoolFilter : true;
    })
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
  const bookClassOptions = ['all', ...new Set(bookNotices.map((notice) => (notice.classGrade || '').trim()).filter(Boolean))];
  const bookSubjectOptions = ['all', ...new Set(bookNotices.map((notice) => (notice.subject || '').trim()).filter(Boolean))];
  const filteredBookNotices = bookNotices.filter((notice) => {
    if (bookClassFilter !== 'all' && (notice.classGrade || '').trim() !== bookClassFilter) return false;
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

  const isBooksShowcase = categoryFilter !== 'Uniforms';
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
      ? 'City-wide pickup across Saharanpur'
      : 'Library showcase loading';
  const featuredConnectLink = featuredBook
    ? generateWhatsAppLink(featuredBook.sellerPhone || '', featuredBook.title, featuredBook.school, 'EN', featuredBook.successNote)
    : null;
  const featuredIsSelfListing = !!(featuredBook && auth.currentUser?.uid && featuredBook.sellerId === auth.currentUser.uid);
  const featuredReserveSent = !!(featuredBook && reservedNoticeIds.includes(featuredBook.id));
  const featuredCanReserve = !!(featuredBook && (featuredBook.status || 'active') === 'active' && !featuredIsSelfListing);
  const visibleSavedCount = baseRenderedNotices.filter((notice) => savedOffers.includes(notice.id)).length;
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
  const liveUniformsCount = renderedNotices.filter((notice) => notice.category === 'Uniforms').length;

  return (
    <div className="market-feed mx-auto w-full max-w-[1720px] pb-16 pt-2 lg:pb-20">
      {isBooksShowcase ? (
        <>
        <section className="glass-panel relative overflow-hidden rounded-[2rem] border border-amber-200/30 bg-[linear-gradient(145deg,rgba(255,230,166,0.14),rgba(23,15,7,0.52)_46%,rgba(12,8,4,0.58))] p-4 sm:p-6 xl:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(239,198,88,0.1),transparent_52%),radial-gradient(circle_at_84%_10%,rgba(255,255,255,0.06),transparent_42%)]" />
          <div className="relative z-10">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-100/72">Book Showcase</p>
                <h2 className="font-display text-2xl font-semibold text-amber-50 sm:text-3xl">Explore books with a premium first look</h2>
                <div className="mt-3 hidden flex-wrap items-center gap-2 sm:flex">
                  <span className="rounded-full border border-amber-200/30 bg-amber-200/12 px-3 py-1 text-xs font-semibold text-amber-100">
                    {activeListingsCount} active listings
                  </span>
                  <span className="rounded-full border border-amber-200/25 bg-[#1c1408]/70 px-3 py-1 text-xs font-semibold text-amber-100/88">
                    {liveBooksCount} live books
                  </span>
                  {!hasLiveListings && (
                    <span className="rounded-full border border-emerald-200/35 bg-emerald-200/18 px-3 py-1 text-xs font-semibold text-emerald-100">
                      Demo showcase mode
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-amber-100/76 sm:hidden">{activeListingsCount} active listings | {liveBooksCount} books</p>
              </div>
              <div className="hidden items-center gap-2 rounded-full border border-amber-200/30 bg-amber-200/10 px-3 py-1 text-xs font-semibold text-amber-100 md:flex">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified community
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowStageFilters((prev) => !prev)}
                  className="rounded-full border border-amber-200/35 bg-[#1d1409]/90 px-4 py-2 text-xs font-semibold text-amber-50 transition hover:bg-[#2a1c0b]"
                >
                  {showStageFilters ? 'Hide refine tools' : 'Refine showcase'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSavedOnly((prev) => !prev)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                    showSavedOnly
                      ? 'border-amber-200/45 bg-amber-200/20 text-amber-50'
                      : 'border-amber-200/30 bg-[#1d1409]/75 text-amber-100/85 hover:bg-[#2a1c0b]'
                  }`}
                >
                  {showSavedOnly ? 'Showing saved only' : `Saved offers (${visibleSavedCount})`}
                </button>
              </div>
              <span className="text-xs text-amber-100/70">{liveUniformsCount} uniforms live</span>
            </div>

            <div className={`${showStageFilters ? 'grid' : 'hidden'} mb-4 gap-2 sm:grid-cols-2`}>
              <select
                value={bookClassFilter}
                onChange={(e) => setBookClassFilter(e.target.value)}
                className="rounded-xl border border-amber-200/20 bg-[#171106]/80 px-3 py-2.5 text-sm font-medium text-amber-100 outline-none focus:border-amber-200/45"
              >
                <option value="all" className="bg-[#171106]">
                  All classes
                </option>
                {bookClassOptions
                  .filter((option) => option !== 'all')
                  .map((option) => (
                    <option key={option} value={option} className="bg-[#171106]">
                      Class {option}
                    </option>
                  ))}
              </select>
              <select
                value={bookSubjectFilter}
                onChange={(e) => setBookSubjectFilter(e.target.value)}
                className="rounded-xl border border-amber-200/20 bg-[#171106]/80 px-3 py-2.5 text-sm font-medium text-amber-100 outline-none focus:border-amber-200/45"
              >
                <option value="all" className="bg-[#171106]">
                  All subjects
                </option>
                {bookSubjectOptions
                  .filter((option) => option !== 'all')
                  .map((option) => (
                    <option key={option} value={option} className="bg-[#171106]">
                      {option}
                    </option>
                  ))}
              </select>
            </div>

            <div
              ref={stageRef}
              onMouseMove={handleStageMouseMove}
              onMouseLeave={resetStageTilt}
                className="book-stage book-stage--viewport relative overflow-hidden rounded-[1.9rem] border border-amber-200/28 bg-[linear-gradient(155deg,rgba(255,227,156,0.18),rgba(19,12,5,0.52)_40%,rgba(8,5,2,0.54))] px-4 py-4 sm:px-6 sm:py-5 lg:px-7 lg:py-5"
              >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(255,229,156,0.11),transparent_25%),linear-gradient(180deg,rgba(8,5,2,0.01),rgba(8,5,2,0.06)_38%,rgba(8,5,2,0.12)_100%)]" />
              <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-[58%] overflow-hidden">
                <div className="book-stage__ghost text-center font-[Sora] text-[3.5rem] font-extrabold uppercase leading-none tracking-[-0.08em] text-white/15 sm:text-[4.6rem] lg:text-[6.4rem]">
                  {featuredGhostWord}
                </div>
              </div>

              <div className="book-stage__content relative z-10 flex flex-col gap-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,390px)] lg:items-center">
                  <div className="max-w-[640px]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-100/70">Featured Book</p>
                    {featuredBook ? (
                      <>
                        <h3 className="font-display mt-2 text-2xl font-semibold leading-tight text-amber-50 sm:text-3xl lg:text-[2.1rem]">
                          {featuredBook.title}
                        </h3>
                        <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-amber-100/82 sm:text-[0.98rem]">
                          {featuredBook.successNote || 'Trusted student listing with easy handover, premium visibility, and neighborhood trust built in.'}
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="font-display mt-2 text-2xl font-semibold leading-tight text-amber-50 sm:text-3xl lg:text-[2.1rem]">
                          Book showcases are getting ready
                        </h3>
                        <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-amber-100/82 sm:text-[0.98rem]">
                          The first live book will appear here as a dramatic centerpiece instead of getting buried inside ordinary cards.
                        </p>
                      </>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {featuredBook && (
                        <>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${featuredStatusMeta.badgeClass}`}>{featuredStatusMeta.label}</span>
                          <span className="rounded-full border border-amber-200/25 bg-[#1a1207]/55 px-3 py-1 text-xs font-semibold text-amber-100/82">
                            {timeAgo(featuredBook.createdAt)}
                          </span>
                        </>
                      )}
                      <span className="rounded-full border border-amber-200/25 bg-[#1a1207]/55 px-3 py-1 text-xs font-semibold text-amber-100/82">
                        {featuredLocationLine}
                      </span>
                    </div>

                    <div className="mt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/58">Offer Price</p>
                      <div className="mt-2 flex flex-wrap items-end gap-4">
                      <p className="font-display text-3xl font-semibold text-amber-100 sm:text-4xl lg:text-[3rem]">
                          {featuredBook ? (Number(featuredBook.price) === 0 ? 'Free' : `Rs ${featuredBook.price}`) : 'Coming Soon'}
                        </p>
                        {featuredMetadata.length > 0 && (
                          <div className="flex flex-wrap gap-2 pb-1">
                            {featuredMetadata.map((chip) => (
                              <span
                                key={`featured-${chip}`}
                                className="rounded-full border border-amber-200/20 bg-[#1a1207]/55 px-3 py-1.5 text-[11px] font-semibold text-amber-100/88"
                              >
                                {chip}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {featuredBook && <p className="mt-3 max-w-md text-xs text-amber-100/72">{featuredTrust}</p>}
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => featuredBook && toggleSaveOffer(featuredBook.id)}
                        disabled={featuredIsSaving}
                        className="book-stage__cta inline-flex min-w-[190px] items-center justify-center gap-2 rounded-[1.05rem] px-5 py-3 text-sm font-bold text-[#1e1606] transition hover:brightness-110"
                      >
                        {featuredIsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className={`h-4 w-4 ${featuredSaved ? 'fill-current' : ''}`} />}
                        {featuredIsSaving ? 'Saving...' : featuredSaved ? 'Offer Saved' : 'Save Offer'}
                      </button>
                      {featuredConnectLink && (
                        <a
                          href={featuredConnectLink}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-amber-200/30 px-5 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-100/10"
                        >
                          Connect
                        </a>
                      )}
                      {featuredCanReserve && (
                        <button
                          type="button"
                          onClick={() => openReserveModal(featuredBook)}
                          disabled={featuredReserveSent}
                          className="rounded-full border border-amber-200/30 px-5 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-100/10 disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          {featuredReserveSent ? 'Reserve Sent' : 'Reserve Pickup'}
                        </button>
                      )}
                    </div>

                    <div className="mt-5 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => shiftFeaturedBook(-1)}
                        disabled={filteredBookNotices.length <= 1}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-200/28 bg-[#120c05]/58 text-amber-100 transition hover:border-amber-200/48 hover:bg-[#1e1408]/85 disabled:cursor-not-allowed disabled:opacity-45"
                        aria-label="Previous book"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => shiftFeaturedBook(1)}
                        disabled={filteredBookNotices.length <= 1}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-200/28 bg-[#120c05]/58 text-amber-100 transition hover:border-amber-200/48 hover:bg-[#1e1408]/85 disabled:cursor-not-allowed disabled:opacity-45"
                        aria-label="Next book"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/52">Live books</p>
                        <p className="mt-0.5 text-sm font-semibold text-amber-50/82">{featuredCountLabel}</p>
                      </div>
                    </div>
                  </div>

                  <div className="relative flex min-h-[240px] items-center justify-center py-1 sm:min-h-[300px] lg:min-h-[340px]">
                    <div className="book-hero relative">
                    <div className="book-hero__glow absolute inset-x-[-16%] bottom-[16%] top-[18%]" />
                    {[3, 2, 1].map((trail) => (
                      <div key={trail} className={`book-hero__trail book-hero__trail--${trail} absolute inset-0`}>
                        <div className="book-hero__trail-cover h-full w-full rounded-[2rem]" />
                      </div>
                    ))}

                    <div className="book-hero__shadow absolute inset-x-[8%] bottom-2 h-14 rounded-full bg-black/75 blur-[28px]" />
                    <div className="book-hero__core absolute inset-0">
                      <div className="book-hero__object absolute inset-0">
                        <div className="book-hero__backplate absolute inset-[14px_18px_6px_26px] rounded-[2rem]" />
                        <div className="book-hero__spine absolute bottom-[8px] left-[-18px] top-[12px] w-[38px] rounded-l-[1.4rem]" />
                        <div className="book-hero__pageblock absolute bottom-[14px] right-[-26px] top-[22px] w-[54px] rounded-r-[1.5rem]" />
                        <div className="book-hero__cover absolute inset-0 overflow-hidden rounded-[2rem] border border-amber-100/28 bg-[#120d06] shadow-[0_42px_90px_-34px_rgba(0,0,0,0.98)]">
                          {featuredBook?.photoUrl ? (
                            <>
                              <img src={featuredBook.photoUrl} alt={featuredBook.title} className="h-full w-full object-cover" />
                              <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.26),transparent_18%,transparent_52%,rgba(0,0,0,0.3)),linear-gradient(180deg,rgba(10,6,2,0.06),rgba(10,6,2,0.68)_88%)]" />
                              <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-black/36 to-transparent" />
                              <div className="absolute inset-x-4 bottom-4 rounded-[1.1rem] border border-amber-100/18 bg-black/28 px-4 py-3 backdrop-blur-md">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-50/70">Vidya Share Selection</p>
                                <p className="mt-1 line-clamp-2 text-base font-semibold text-amber-50">{featuredBook.title}</p>
                              </div>
                            </>
                          ) : (
                            <div className="book-cover-fallback flex h-full w-full flex-col justify-between bg-[radial-gradient(circle_at_50%_18%,rgba(255,224,139,0.38),transparent_22%),linear-gradient(160deg,#3d2a0c_0%,#221507_38%,#120a03_100%)] px-6 py-6 text-amber-50">
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-50/72">Vidya Share Edition</p>
                                <div className="mt-4 h-px w-20 bg-amber-200/30" />
                              </div>
                              <div>
                                <p className="font-display text-3xl font-semibold leading-[1.02] text-amber-50 sm:text-[2.6rem]">
                                  {featuredBook ? featuredBook.title : 'Trusted books, staged beautifully'}
                                </p>
                                <p className="mt-3 text-sm leading-relaxed text-amber-50/78">
                                  {featuredBook
                                    ? featuredBook.successNote || 'Student-trusted offer ready for direct handover.'
                                    : 'Your first live listing will turn this into a premium product showcase.'}
                                </p>
                              </div>
                              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-50/78">
                                <span>{featuredBook ? featuredLocationLine : 'Saharanpur network'}</span>
                                <BookOpen className="h-4 w-4" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>

            {filteredBookNotices.length > 0 && (
            <div className="hide-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1">
                {filteredBookNotices.slice(0, 10).map((book, index) => {
                  const isActive = index === featuredBookIndex;
                  return (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => setFeaturedBookIndex(index)}
                      className={`min-w-[180px] overflow-hidden rounded-2xl border text-left transition ${
                        isActive
                          ? 'border-amber-200/60 bg-amber-200/12'
                          : 'border-amber-200/20 bg-[#130d05]/70 hover:border-amber-200/40'
                      }`}
                    >
                      <div className="h-20 w-full bg-[#100a04]">
                        {book.photoUrl ? (
                          <img src={book.photoUrl} alt={book.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-amber-100/65">No cover</div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="line-clamp-1 text-xs font-semibold text-amber-50">{book.title}</p>
                        <p className="mt-1 text-[11px] text-amber-100/70">
                          {Number(book.price || 0) === 0 ? 'Free' : `Rs ${book.price || 0}`}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

          </div>
        </section>
        <section className="glass-panel mt-4 rounded-[1.6rem] border border-amber-200/26 bg-[linear-gradient(150deg,rgba(255,229,156,0.14),rgba(22,15,7,0.52)_42%,rgba(12,8,4,0.58))] p-4 sm:p-5">
          <div className="hide-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  categoryFilter === cat
                    ? 'bg-amber-200 text-[#382607] shadow-[0_12px_30px_-16px_rgba(212,175,55,0.95)]'
                    : 'border border-amber-200/26 bg-[#20160a]/82 text-amber-100/86 hover:bg-[#2b1d0c]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_150px_160px_170px_auto_auto]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, school, category, note, keyword"
                className="w-full rounded-xl border border-amber-200/30 bg-[#20160a]/84 px-4 py-2.5 text-sm text-amber-50 placeholder:text-amber-100/45 outline-none transition focus:border-amber-200/55 focus:bg-[#291c0d]"
            />
            <select
              value={recencyFilter}
              onChange={(e) => setRecencyFilter(e.target.value)}
                className="rounded-xl border border-amber-200/30 bg-[#20160a]/84 px-3 py-2.5 text-sm font-medium text-amber-100 outline-none transition focus:border-amber-200/55 focus:bg-[#291c0d]"
            >
              {recencyOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#171106]">
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
              className="rounded-xl border border-amber-200/30 bg-[#20160a]/84 px-3 py-2.5 text-sm font-medium text-amber-100 outline-none transition focus:border-amber-200/55 focus:bg-[#291c0d]"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#171106]">
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={colonyFilter}
              onChange={(e) => setColonyFilter(e.target.value)}
                className="rounded-xl border border-amber-200/30 bg-[#20160a]/84 px-3 py-2.5 text-sm font-medium text-amber-100 outline-none transition focus:border-amber-200/55 focus:bg-[#291c0d]"
            >
              {colonyOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#171106]">
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowSold((prev) => !prev)}
              className={`rounded-xl border px-4 py-2.5 text-xs font-semibold transition ${
                showSold
                  ? 'border-amber-200/45 bg-amber-200/15 text-amber-50'
                  : 'border-amber-200/30 bg-[#20160a]/84 text-amber-100/82 hover:bg-[#2a1c0d]'
                }`}
            >
              {showSold ? 'Hide sold' : 'Show sold'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setRecencyFilter('all');
                setSortMode('bestMatch');
                setColonyFilter('all');
                setCategoryFilter('All');
                setSchoolFilter('');
              }}
              className="rounded-xl border border-amber-200/30 bg-[#20160a]/84 px-4 py-2.5 text-sm font-semibold text-amber-100/88 transition hover:bg-[#2a1c0d]"
            >
              Clear
            </button>
          </div>
        </section>
        </>
      ) : (
        <section className="glass-panel relative overflow-hidden rounded-[1.8rem] p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_50%_0%,rgba(238,200,103,0.18),transparent_72%)]" />
          <div className="relative z-10">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-amber-200/75 uppercase">Live Listings</p>
                <h2 className="font-display text-xl font-semibold text-amber-50 sm:text-2xl">Explore Nearby Items</h2>
              </div>
              <div className="hidden items-center gap-2 rounded-full border border-amber-200/25 bg-amber-200/10 px-3 py-1 text-xs font-semibold text-amber-100 md:flex">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified community
              </div>
            </div>

            <div className="hide-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                    categoryFilter === cat
                      ? 'bg-amber-200 text-[#382607] shadow-[0_10px_24px_-14px_rgba(212,175,55,0.95)]'
                      : 'border border-amber-200/26 bg-[#20160a]/82 text-amber-100/86 hover:bg-[#2b1d0c]'
                  }`}
                >
                  {cat}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowSavedOnly((prev) => !prev)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                  showSavedOnly
                    ? 'border-amber-200/45 bg-amber-200/20 text-amber-50'
                    : 'border-amber-200/26 bg-[#20160a]/82 text-amber-100/86 hover:bg-[#2b1d0c]'
                }`}
              >
                Saved ({visibleSavedCount})
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-1">
              <div>
                <SchoolSearchInput
                  id="feed-uniform-school-filter"
                  value={schoolFilter}
                  onChange={(nextSchool) => setSchoolFilter(normalizeSchoolInput(nextSchool))}
                  schools={SAHARANPUR_SCHOOLS}
                  placeholder="Search school for uniform listings"
                  helperText="Uniform search uses school matching."
                />
              </div>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_150px_160px_170px_auto]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, school, category, note, keyword"
                className="w-full rounded-xl border border-amber-200/30 bg-[#20160a]/84 px-4 py-2.5 text-sm text-amber-50 placeholder:text-amber-100/45 outline-none transition focus:border-amber-200/55 focus:bg-[#291c0d]"
              />
              <select
                value={recencyFilter}
                onChange={(e) => setRecencyFilter(e.target.value)}
                className="rounded-xl border border-amber-200/30 bg-[#20160a]/84 px-3 py-2.5 text-sm font-medium text-amber-100 outline-none transition focus:border-amber-200/55 focus:bg-[#291c0d]"
              >
                {recencyOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#171106]">
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
                className="rounded-xl border border-amber-200/30 bg-[#20160a]/84 px-3 py-2.5 text-sm font-medium text-amber-100 outline-none transition focus:border-amber-200/55 focus:bg-[#291c0d]"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#171106]">
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={colonyFilter}
                onChange={(e) => setColonyFilter(e.target.value)}
                className="rounded-xl border border-amber-200/30 bg-[#20160a]/84 px-3 py-2.5 text-sm font-medium text-amber-100 outline-none transition focus:border-amber-200/55 focus:bg-[#291c0d]"
              >
                {colonyOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#171106]">
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setRecencyFilter('all');
                  setSortMode('bestMatch');
                  setColonyFilter('all');
                  setCategoryFilter('All');
                  setSchoolFilter('');
                }}
                className="rounded-xl border border-amber-200/30 bg-[#20160a]/84 px-4 py-2.5 text-sm font-semibold text-amber-100/88 transition hover:bg-[#2a1c0d]"
              >
                Clear filters
              </button>
            </div>

            <div className="mt-3 flex items-center">
              <button
                type="button"
                onClick={() => setShowSold((prev) => !prev)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  showSold
                    ? 'border-amber-200/40 bg-amber-200/15 text-amber-50'
                    : 'border-amber-200/30 bg-[#20160a]/84 text-amber-100/82 hover:bg-[#2a1c0d]'
                }`}
              >
                {showSold ? 'Hide sold' : 'Show sold'}
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 [@media(min-width:1800px)]:grid-cols-5">
        {renderedNotices.length === 0 ? (
          <div className="glass-panel relative col-span-full overflow-hidden rounded-[1.8rem] px-6 py-16 text-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(238,200,103,0.16),transparent_56%),linear-gradient(180deg,rgba(19,13,6,0.18),rgba(10,7,4,0.28))]" />
            <div className="relative z-10">
              <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-amber-200/70" />
              <h3 className="font-display text-2xl font-semibold text-amber-50">{showSavedOnly ? 'No saved offers yet' : 'No listings yet'}</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm text-amber-100/78">
                {showSavedOnly
                  ? 'Save offers from Explore to build your shortlist here.'
                  : 'Be first to post an item for your neighborhood, or check requests from families who are looking for one.'}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {showSavedOnly && (
                  <button
                    onClick={() => setShowSavedOnly(false)}
                    className="rounded-full border border-amber-200/30 px-5 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-100/10"
                  >
                    Show all listings
                  </button>
                )}
                <button
                  onClick={() => onStartListing && onStartListing()}
                  className="rounded-full bg-amber-300 px-5 py-2.5 text-sm font-semibold text-[#2e2108] transition hover:brightness-105"
                >
                  List New Item
                </button>
                <button
                  onClick={() => onOpenRequests && onOpenRequests()}
                  className="rounded-full border border-amber-200/30 px-5 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-100/10"
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
              <article
              key={notice.id}
              className="glass-panel group relative flex h-full flex-col overflow-hidden rounded-[1.25rem] p-3.5 transition-all hover:-translate-y-1 hover:border-amber-200/45 sm:p-4"
            >
              <button
                onClick={() => !isPreview && handleReport(notice)}
                className={`absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                  isPreview
                    ? 'bg-emerald-200/20 text-emerald-100 opacity-100'
                    : 'bg-black/50 text-amber-100/75 opacity-0 hover:bg-rose-500/85 hover:text-white group-hover:opacity-100'
                }`}
                title={isPreview ? 'Preview listing' : 'Report Listing'}
              >
                {isPreview ? <ShieldCheck className="h-3.5 w-3.5" /> : <Flag className="h-3.5 w-3.5" />}
              </button>

              <div className="relative mb-3 aspect-[4/5] overflow-hidden rounded-[1rem] bg-[#120e06]">
                {activeImage ? (
                  <img
                    src={activeImage}
                    alt={notice.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#1a1207] to-[#0f0a04] text-amber-100/60">
                    <PackageOpen className="mb-2 h-8 w-8" />
                    <span className="text-xs">No image uploaded</span>
                  </div>
                )}

                {imageCount > 1 && (
                  <>
                    <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-amber-200/35 bg-black/65 px-2.5 py-1 text-[10px] font-semibold text-amber-50/95 backdrop-blur">
                      {imageIndex + 1}/{imageCount}
                    </div>
                    <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => shiftCardImage(notice.id, imageCount, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-200/35 bg-black/65 text-amber-50 transition hover:bg-black/85"
                        aria-label="Previous photo"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => shiftCardImage(notice.id, imageCount, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-200/35 bg-black/65 text-amber-50 transition hover:bg-black/85"
                        aria-label="Next photo"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}

                <div className="absolute bottom-3 left-3 rounded-xl bg-black/70 px-3 py-1.5 text-xs font-bold text-amber-50 backdrop-blur">
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

              <div className="px-1">
                <h3 className="font-display line-clamp-2 text-lg font-semibold leading-tight text-amber-50">{notice.title}</h3>
                {notice.category === 'Uniforms' ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-amber-100/75">
                    <MapPin className="h-3.5 w-3.5 text-amber-100/75" />
                    {notice.school || 'School not set'}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-amber-100/65">Books and notes are listed city-wide.</p>
                )}
                {notice.colony && notice.colony === userProfile?.colony && (
                  <p className="mt-2 inline-flex rounded-full bg-amber-200/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#4f3606]">
                    Walking Distance
                  </p>
                )}
                {metadataChips.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {metadataChips.slice(0, 2).map((chip) => (
                      <span
                        key={`${notice.id}-${chip}`}
                        className="rounded-full border border-amber-200/25 bg-[#1a1207] px-2.5 py-1 text-[10px] font-semibold text-amber-100/88"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-semibold text-amber-100/82">
                    {sellerProfiles[notice.sellerId]?.displayName || notice.sellerName || 'Community member'}
                  </p>
                  {!isPreview && (
                    <button
                      type="button"
                      onClick={() => openSellerProfile(notice)}
                      className="inline-flex items-center gap-1 rounded-full border border-amber-200/35 px-2.5 py-1 text-[11px] font-semibold text-amber-100 transition hover:bg-amber-100/10"
                    >
                      <User className="h-3.5 w-3.5" />
                      Profile
                    </button>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-amber-200/25 bg-[#1a1207] px-2 py-0.5 text-[10px] font-semibold text-amber-100/84">
                    {sellerProfiles[notice.sellerId]?.role || 'Parent'}
                  </span>
                  <span className="rounded-full border border-emerald-200/30 bg-emerald-200/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                    {sellerStats.sold} handovers
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] text-amber-100/65">{trustLine}</p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-amber-200/15 pt-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-100/70">
                  <Clock className="h-3.5 w-3.5" />
                  {timeAgo(notice.createdAt)}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => !isPreview && toggleSaveOffer(notice.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1207] text-amber-100/85 transition hover:bg-[#2a1d0b] disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={offerSaved ? 'Unsave offer' : 'Save offer'}
                    disabled={isPreview || offerSaving}
                    title={offerSaved ? 'Saved offer' : 'Save offer'}
                  >
                    {offerSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className={`h-4 w-4 ${offerSaved ? 'fill-current' : ''}`} />}
                  </button>
                  <button
                    onClick={() => !isPreview && handleNativeShare(notice)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1207] text-amber-100/85 transition hover:bg-[#2a1d0b]"
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
                      className="rounded-full bg-amber-200 px-3.5 py-1.5 text-xs font-bold text-[#382707] transition hover:brightness-105"
                    >
                      Connect
                    </a>
                  )}
                  {!isSelfListing && !isPreview && (
                    <button
                      type="button"
                      onClick={() => openReserveModal(notice)}
                      disabled={reserveSent}
                      className="rounded-full border border-amber-200/30 px-3 py-1.5 text-xs font-bold text-amber-100 transition hover:bg-amber-100/10 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {reserveSent ? 'Requested' : 'Reserve'}
                    </button>
                  )}
                </div>
              </div>
            </article>
            );
          })
        )}
      </div>

      {hasMoreNotices && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={loadMoreNotices}
            className="rounded-full border border-amber-200/35 bg-[#1b1307]/86 px-6 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-[#281b0b] hover:text-amber-50"
          >
            Load more listings ({renderedNotices.length - visibleNotices.length} left)
          </button>
        </div>
      )}

      {reserveNotice && (
        <div className="fixed inset-0 z-[195] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <form onSubmit={submitReserveRequest} className="glass-panel w-full max-w-md rounded-[1.6rem] p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-amber-100/62">Reserve Pickup</p>
                <h3 className="font-display mt-1 text-2xl font-semibold text-amber-50">{reserveNotice.title}</h3>
              </div>
              <button
                type="button"
                onClick={closeReserveModal}
                className="rounded-lg border border-amber-200/25 bg-[#171106] p-2 text-amber-100/80 transition hover:border-amber-200/45 hover:text-amber-50"
                aria-label="Close reserve modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Preferred meetup spot"
                className="w-full rounded-xl border border-amber-200/20 bg-[#171106] px-3.5 py-3 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
                value={reserveForm.preferredMeetup}
                onChange={(e) => setReserveForm((prev) => ({ ...prev, preferredMeetup: e.target.value }))}
              />
              <input
                type="text"
                placeholder="Preferred time (e.g., Today 5pm)"
                className="w-full rounded-xl border border-amber-200/20 bg-[#171106] px-3.5 py-3 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
                value={reserveForm.preferredTime}
                onChange={(e) => setReserveForm((prev) => ({ ...prev, preferredTime: e.target.value }))}
              />
              <textarea
                rows="3"
                placeholder="Add a short note (optional)"
                className="w-full resize-none rounded-xl border border-amber-200/20 bg-[#171106] px-3.5 py-3 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
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
        <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-[1.6rem] p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-amber-100/62">Seller Profile</p>
                <h3 className="font-display mt-1 text-2xl font-semibold text-amber-50">
                  {activeProfile.displayName || activeProfile.fallbackName || 'Community Member'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveProfile(null)}
                className="rounded-lg border border-amber-200/25 bg-[#171106] p-2 text-amber-100/80 transition hover:border-amber-200/45 hover:text-amber-50"
                aria-label="Close profile view"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-amber-100/86">
              <p>
                Role: <span className="text-amber-50">{activeProfile.role || 'Parent'}</span>
              </p>
              <p>
                School: <span className="text-amber-50">{activeProfile.primarySchool || activeProfile.fallbackSchool || 'Not shared'}</span>
              </p>
              <p>
                Colony: <span className="text-amber-50">{activeProfile.colony || 'Not shared'}</span>
              </p>
              {activeProfile.responseSpeed && (
                <p>
                  Response: <span className="text-amber-50">{activeProfile.responseSpeed}</span>
                </p>
              )}
              {activeProfile.profileTagline && (
                <p className="rounded-xl border border-amber-200/20 bg-[#130e06]/70 p-3 text-amber-100/82">{activeProfile.profileTagline}</p>
              )}
              {activeProfile.classFocus && (
                <p>
                  Classes: <span className="text-amber-50">{activeProfile.classFocus}</span>
                </p>
              )}
              {activeProfile.preferredMeetup && (
                <p>
                  Preferred handover: <span className="text-amber-50">{activeProfile.preferredMeetup}</span>
                </p>
              )}
              {activeProfile.availability && (
                <p>
                  Availability: <span className="text-amber-50">{activeProfile.availability}</span>
                </p>
              )}
              {activeProfile.bio && (
                <p className="rounded-xl border border-amber-200/20 bg-[#130e06]/70 p-3 text-amber-100/82">{activeProfile.bio}</p>
              )}
              {activeProfile.showPhoneOnProfile && (activeProfile.phone || activeProfile.phoneFromListing) && (
                <p>
                  Contact: <span className="text-amber-50">{activeProfile.phone || activeProfile.phoneFromListing}</span>
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
