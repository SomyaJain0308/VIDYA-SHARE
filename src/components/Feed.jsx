import React, { useEffect, useState } from 'react';
import { MapPin, Share2, Flag, Clock, AlertTriangle, PackageOpen, ShieldCheck, User, X, ShoppingBag, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
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

export default function Feed({ notices, userProfile, onStartListing, onOpenRequests }) {
  const [schoolFilter, setSchoolFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [recencyFilter, setRecencyFilter] = useState('all');
  const [colonyFilter, setColonyFilter] = useState('all');
  const [showSold, setShowSold] = useState(false);
  const [reportedItems, setReportedItems] = useState([]);
  const [savedOffers, setSavedOffers] = useState([]);
  const [sellerProfiles, setSellerProfiles] = useState({});
  const [activeProfile, setActiveProfile] = useState(null);
  const [featuredBookIndex, setFeaturedBookIndex] = useState(0);

  const categories = ['All', 'Books', 'Uniforms'];
  const recencyOptions = [
    { value: 'all', label: 'All' },
    { value: '24h', label: '24h' },
    { value: '7d', label: '7d' },
    { value: '30d', label: '30d' },
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

  const toggleSaveOffer = (noticeId) => {
    setSavedOffers((prev) => (prev.includes(noticeId) ? prev.filter((id) => id !== noticeId) : [...prev, noticeId]));
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
  const getTrustLine = (notice) => {
    const profile = sellerProfiles[notice.sellerId] || {};
    const hasProfileData = Object.keys(profile).length > 0;
    if (!hasProfileData) {
      return 'Verified account • Profile details pending';
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
    return `${verifiedPart} • ${visibilityPart} • ${completionPart}`;
  };

  const sanitizeTrustLine = (value) => (value || '').replaceAll('â€¢', '|').replaceAll('•', '|');
  const buildGhostWord = (value) => {
    const clean = (value || 'BOOKS').replace(/[^a-z0-9 ]/gi, ' ').trim();
    const firstWord = clean.split(/\s+/)[0] || 'BOOKS';
    return firstWord.toUpperCase().slice(0, 10);
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
      return searchableText.includes(searchTerm);
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
      const userSchool = userProfile?.primarySchool;
      const aMatches = userSchool && a.school === userSchool ? 1 : 0;
      const bMatches = userSchool && b.school === userSchool ? 1 : 0;
      if (aMatches !== bMatches) return bMatches - aMatches;

      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeB - timeA;
    });

  const bookNotices = processedNotices.filter((notice) => notice.category === 'Books');
  useEffect(() => {
    if (bookNotices.length === 0) {
      setFeaturedBookIndex(0);
      return;
    }
    setFeaturedBookIndex((prev) => Math.min(prev, bookNotices.length - 1));
  }, [bookNotices.length]);

  const isBooksShowcase = categoryFilter !== 'Uniforms';
  const featuredBook = bookNotices[featuredBookIndex] || null;
  const featuredStatusMeta = getStatusMeta(featuredBook?.status || 'active');
  const featuredMetadata = featuredBook ? getMetadataChips(featuredBook) : [];
  const featuredTrust = featuredBook ? sanitizeTrustLine(getTrustLine(featuredBook)) : '';
  const featuredSaved = featuredBook ? savedOffers.includes(featuredBook.id) : false;
  const featuredGhostWord = buildGhostWord(featuredBook?.title || 'Books');
  const featuredCountLabel = bookNotices.length > 0 ? `${String(featuredBookIndex + 1).padStart(2, '0')} / ${String(bookNotices.length).padStart(2, '0')}` : '00 / 00';
  const featuredLocationLine = featuredBook?.school
    ? featuredBook.school
    : featuredBook
      ? 'City-wide pickup across Saharanpur'
      : 'Library showcase loading';
  const featuredConnectLink = featuredBook
    ? generateWhatsAppLink(featuredBook.sellerPhone || '', featuredBook.title, featuredBook.school, 'EN', featuredBook.successNote)
    : null;
  const shiftFeaturedBook = (direction) => {
    if (bookNotices.length <= 1) return;
    setFeaturedBookIndex((prev) => {
      const nextIndex = prev + direction;
      if (nextIndex < 0) return bookNotices.length - 1;
      if (nextIndex >= bookNotices.length) return 0;
      return nextIndex;
    });
  };

  return (
    <div className="market-feed mx-auto w-full max-w-[1400px] pb-14 pt-2">
      {isBooksShowcase ? (
        <>
        <section className="relative overflow-hidden rounded-[2rem] border border-amber-200/20 bg-gradient-to-b from-[#140e06]/60 via-[#0f0903]/30 to-transparent p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(239,198,88,0.24),transparent_48%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.1),transparent_38%)]" />
          <div className="relative z-10">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-100/72">Book Showcase</p>
                <h2 className="font-display text-2xl font-semibold text-amber-50 sm:text-3xl">A premium stage for every listed book</h2>
              </div>
              <div className="hidden items-center gap-2 rounded-full border border-amber-200/30 bg-amber-200/10 px-3 py-1 text-xs font-semibold text-amber-100 md:flex">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified community
              </div>
            </div>

            <div className="book-stage relative overflow-hidden rounded-[1.9rem] border border-amber-200/18 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(255,229,156,0.14),transparent_18%),linear-gradient(180deg,rgba(8,5,2,0.08),rgba(8,5,2,0.18)_36%,rgba(8,5,2,0.26)_100%)]" />
              <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-[58%] overflow-hidden">
                <div className="book-stage__ghost text-center font-[Sora] text-[5.25rem] font-extrabold uppercase leading-none tracking-[-0.08em] text-white/16 sm:text-[7rem] lg:text-[12rem]">
                  {featuredGhostWord}
                </div>
              </div>

              <div className="relative z-10 flex min-h-[660px] flex-col justify-between gap-8">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-[460px]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-100/70">Featured Book</p>
                    {featuredBook ? (
                      <>
                        <h3 className="font-display mt-2 text-3xl font-semibold leading-tight text-amber-50 sm:text-4xl lg:text-[3.5rem]">
                          {featuredBook.title}
                        </h3>
                        <p className="mt-3 max-w-lg text-sm leading-relaxed text-amber-100/80 sm:text-base">
                          {featuredBook.successNote || 'Trusted student listing with easy handover, premium visibility, and neighborhood trust built in.'}
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="font-display mt-2 text-3xl font-semibold leading-tight text-amber-50 sm:text-4xl lg:text-[3.5rem]">
                          Book showcases are getting ready
                        </h3>
                        <p className="mt-3 max-w-lg text-sm leading-relaxed text-amber-100/80 sm:text-base">
                          The first live book will appear here as a dramatic centerpiece instead of getting buried inside ordinary cards.
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
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
                </div>

                <div className="relative flex min-h-[320px] flex-1 items-center justify-center py-2 sm:min-h-[420px] lg:min-h-[500px]">
                  <div className="book-hero relative h-[350px] w-[250px] sm:h-[460px] sm:w-[330px] lg:h-[560px] lg:w-[400px]">
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

                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-end">
                  <div className="order-2 lg:order-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/58">Offer Price</p>
                    <div className="mt-2 flex flex-wrap items-end gap-4">
                      <p className="font-display text-4xl font-semibold text-amber-200 sm:text-5xl lg:text-[4rem]">
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

                  <div className="order-1 flex flex-col items-center justify-center gap-3 lg:order-2">
                    <button
                      type="button"
                      onClick={() => featuredBook && toggleSaveOffer(featuredBook.id)}
                      className="book-stage__cta inline-flex min-w-[220px] items-center justify-center gap-2 rounded-[1.05rem] px-6 py-3.5 text-sm font-bold text-[#1e1606] transition hover:brightness-105"
                    >
                      <ShoppingBag className={`h-4 w-4 ${featuredSaved ? 'fill-current' : ''}`} />
                      {featuredSaved ? 'Offer Saved' : 'Save Offer'}
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
                  </div>

                  <div className="order-3 flex items-center justify-between gap-4 lg:justify-end">
                    <div className="text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/52">Live books</p>
                      <p className="mt-1 text-sm font-semibold text-amber-50/82">{featuredCountLabel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => shiftFeaturedBook(-1)}
                        disabled={bookNotices.length <= 1}
                        className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-200/28 bg-[#120c05]/58 text-amber-100 transition hover:border-amber-200/48 hover:bg-[#1e1408]/85 disabled:cursor-not-allowed disabled:opacity-45"
                        aria-label="Previous book"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => shiftFeaturedBook(1)}
                        disabled={bookNotices.length <= 1}
                        className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-200/28 bg-[#120c05]/58 text-amber-100 transition hover:border-amber-200/48 hover:bg-[#1e1408]/85 disabled:cursor-not-allowed disabled:opacity-45"
                        aria-label="Next book"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>
        <section className="surface-panel mt-4 rounded-[1.6rem] p-4 sm:p-5">
          <div className="hide-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  categoryFilter === cat
                    ? 'bg-amber-200 text-[#382607] shadow-[0_12px_30px_-16px_rgba(212,175,55,0.95)]'
                    : 'border border-amber-200/20 bg-[#1a1207]/70 text-amber-100/82 hover:bg-[#281b0a]/85'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_160px_170px_auto_auto]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, school, category, note, keyword"
              className="w-full rounded-xl border border-amber-200/20 bg-[#171106]/80 px-4 py-2.5 text-sm text-amber-50 placeholder:text-amber-100/40 outline-none focus:border-amber-200/45"
            />
            <select
              value={recencyFilter}
              onChange={(e) => setRecencyFilter(e.target.value)}
              className="rounded-xl border border-amber-200/20 bg-[#171106]/80 px-3 py-2.5 text-sm font-medium text-amber-100 outline-none focus:border-amber-200/45"
            >
              {recencyOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#171106]">
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={colonyFilter}
              onChange={(e) => setColonyFilter(e.target.value)}
              className="rounded-xl border border-amber-200/20 bg-[#171106]/80 px-3 py-2.5 text-sm font-medium text-amber-100 outline-none focus:border-amber-200/45"
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
                  ? 'border-amber-200/45 bg-amber-200/15 text-amber-100'
                  : 'border-amber-200/25 bg-[#171106]/75 text-amber-100/75 hover:bg-[#211608]/85'
              }`}
            >
              {showSold ? 'Hide sold' : 'Show sold'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setRecencyFilter('all');
                setColonyFilter('all');
                setCategoryFilter('All');
                setSchoolFilter('');
              }}
              className="rounded-xl border border-amber-200/25 bg-[#171106]/75 px-4 py-2.5 text-sm font-semibold text-amber-100/85 transition hover:bg-[#211608]/85"
            >
              Clear
            </button>
          </div>
        </section>
        </>
      ) : (
        <section className="glass-panel relative overflow-hidden rounded-[1.8rem] p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_50%_0%,rgba(238,200,103,0.26),transparent_72%)]" />
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
                      : 'bg-[#1a1207] text-amber-100/80 hover:bg-[#281b0a]'
                  }`}
                >
                  {cat}
                </button>
              ))}
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

            <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_160px_170px_auto]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, school, category, note, keyword"
                className="w-full rounded-xl border border-amber-200/20 bg-[#171106] px-4 py-2.5 text-sm text-amber-50 placeholder:text-amber-100/40 outline-none focus:border-amber-200/45"
              />
              <select
                value={recencyFilter}
                onChange={(e) => setRecencyFilter(e.target.value)}
                className="rounded-xl border border-amber-200/20 bg-[#171106] px-3 py-2.5 text-sm font-medium text-amber-100 outline-none focus:border-amber-200/45"
              >
                {recencyOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#171106]">
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={colonyFilter}
                onChange={(e) => setColonyFilter(e.target.value)}
                className="rounded-xl border border-amber-200/20 bg-[#171106] px-3 py-2.5 text-sm font-medium text-amber-100 outline-none focus:border-amber-200/45"
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
                  setColonyFilter('all');
                  setCategoryFilter('All');
                  setSchoolFilter('');
                }}
                className="rounded-xl border border-amber-200/25 bg-[#171106] px-4 py-2.5 text-sm font-semibold text-amber-100/85 transition hover:bg-[#211608]"
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
                    ? 'border-amber-200/40 bg-amber-200/15 text-amber-100'
                    : 'border-amber-200/25 bg-[#171106] text-amber-100/75 hover:bg-[#211608]'
                }`}
              >
                {showSold ? 'Hide sold' : 'Show sold'}
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {processedNotices.length === 0 ? (
          <div className="glass-panel relative col-span-full overflow-hidden rounded-[1.8rem] px-6 py-16 text-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(238,200,103,0.23),transparent_56%),linear-gradient(180deg,rgba(19,13,6,0.35),rgba(10,7,4,0.48))]" />
            <div className="relative z-10">
              <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-amber-200/70" />
              <h3 className="font-display text-2xl font-semibold text-amber-50">No listings yet</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm text-amber-100/78">
                Be first to post an item for your neighborhood, or check requests from families who are looking for one.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
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
          processedNotices.map((notice) => {
            const status = notice.status || 'active';
            const statusMeta = getStatusMeta(status);
            const metadataChips = getMetadataChips(notice);
            const trustLine = sanitizeTrustLine(getTrustLine(notice));
            const connectLink = generateWhatsAppLink(notice.sellerPhone || '', notice.title, notice.school, 'EN', notice.successNote);

            return (
              <article
              key={notice.id}
              className="glass-panel group relative overflow-hidden rounded-[1.4rem] p-3 transition-all hover:-translate-y-0.5 hover:border-amber-200/45"
            >
              <button
                onClick={() => handleReport(notice)}
                className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-amber-100/75 opacity-0 transition-all hover:bg-rose-500/85 hover:text-white group-hover:opacity-100"
                title="Report Listing"
              >
                <Flag className="h-3.5 w-3.5" />
              </button>

              <div className="relative mb-3 aspect-[1.08] overflow-hidden rounded-[1.1rem] bg-[#120e06]">
                {notice.photoUrl ? (
                  <img
                    src={notice.photoUrl}
                    alt={notice.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#1a1207] to-[#0f0a04] text-amber-100/60">
                    <PackageOpen className="mb-2 h-8 w-8" />
                    <span className="text-xs">No image uploaded</span>
                  </div>
                )}

                <div className="absolute bottom-3 left-3 rounded-xl bg-black/70 px-3 py-1.5 text-xs font-bold text-amber-50 backdrop-blur">
                  {Number(notice.price) === 0 ? 'Gifted Item' : `Rs ${notice.price}`}
                </div>
                <div className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusMeta.badgeClass}`}>
                  {statusMeta.label}
                </div>
              </div>

              <div className="px-1">
                <h3 className="font-display text-lg font-semibold leading-tight text-amber-50">{notice.title}</h3>
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
                    {metadataChips.map((chip) => (
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
                  <button
                    type="button"
                    onClick={() => openSellerProfile(notice)}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-200/35 px-2.5 py-1 text-[11px] font-semibold text-amber-100 transition hover:bg-amber-100/10"
                  >
                    <User className="h-3.5 w-3.5" />
                    Profile
                  </button>
                </div>
                <p className="mt-1 truncate text-[11px] text-amber-100/65">{trustLine}</p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-amber-200/15 pt-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-100/70">
                  <Clock className="h-3.5 w-3.5" />
                  {timeAgo(notice.createdAt)}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleNativeShare(notice)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1207] text-amber-100/85 transition hover:bg-[#2a1d0b]"
                    aria-label="Share listing"
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
                </div>
              </div>
            </article>
            );
          })
        )}
      </div>

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
                School: <span className="text-amber-50">{activeProfile.primarySchool || activeProfile.fallbackSchool || 'Not shared'}</span>
              </p>
              <p>
                Colony: <span className="text-amber-50">{activeProfile.colony || 'Not shared'}</span>
              </p>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
