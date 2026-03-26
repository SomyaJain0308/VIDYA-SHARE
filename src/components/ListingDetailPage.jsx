import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  MapPin,
  MessageCircle,
  PackageOpen,
  School,
  Share2,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { SUPPORT_EMAIL } from '../config/compliance';
import { buildListingShareUrl, getListingLocationLabel } from '../utils/listings';
import { trackContactInitiated, trackListingView } from '../utils/analytics';
import ReportListingModal from './ReportListingModal';
import { MARKETPLACE_SAFETY_TIPS } from '../utils/marketplaceCompliance';
import { submitListingReport } from '../utils/reporting';

const timeAgo = (timestamp) => {
  if (!timestamp) return 'Recently listed';
  const timestampDate =
    typeof timestamp?.toDate === 'function'
      ? timestamp.toDate()
      : timestamp instanceof Date
        ? timestamp
        : null;

  if (!timestampDate || Number.isNaN(timestampDate.getTime?.())) return 'Recently listed';

  const seconds = Math.floor((Date.now() - timestampDate.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const getVerificationLabel = (listing = {}) =>
  listing.sellerVerificationStatus === 'basic-self-declared'
    ? 'Basic seller check completed'
    : 'Seller check pending';

const getStatusMeta = (status) => {
  if (status === 'sold') return { label: 'Sold', className: 'bg-rose-300/85 text-[#4a1b25]' };
  if (status === 'reserved') return { label: 'Reserved', className: 'bg-cyan-200 text-[#082231]' };
  return { label: 'Active', className: 'bg-emerald-200/90 text-[#153421]' };
};

const formatPriceLabel = (price) => (Number(price) === 0 ? 'Free' : `Rs ${Number(price || 0).toLocaleString('en-IN')}`);

const isSellerVerified = (listing = {}) => listing.sellerVerificationStatus === 'basic-self-declared';

const getSellerRoleLabel = (listing = {}) => {
  const normalizedRole = String(listing.sellerRole || listing.role || '').trim().toLowerCase();
  if (normalizedRole === 'student') return 'Student seller';
  if (normalizedRole === 'parent' || normalizedRole === 'guardian') return 'Parent seller';
  if (listing.sellerSchool || listing.school) return 'Student seller';
  return 'Local seller';
};

export default function ListingDetailPage({ listingId = '', userProfile, onRequireAuth, onNavigateHome, onOpenChat }) {
  const currentUserId = auth.currentUser?.uid || '';
  const [listing, setListing] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [brokenImageKeys, setBrokenImageKeys] = useState({});
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportError, setReportError] = useState('');
  const [isReportSubmitting, setIsReportSubmitting] = useState(false);
  const trackedListingViewKeyRef = useRef('');

  const markImageBroken = (imageUrl) => {
    setBrokenImageKeys((prev) => (prev[imageUrl] ? prev : { ...prev, [imageUrl]: true }));
  };

  useEffect(() => {
    let cancelled = false;

    const loadListing = async () => {
      if (!listingId) {
        setListing(null);
        setLoadError('This listing link is incomplete.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError('');

      try {
        const publicSnapshot = await getDoc(doc(db, 'publicListings', listingId));
        if (publicSnapshot.exists()) {
          if (!cancelled) {
            setListing({ id: publicSnapshot.id, ...publicSnapshot.data() });
            setActiveImageIndex(0);
            setIsLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setListing(null);
          setLoadError('This listing is no longer available or the shared link has expired.');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Failed to load listing detail', error);
        if (!cancelled) {
          setListing(null);
          setLoadError('Could not load this listing right now.');
          setIsLoading(false);
        }
      }
    };

    loadListing();

    return () => {
      cancelled = true;
    };
  }, [listingId, currentUserId]);

  useEffect(() => {
    if (!listing) return;

    const listingTitle = listing.title || 'Listing';
    const title = `${listingTitle} - Used Books in Saharanpur`;
    const description = `Buy ${listingTitle} from a student in Saharanpur at an affordable price.`;

    document.title = title;
    const descriptionMeta = document.querySelector('meta[name="description"]');
    if (descriptionMeta) descriptionMeta.setAttribute('content', description);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) ogDescription.setAttribute('content', description);
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) twitterTitle.setAttribute('content', title);
    const twitterDescription = document.querySelector('meta[name="twitter:description"]');
    if (twitterDescription) twitterDescription.setAttribute('content', description);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', buildListingShareUrl(listing.id));
  }, [listing]);

  useEffect(() => {
    if (!listing?.id) return;
    const authState = auth.currentUser?.uid ? 'signed_in' : 'guest';
    const trackingKey = `${listing.id}:${authState}`;
    if (trackedListingViewKeyRef.current === trackingKey) return;
    trackedListingViewKeyRef.current = trackingKey;
    trackListingView({
      listing,
      surface: 'listing_detail',
      authState,
    });
  }, [listing, currentUserId]);

  const imageUrls = useMemo(() => {
    if (Array.isArray(listing?.photoUrls) && listing.photoUrls.length > 0) {
      return listing.photoUrls.filter(Boolean);
    }
    return listing?.photoUrl ? [listing.photoUrl] : [];
  }, [listing]);

  const statusMeta = getStatusMeta(listing?.status || 'active');
  const activeImage = imageUrls[activeImageIndex] || imageUrls[0] || '';
  const showActiveImage = Boolean(activeImage) && !brokenImageKeys[activeImage];
  const shareUrl = buildListingShareUrl(listingId);
  const priceLabel = formatPriceLabel(listing?.price);
  const sellerRoleLabel = getSellerRoleLabel(listing || {});
  const sellerVerified = isSellerVerified(listing || {});
  const locationLabel = getListingLocationLabel(listing || {});
  const primaryDetailChips = [
    listing?.listingType === 'set' ? 'Book Set' : '',
    listing?.classGrade ? `Class ${listing.classGrade}` : '',
    listing?.condition || '',
    locationLabel,
  ].filter(Boolean);
  const canChatWithSeller = Boolean(listing?.sellerId) && auth.currentUser?.uid !== listing?.sellerId;

  const shiftImage = (direction) => {
    if (imageUrls.length <= 1) return;
    setActiveImageIndex((current) => (current + direction + imageUrls.length) % imageUrls.length);
  };

  const handleShare = async () => {
    if (!listing) return;
    const shareData = {
      title: `${listing.title} | Vidya Share`,
      text: `${listing.title} for ${Number(listing.price) === 0 ? 'Free' : `Rs ${listing.price}`}`,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      window.alert('Listing link copied to clipboard.');
    } catch (error) {
      console.error('Listing share failed', error);
    }
  };

  const openReportModal = () => {
    if (!auth.currentUser) {
      if (typeof onRequireAuth === 'function') {
        onRequireAuth(() => setIsReportModalOpen(true));
      }
      return;
    }
    setReportReason('');
    setReportDetails('');
    setReportError('');
    setIsReportModalOpen(true);
  };

  const closeReportModal = () => {
    if (isReportSubmitting) return;
    setIsReportModalOpen(false);
    setReportReason('');
    setReportDetails('');
    setReportError('');
  };

  const submitReport = async () => {
    if (!listing || !auth.currentUser) return;
    if (!reportReason) {
      setReportError('Choose a report reason so the moderation queue can triage it correctly.');
      return;
    }

    setIsReportSubmitting(true);
    setReportError('');
    try {
      const result = await submitListingReport({
        db,
        listing,
        reporterId: auth.currentUser.uid,
        reporterName: userProfile?.displayName || auth.currentUser.displayName || '',
        reason: reportReason,
        details: reportDetails,
      });
      if (result.alreadyExists) {
        window.alert('You already reported this listing. Our moderation queue has your earlier report.');
      } else {
        window.alert('Report submitted. Thank you for helping keep the marketplace safe.');
      }
      closeReportModal();
    } catch (error) {
      console.error('Listing report failed', error);
      setReportError(error?.message || 'Could not send this report right now.');
    } finally {
      setIsReportSubmitting(false);
    }
  };

  const openListingChat = () => {
    if (!listing) return;
    trackContactInitiated({
      listing,
      surface: 'listing_detail',
      authState: auth.currentUser?.uid ? 'signed_in' : 'guest',
      contactState: !auth.currentUser
        ? 'auth_required'
        : auth.currentUser.uid === listing.sellerId
          ? 'self_listing'
          : 'chat_only',
    });
    if (!auth.currentUser) {
      if (typeof onRequireAuth === 'function') {
        onRequireAuth(() => onOpenChat && onOpenChat(listing));
      }
      return;
    }
    if (auth.currentUser?.uid === listing.sellerId) {
      window.alert('This is your own listing.');
      return;
    }
    if (typeof onOpenChat === 'function') {
      onOpenChat(listing);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1480px] px-3 pb-16 pt-6 sm:px-6">
        <div className="lux-panel flex min-h-[420px] items-center justify-center p-6 text-sm font-semibold text-cyan-50/78">
          <Loader2 className="mr-3 h-5 w-5 animate-spin text-cyan-100" />
          Loading listing...
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="mx-auto w-full max-w-[980px] px-3 pb-16 pt-6 sm:px-6">
        <div className="lux-panel p-6 sm:p-8">
          <button
            type="button"
            onClick={() => onNavigateHome && onNavigateHome()}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-[#08111a]/88 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:border-cyan-300/34 hover:bg-white/[0.08]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to listings
          </button>
          <h1 className="font-display mt-6 text-3xl font-semibold text-white">Listing unavailable</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-cyan-50/74">
            {loadError || 'This listing could not be opened. It may have been removed, sold long ago, or shared with an incomplete link.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1540px] px-3 pb-16 pt-4 sm:px-6">
      <section className="lux-panel overflow-hidden p-5 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigateHome && onNavigateHome()}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-[#08111a]/88 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:border-cyan-300/34 hover:bg-white/[0.08]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to listings
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusMeta.className}`}>{statusMeta.label}</span>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-[#08111a]/88 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:border-cyan-300/34 hover:bg-white/[0.08]"
            >
              <Share2 className="h-4 w-4" />
              Share listing
            </button>
            <button
              type="button"
              onClick={openReportModal}
              className="inline-flex items-center gap-2 rounded-full border border-rose-200/24 bg-rose-300/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:border-rose-200/38 hover:bg-rose-300/18"
            >
              <ShieldCheck className="h-4 w-4" />
              Report listing
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_390px]">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.94fr)]">
            <div>
              <div className="relative overflow-hidden rounded-[2rem] border border-cyan-300/14 bg-[#08111a] shadow-[0_32px_90px_-48px_rgba(0,0,0,0.95)]">
                <div className="listing-detail-media aspect-[4/5] w-full bg-[radial-gradient(circle_at_50%_10%,rgba(91,232,255,0.16),transparent_30%),linear-gradient(180deg,#08111a,#050b11)]">
                  {showActiveImage ? (
                    <img
                      src={activeImage}
                      alt={listing.title}
                      className="h-full w-full object-contain"
                      onError={() => markImageBroken(activeImage)}
                    />
                  ) : (
                    <div className="listing-card-placeholder h-full w-full">
                      <PackageOpen className="mb-2 h-10 w-10" />
                      <span className="text-sm font-semibold">Listing image unavailable</span>
                    </div>
                  )}
                </div>
                {imageUrls.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => shiftImage(-1)}
                      className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-300/24 bg-black/50 text-cyan-50 transition hover:bg-black/72"
                      aria-label="Previous listing image"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => shiftImage(1)}
                      className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-300/24 bg-black/50 text-cyan-50 transition hover:bg-black/72"
                      aria-label="Next listing image"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
                <div className="absolute bottom-4 left-4 rounded-[1.15rem] border border-white/10 bg-black/72 px-4 py-2.5 text-cyan-50 backdrop-blur">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-50/58">Price</p>
                  <p className="mt-1 text-lg font-black text-white">{priceLabel}</p>
                </div>
              </div>

              {imageUrls.length > 1 && (
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {imageUrls.map((imageUrl, index) => (
                    <button
                      key={`${listing.id}-thumb-${index}`}
                      type="button"
                      onClick={() => setActiveImageIndex(index)}
                      className={`overflow-hidden rounded-[1rem] border transition ${
                        activeImageIndex === index
                          ? 'border-cyan-200/80 shadow-[0_18px_36px_-22px_rgba(91,232,255,0.55)]'
                          : 'border-cyan-300/14'
                      }`}
                    >
                      {brokenImageKeys[imageUrl] ? (
                        <div className="listing-card-placeholder aspect-square h-full w-full">
                          <PackageOpen className="h-5 w-5" />
                        </div>
                      ) : (
                        <img
                          src={imageUrl}
                          alt={`${listing.title} ${index + 1}`}
                          className="aspect-square h-full w-full object-cover"
                          onError={() => markImageBroken(imageUrl)}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100/62">Book listing</p>
              <h1 className="font-display mt-3 text-3xl font-semibold leading-tight text-white sm:text-[2.65rem]">
                {listing.title}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <span className="rounded-full border border-cyan-100/35 bg-cyan-300 px-4 py-2 text-base font-black text-[#041018] shadow-[0_16px_40px_-26px_rgba(91,232,255,0.8)]">
                  {priceLabel}
                </span>
                <span className="rounded-full border border-cyan-300/18 bg-[#08111a]/88 px-3 py-1.5 text-xs font-semibold text-cyan-50/86">
                  {sellerRoleLabel}
                </span>
                {sellerVerified ? (
                  <span className="rounded-full border border-emerald-200/30 bg-emerald-200/12 px-3 py-1.5 text-xs font-semibold text-emerald-100">
                    Verified
                  </span>
                ) : null}
              </div>

              <div className="mt-4 rounded-[1.35rem] border border-cyan-300/16 bg-[#08111a]/88 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-50/56">Why buyers click</p>
                <p className="mt-2 text-base leading-relaxed text-cyan-50/82">
                  {listing.description}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {[listing.subject, ...primaryDetailChips].filter(Boolean).map((chip) => (
                  <span
                    key={`${listing.id}-${chip}`}
                    className="rounded-full border border-cyan-300/18 bg-[#08111a]/88 px-3 py-1.5 text-xs font-semibold text-cyan-50/86"
                  >
                    {chip}
                  </span>
                ))}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="lux-panel-soft rounded-[1.25rem] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-50/56">Condition</p>
                  <p className="mt-2 text-sm font-semibold text-white">{listing.condition || 'Not specified'}</p>
                </div>
                <div className="lux-panel-soft rounded-[1.25rem] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-50/56">Class / Exam</p>
                  <p className="mt-2 text-sm font-semibold text-white">{listing.classGrade || 'General book listing'}</p>
                </div>
                <div className="lux-panel-soft rounded-[1.25rem] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-50/56">Location</p>
                  <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                    <MapPin className="h-4 w-4 text-cyan-100" />
                    {locationLabel}
                  </p>
                </div>
                <div className="lux-panel-soft rounded-[1.25rem] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-50/56">Listed</p>
                  <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                    <Clock3 className="h-4 w-4 text-cyan-100" />
                    {timeAgo(listing.createdAt)}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[1.4rem] border border-cyan-200/20 bg-[linear-gradient(145deg,rgba(10,23,35,0.96),rgba(7,17,26,0.92))] p-4 sm:p-5">
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/62">Next step</p>
                    <p className="mt-2 text-sm leading-relaxed text-cyan-50/76">
                      Ask about edition, pickup area, and availability before you travel.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <button
                      type="button"
                      onClick={openListingChat}
                      disabled={!canChatWithSeller}
                      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-cyan-300/28 bg-white/5 px-5 py-3 text-sm font-bold text-cyan-50 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <MessageCircle className="h-4 w-4" />
                      💬 Chat with Seller
                    </button>
                  </div>
                </div>
              </div>

              {listing.successNote && (
                <div className="mt-5 rounded-[1.35rem] border border-cyan-300/16 bg-[#08111a]/88 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-50/56">Seller note</p>
                  <p className="mt-2 text-sm leading-relaxed text-cyan-50/80">{listing.successNote}</p>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="lux-panel-soft rounded-[1.6rem] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/62">Seller info</p>
              <div className="mt-4 flex items-start gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-[1rem] border border-cyan-300/18 bg-cyan-300/10 text-cyan-100">
                  <User className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-lg font-semibold text-white">{listing.sellerName || 'Community member'}</p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-cyan-50/74">
                    <School className="h-4 w-4 text-cyan-100" />
                    {listing.sellerSchool || 'School not shared'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-cyan-300/18 bg-[#08111a]/88 px-3 py-1 text-xs font-semibold text-cyan-50/86">
                      {sellerRoleLabel}
                    </span>
                    {sellerVerified ? (
                      <span className="rounded-full border border-emerald-200/30 bg-emerald-200/12 px-3 py-1 text-xs font-semibold text-emerald-100">
                        Verified
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-cyan-300/16 bg-[#08111a]/88 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-50/56">Pickup area</p>
                <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <MapPin className="h-4 w-4 text-cyan-100" />
                  {locationLabel}
                </p>
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-cyan-300/16 bg-[#08111a]/88 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-white">
                  <ShieldCheck className="h-4 w-4 text-cyan-100" />
                  {getVerificationLabel(listing)}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-cyan-50/72">
                  Communication stays inside chat so buyers and sellers can confirm the deal safely first.
                </p>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-cyan-50/66">
                Use in-app chat to confirm edition, pickup timing, and the final handover plan before sharing any personal details.
              </p>
            </div>

            <div className="lux-panel-soft rounded-[1.6rem] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/62">Buyer checklist</p>
              <ul className="mt-4 space-y-2 text-sm leading-relaxed text-cyan-50/74">
                <li>Review the description and condition before contacting the seller.</li>
                <li>Confirm class or exam fit, edition, and included books before pickup.</li>
                {MARKETPLACE_SAFETY_TIPS.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
              <p className="mt-4 rounded-[1.2rem] border border-cyan-300/16 bg-[#08111a]/88 p-3 text-xs leading-relaxed text-cyan-50/70">
                Vidya Share is a marketplace platform only. Payments, delivery, returns, and disputes stay directly between buyer and seller. Report unsafe listings via {SUPPORT_EMAIL}.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <ReportListingModal
        isOpen={isReportModalOpen}
        listingTitle={listing?.title || ''}
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
