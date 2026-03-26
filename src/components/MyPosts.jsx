import React, { useEffect, useRef, useState } from 'react';
import { collection, deleteField, doc, getDoc, getDocs, orderBy, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { Trash2, PackageOpen, Loader2, ShieldCheck, Sparkles, CheckCircle2, XCircle, PencilLine, X, Camera, ChevronLeft, ChevronRight, Star, ArrowLeft } from 'lucide-react';
import { deleteListingImage, uploadListingImage } from '../utils/listingImageStorage';
import { CONSENT_VERSION } from '../config/compliance';
import { extractKeywords, normalizeText } from '../utils/matching';
import { buildPublicListingPayload, LISTING_CONDITION_OPTIONS } from '../utils/listings';
import { deleteListingWithRelations, updateDealRequestState, updateListingLifecycleStatus } from '../utils/listingIntegrity';
import { findBlockedMarketplaceTerms, findSuspiciousMarketplaceTerms, getBlockedContentMessage, getSuspiciousContentMessage } from '../utils/marketplaceCompliance';

const MAX_LISTING_PHOTOS = 2;

const formatRelativeTime = (timestamp) => {
  const timestampDate =
    typeof timestamp?.toDate === 'function'
      ? timestamp.toDate()
      : timestamp instanceof Date
        ? timestamp
        : null;
  if (!timestampDate || Number.isNaN(timestampDate.getTime?.())) return 'Just now';
  const seconds = Math.floor((Date.now() - timestampDate.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const timestampToMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return 0;
};

export default function MyPosts() {
  const [myItems, setMyItems] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [dealRequests, setDealRequests] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusSavingId, setStatusSavingId] = useState('');
  const [dealActionId, setDealActionId] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    category: 'Books',
    school: '',
    price: '',
    description: '',
    subject: '',
    classGrade: '',
    location: '',
    condition: '',
    successNote: '',
  });
  const [editMedia, setEditMedia] = useState([]);
  const [editCoverIndex, setEditCoverIndex] = useState(0);
  const [editUploadProgress, setEditUploadProgress] = useState(0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const editMediaRef = useRef([]);

  useEffect(() => {
    editMediaRef.current = editMedia;
  }, [editMedia]);

  useEffect(() => {
    return () => {
      editMediaRef.current.forEach((entry) => {
        if (entry?.previewUrl && entry?.isLocal) URL.revokeObjectURL(entry.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setMyItems([]);
        setMyRequests([]);
        setDealRequests([]);
        setUserProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) setUserProfile(userDoc.data());

        const itemsQuery = query(collection(db, 'publicListings'), where('sellerId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
        const itemsSnapshot = await getDocs(itemsQuery);
        const items = [];
        itemsSnapshot.forEach((entry) => items.push({ id: entry.id, ...entry.data() }));
        setMyItems(items);

        const requestsQuery = query(collection(db, 'requests'), where('requesterId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
        const requestsSnapshot = await getDocs(requestsQuery);
        const requests = [];
        requestsSnapshot.forEach((entry) => requests.push({ id: entry.id, ...entry.data() }));
        setMyRequests(requests);

        const dealsQuery = query(collection(db, 'dealRequests'), where('sellerId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
        const dealsSnapshot = await getDocs(dealsQuery);
        const deals = [];
        dealsSnapshot.forEach((entry) => deals.push({ id: entry.id, ...entry.data() }));
        setDealRequests(deals);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard:', error);
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this listing permanently?')) return;
    const targetItem = myItems.find((item) => item.id === id);
    const storagePaths = Array.isArray(targetItem?.photoPaths) ? targetItem.photoPaths.filter(Boolean) : [];

    await deleteListingWithRelations({ db, listingId: id });
    await Promise.allSettled(storagePaths.map((storagePath) => deleteListingImage(storagePath)));
    setMyItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out failed', error);
      window.alert(error?.message || 'Could not sign out right now.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const openEditModal = (item) => {
    if (!item) return;
    const existingPhotos = Array.isArray(item.photoUrls) && item.photoUrls.length > 0
      ? item.photoUrls
      : item.photoUrl
        ? [item.photoUrl]
        : [];
    const existingPhotoPaths = Array.isArray(item.photoPaths) ? item.photoPaths : [];

    editMediaRef.current.forEach((entry) => {
      if (entry?.previewUrl && entry?.isLocal) URL.revokeObjectURL(entry.previewUrl);
    });

    setEditError('');
    setEditingItem(item);
    setEditForm({
      title: item.title || '',
      category: item.category || 'Books',
      school: item.school || '',
      price: item.price === 0 ? '0' : String(item.price || ''),
      description: item.description || '',
      subject: item.subject || '',
      classGrade: item.classGrade || '',
      location: item.colony || userProfile?.colony || '',
      size: item.size || '',
      condition: item.condition || '',
      successNote: item.successNote || '',
    });
    setEditMedia(
      existingPhotos.map((url, index) => ({
        id: `existing-${item.id}-${index}`,
        previewUrl: url,
        remoteUrl: url,
        storagePath: existingPhotoPaths[index] || '',
        isLocal: false,
      }))
    );
    setEditCoverIndex(0);
    setEditUploadProgress(0);
  };

  const closeEditModal = () => {
    if (isSavingEdit) return;
    editMediaRef.current.forEach((entry) => {
      if (entry?.previewUrl && entry?.isLocal) URL.revokeObjectURL(entry.previewUrl);
    });
    setEditMedia([]);
    setEditCoverIndex(0);
    setEditUploadProgress(0);
    setEditingItem(null);
    setEditError('');
  };

  const handleEditImageChange = (event) => {
    const selected = Array.from(event.target.files || []).filter((entry) => entry.type.startsWith('image/'));
    if (selected.length === 0) return;

    setEditError('');
    setEditMedia((prev) => {
      const remainingSlots = Math.max(0, MAX_LISTING_PHOTOS - prev.length);
      if (remainingSlots === 0) return prev;
      const accepted = selected.slice(0, remainingSlots).map((entry) => ({
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 9)}`,
        file: entry,
        previewUrl: URL.createObjectURL(entry),
        isLocal: true,
      }));
      return [...prev, ...accepted];
    });
    event.target.value = '';
  };

  const buildListingWritePayload = (listing, overrides = {}) => {
    const nextTitle = String(overrides.title ?? listing?.title ?? 'Listing').trim() || 'Listing';
    const nextDescription =
      String(overrides.description ?? listing?.description ?? listing?.successNote ?? 'Used school book listing on Vidya Share.').trim()
      || 'Used school book listing on Vidya Share.';
    const nextSubject = String(overrides.subject ?? listing?.subject ?? '').trim();
    const nextClassGrade = String(overrides.classGrade ?? listing?.classGrade ?? '').trim();
    const nextCondition = String(overrides.condition ?? listing?.condition ?? 'Good').trim() || 'Good';
    const nextSuccessNote = String(overrides.successNote ?? listing?.successNote ?? '').trim();
    const nextLocation = String(overrides.location ?? listing?.colony ?? userProfile?.colony ?? '').trim();
    const nextPriceValue = Number(overrides.price ?? listing?.price ?? 0);
    const nextPhotoUrls = Array.isArray(overrides.photoUrls)
      ? overrides.photoUrls
      : Array.isArray(listing?.photoUrls) && listing.photoUrls.length > 0
        ? listing.photoUrls
        : listing?.photoUrl
          ? [listing.photoUrl]
          : [];
    const nextPhotoPathsSource = Array.isArray(overrides.photoPaths)
      ? overrides.photoPaths
      : Array.isArray(listing?.photoPaths)
        ? listing.photoPaths
        : [];
    const nextPhotoPaths =
      nextPhotoPathsSource.length === nextPhotoUrls.length
        ? nextPhotoPathsSource
        : nextPhotoUrls.map((_, index) => nextPhotoPathsSource[index] || '');

    return {
      title: nextTitle,
      description: nextDescription,
      school: '',
      price: Number.isNaN(nextPriceValue) ? 0 : Math.max(0, nextPriceValue),
      successNote: nextSuccessNote,
      category: 'Books',
      listingType: String(overrides.listingType ?? listing?.listingType ?? 'single').trim() || 'single',
      subject: nextSubject,
      classGrade: nextClassGrade,
      size: '',
      condition: nextCondition,
      normalizedTitle: normalizeText(nextTitle),
      keywords: extractKeywords(`${nextTitle} ${nextSubject} ${nextClassGrade} ${nextCondition} ${nextDescription} ${nextSuccessNote} ${nextLocation}`),
      colony: nextLocation,
      sellerName: userProfile?.displayName || listing?.sellerName || 'Community Member',
      sellerRole: userProfile?.role || listing?.sellerRole || 'Parent',
      sellerSchool: userProfile?.primarySchool || listing?.sellerSchool || '',
      photoUrl: nextPhotoUrls[0] || '',
      photoUrls: nextPhotoUrls,
      photoPaths: nextPhotoPaths,
      imageCount: nextPhotoUrls.length,
      sellerId: auth.currentUser?.uid || listing?.sellerId || '',
      ownershipConfirmed: true,
      pricingConfirmed: true,
      marketplaceDisclosureConfirmed: true,
      directTransactionModel: 'buyer_seller_direct',
      complianceVersion: CONSENT_VERSION,
      sellerVerificationStatus:
        userProfile?.sellerVerificationStatus
        || (userProfile?.basicSellerVerificationCompleted ? 'basic-self-declared' : listing?.sellerVerificationStatus || 'pending'),
      status: overrides.status ?? listing?.status ?? 'active',
      createdAt: listing?.createdAt,
      updatedAt: serverTimestamp(),
      sellerEmail: deleteField(),
      sellerPhone: deleteField(),
      ...(overrides.reservedForBuyerId !== undefined ? { reservedForBuyerId: overrides.reservedForBuyerId } : {}),
      ...(overrides.reservedForBuyerName !== undefined ? { reservedForBuyerName: overrides.reservedForBuyerName } : {}),
      ...(overrides.soldAt !== undefined ? { soldAt: overrides.soldAt } : {}),
    };
  };

  const removeEditMediaAt = (index) => {
    setEditMedia((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const target = prev[index];
      if (target?.previewUrl && target?.isLocal) URL.revokeObjectURL(target.previewUrl);
      const next = prev.filter((_, idx) => idx !== index);
      if (next.length === 0) {
        setEditCoverIndex(0);
      } else if (editCoverIndex > index) {
        setEditCoverIndex((current) => Math.max(0, current - 1));
      } else if (editCoverIndex >= next.length) {
        setEditCoverIndex(next.length - 1);
      }
      return next;
    });
  };

  const moveEditMedia = (index, direction) => {
    setEditMedia((prev) => {
      const target = index + direction;
      if (index < 0 || target < 0 || index >= prev.length || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      setEditCoverIndex((current) => {
        if (current === index) return target;
        if (current === target) return index;
        return current;
      });
      return next;
    });
  };

  const mapUploadError = (error) => {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('cloudinary image upload is not configured')) {
      return 'Image uploads are not configured yet. Add the Cloudinary environment variables and try again.';
    }
    if (message.includes('upload preset not found')) {
      return 'Cloudinary upload preset "vidya_preset" was not found. Create that unsigned preset in Cloudinary or update the app to use the correct preset name.';
    }
    if (message.includes('unsigned') || message.includes('preset')) {
      return `Cloudinary rejected the upload: ${String(error?.message || 'Check your upload preset settings.')}`;
    }
    if (message.includes('network') || message.includes('failed') || message.includes('timed out')) {
      return 'Upload failed after retries. Please try again with a stable connection.';
    }
    if (message.includes('invalid') || message.includes('format') || message.includes('image')) {
      return 'Only valid image files are allowed.';
    }
    if (error?.message) {
      return `Could not save the updated photos: ${error.message}`;
    }
    return 'Could not save the updated photos right now.';
  };

  const uploadSingleImage = async (imageFile, imageIndex, totalImages) =>
    uploadListingImage({
      sourceFile: imageFile,
      ownerId: auth.currentUser.uid,
      listingId: editingItem?.id || '',
      imageLabel: `listing-edit-${imageIndex + 1}`,
      onProgress: (ratio) => {
        const overallProgress = ((imageIndex + ratio) / totalImages) * 100;
        setEditUploadProgress(overallProgress);
      },
    });

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    if (!editingItem?.id) return;

    const trimmedTitle = editForm.title.trim();
    const trimmedDescription = editForm.description.trim();
    const priceValue = Number(editForm.price || 0);
    const cleanPrice = Number.isNaN(priceValue) ? 0 : Math.max(0, priceValue);

    if (!trimmedTitle) {
      setEditError('Title is required.');
      return;
    }
    if (!trimmedDescription || trimmedDescription.length < 20) {
      setEditError('Add a clear description of at least 20 characters before saving.');
      return;
    }
    if (!editForm.classGrade.trim()) {
      setEditError('Add the class, board, or exam before saving.');
      return;
    }
    if (!editForm.condition.trim()) {
      setEditError('Select the item condition before saving.');
      return;
    }
    if (!editForm.location.trim()) {
      setEditError('Add the Saharanpur pickup area before saving.');
      return;
    }
    if (editMedia.length === 0) {
      setEditError('Please keep at least one product photo on the listing.');
      return;
    }
    const blockedTerms = [
      ...new Set(
        [
          ...findBlockedMarketplaceTerms(trimmedTitle),
          ...findBlockedMarketplaceTerms(trimmedDescription),
          ...findBlockedMarketplaceTerms(editForm.successNote.trim()),
          ...findBlockedMarketplaceTerms(editForm.subject.trim()),
        ].filter(Boolean)
      ),
    ];
    if (blockedTerms.length > 0) {
      setEditError(getBlockedContentMessage('listing'));
      return;
    }
    const suspiciousTerms = [
      ...new Set(
        [
          ...findSuspiciousMarketplaceTerms(trimmedTitle),
          ...findSuspiciousMarketplaceTerms(trimmedDescription),
          ...findSuspiciousMarketplaceTerms(editForm.successNote.trim()),
        ].filter(Boolean)
      ),
    ];
    if (suspiciousTerms.length > 0) {
      setEditError(getSuspiciousContentMessage('listing'));
      return;
    }

    setIsSavingEdit(true);
    setEditError('');
    try {
      const listingRef = doc(db, 'publicListings', editingItem.id);
      const latestListingSnapshot = await getDoc(listingRef);
      if (!latestListingSnapshot.exists()) {
        throw new Error('This listing no longer exists.');
      }
      const latestUpdatedAt = latestListingSnapshot.data()?.updatedAt || null;
      if (timestampToMillis(latestUpdatedAt) !== timestampToMillis(editingItem.updatedAt)) {
        throw new Error('This listing was updated in another tab. Refresh My Listings and try again.');
      }

      const orderedMedia = [...editMedia];
      if (editCoverIndex > 0 && editCoverIndex < orderedMedia.length) {
        const [coverMedia] = orderedMedia.splice(editCoverIndex, 1);
        orderedMedia.unshift(coverMedia);
      }

      const finalPhotoUrls = [];
      const finalPhotoPaths = [];
      const newlyUploadedStoragePaths = [];
      for (let index = 0; index < orderedMedia.length; index += 1) {
        const media = orderedMedia[index];
        if (media.remoteUrl && !media.isLocal) {
          finalPhotoUrls.push(media.remoteUrl);
          finalPhotoPaths.push(media.storagePath || '');
          setEditUploadProgress(((index + 1) / orderedMedia.length) * 100);
          continue;
        }

        const { downloadUrl, storagePath } = await uploadSingleImage(media.file, index, orderedMedia.length);
        finalPhotoUrls.push(downloadUrl);
        finalPhotoPaths.push(storagePath);
        newlyUploadedStoragePaths.push(storagePath);
      }

      const nextListingPayload = buildListingWritePayload(editingItem, {
        title: trimmedTitle,
        price: cleanPrice,
        description: editForm.description.trim(),
        subject: editForm.subject.trim(),
        classGrade: editForm.classGrade.trim(),
        location: editForm.location.trim(),
        condition: editForm.condition.trim(),
        successNote: editForm.successNote.trim(),
        photoUrls: finalPhotoUrls,
        photoPaths: finalPhotoPaths,
      });
      try {
        await runTransaction(db, async (transaction) => {
          const currentSnapshot = await transaction.get(listingRef);
          if (!currentSnapshot.exists()) {
            throw new Error('This listing no longer exists.');
          }
          const currentData = currentSnapshot.data() || {};
          if ((currentData.sellerId || '') !== (auth.currentUser?.uid || '')) {
            throw new Error('You do not have permission to edit this listing.');
          }
          if (timestampToMillis(currentData.updatedAt) !== timestampToMillis(editingItem.updatedAt)) {
            throw new Error('This listing was updated in another tab. Refresh My Listings and try again.');
          }

          transaction.set(
            listingRef,
            buildPublicListingPayload({
              ...nextListingPayload,
              sellerRole: userProfile?.role || nextListingPayload?.sellerRole || 'Parent',
              sellerContactConsent: userProfile?.sellerContactConsent === true,
            }),
            { merge: true }
          );
        });
      } catch (error) {
        await Promise.allSettled(newlyUploadedStoragePaths.filter(Boolean).map((storagePath) => deleteListingImage(storagePath)));
        throw error;
      }
      const removedStoragePaths = (Array.isArray(editingItem.photoPaths) ? editingItem.photoPaths : []).filter(
        (storagePath) => storagePath && !finalPhotoPaths.includes(storagePath)
      );
      await Promise.allSettled(removedStoragePaths.map((storagePath) => deleteListingImage(storagePath)));
      setEditUploadProgress(100);
      setEditingItem(null);
    } catch (error) {
      console.error('Failed to update listing', error);
      setEditError(mapUploadError(error));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleStatusChange = async (id, nextStatus) => {
    try {
      setStatusSavingId(id);
      await updateListingLifecycleStatus({
        db,
        listingId: id,
        sellerId: auth.currentUser?.uid || '',
        nextStatus,
      });
    } catch (error) {
      console.error('Error updating item status:', error);
      alert('Could not update status. Please try again.');
    } finally {
      setStatusSavingId('');
    }
  };

  const handleDealAction = async (deal, action) => {
    if (!deal?.id) return;
    try {
      setDealActionId(deal.id);
      await updateDealRequestState({
        db,
        dealId: deal.id,
        actorUserId: auth.currentUser?.uid || '',
        action,
      });
    } catch (error) {
      console.error('Deal action failed', error);
      alert('Could not update this pickup request.');
    } finally {
      setDealActionId('');
    }
  };

  const getStatusMeta = (status) => {
    if (status === 'sold') return { label: 'Sold', badgeClass: 'bg-rose-300/85 text-[#4a1b25]' };
    if (status === 'reserved') return { label: 'Reserved', badgeClass: 'bg-cyan-200 text-[#082231]' };
    return { label: 'Active', badgeClass: 'bg-emerald-200/90 text-[#153421]' };
  };

  const getDealStatusMeta = (status) => {
    if (status === 'accepted') return { label: 'Accepted', className: 'bg-cyan-200 text-[#082231]' };
    if (status === 'completed') return { label: 'Completed', className: 'bg-emerald-200 text-[#153421]' };
    if (status === 'rejected' || status === 'declined') return { label: 'Rejected', className: 'bg-rose-300/85 text-[#4a1b25]' };
    return { label: 'Pending', className: 'bg-sky-200 text-[#17304a]' };
  };

  const getRequestStatusMeta = (status) => {
    if (status === 'matched') return { label: 'Matched', className: 'bg-cyan-200 text-[#082231]' };
    if (status === 'closed') return { label: 'Closed', className: 'bg-slate-300 text-[#10202b]' };
    return { label: 'Open', className: 'bg-emerald-200/90 text-[#153421]' };
  };

  if (loading) {
    return (
      <div className="flex justify-center p-14">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-100" />
      </div>
    );
  }

  const successfulHandovers = myItems.filter((item) => (item.status || 'active') === 'sold').length;

  return (
    <div className="mx-auto w-full max-w-[1480px] px-3 pb-14 pt-4 sm:px-6">
      <section className="lux-panel mb-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/62">Profile</p>
            <h2 className="font-display mt-2 text-2xl font-semibold text-white sm:text-3xl">
              {userProfile?.displayName || 'Your account'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-cyan-50/72">
              Manage your requests, pickup interest, and live listings from one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-300/18 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-50/65">
              {successfulHandovers} handovers
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="rounded-xl border border-cyan-300/20 bg-[#08111a]/88 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:border-cyan-300/38 hover:bg-[#0b1824] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSigningOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      </section>

      <section className="lux-panel mb-5 p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-display text-xl font-semibold text-white">
            <Sparkles className="h-5 w-5 text-cyan-100" />
            My Requests
          </h3>
          <span className="rounded-full border border-cyan-300/18 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-50/65">
            {myRequests.length} posted
          </span>
        </div>

        {myRequests.length === 0 ? (
          <p className="text-sm text-cyan-50/72">You have not posted any requests yet.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {myRequests.map((request) => {
              const statusMeta = getRequestStatusMeta(request.status || 'open');
              const displayBudget = Number(request.budget || 0) > 0 ? `₹${request.budget}` : 'Budget open';
              const subjectLabel = request.subject || 'General book';

              return (
                <article key={request.id} className="lux-panel-soft rounded-2xl p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h4 className="line-clamp-2 text-base font-semibold text-white">{request.text || 'Request'}</h4>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusMeta.className}`}>{statusMeta.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full border border-cyan-300/24 bg-cyan-300/10 px-2.5 py-1 text-cyan-50/88">Books</span>
                    <span className="rounded-full border border-cyan-300/24 bg-cyan-300/10 px-2.5 py-1 text-cyan-50/88">{request.urgency || 'Anytime'}</span>
                    <span className="rounded-full border border-cyan-300/24 bg-cyan-300/10 px-2.5 py-1 text-cyan-50/88">{subjectLabel}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-cyan-50/72">
                    <span className="font-semibold text-cyan-50/88">{displayBudget}</span>
                    <span>{formatRelativeTime(request.createdAt)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="lux-panel mb-5 p-5 sm:p-6">
        <h3 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold text-white">
          <ShieldCheck className="h-5 w-5 text-cyan-100" />
          Pickup Requests
        </h3>

        {dealRequests.length === 0 ? (
          <p className="text-sm text-cyan-50/72">No pickup requests yet.</p>
        ) : (
          <div className="space-y-3">
            {dealRequests.map((deal) => {
              const statusMeta = getDealStatusMeta(deal.status || 'pending');
              const isBusy = dealActionId === deal.id;

              return (
                <article key={deal.id} className="lux-panel-soft rounded-2xl p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-semibold text-white">{deal.noticeTitle || 'Listing'}</h4>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusMeta.className}`}>{statusMeta.label}</span>
                  </div>

                  <p className="text-xs text-cyan-50/75">
                    Buyer: <span className="font-semibold text-white">{deal.buyerName || 'Community member'}</span>
                  </p>
                  <p className="mt-1 text-xs text-cyan-50/75">
                    Phone: <span className="font-semibold text-white">{deal.buyerPhone || 'Not shared'}</span>
                  </p>
                  {deal.preferredMeetup && (
                    <p className="mt-1 text-xs text-cyan-50/75">
                      Meetup: <span className="font-semibold text-white">{deal.preferredMeetup}</span>
                    </p>
                  )}
                  {deal.preferredTime && (
                    <p className="mt-1 text-xs text-cyan-50/75">
                      Time: <span className="font-semibold text-white">{deal.preferredTime}</span>
                    </p>
                  )}
                  {deal.note && <p className="mt-2 rounded-lg border border-cyan-300/16 bg-[#08111a]/86 px-3 py-2 text-xs text-cyan-50/82">{deal.note}</p>}
                  <p className="mt-2 text-[11px] text-cyan-50/58">{formatRelativeTime(deal.createdAt)}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(deal.status || 'pending') === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDealAction(deal, 'accept')}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 rounded-full border border-cyan-300/28 bg-cyan-300/12 px-3 py-1.5 text-xs font-bold text-cyan-50 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDealAction(deal, 'reject')}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 rounded-full border border-rose-200/35 bg-rose-300/12 px-3 py-1.5 text-xs font-bold text-rose-100 transition hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </>
                    )}
                    {(deal.status || 'pending') === 'accepted' && (
                      <button
                        type="button"
                        onClick={() => handleDealAction(deal, 'complete')}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-200/35 bg-emerald-200/15 px-3 py-1.5 text-xs font-bold text-emerald-100 transition hover:bg-emerald-200/25 disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mark sold
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-xl font-semibold text-white">My Listings</h3>
          <p className="text-xs text-cyan-50/65">Update availability, prices, or add trust notes for buyers.</p>
        </div>
        <span className="rounded-full border border-cyan-300/18 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-50/65">
          {myItems.length} live
        </span>
      </div>

      {myItems.length === 0 ? (
        <div className="lux-panel flex flex-col items-center justify-center p-8">
          <PackageOpen className="mb-3 h-12 w-12 text-cyan-100/65" />
          <p className="text-center text-sm text-cyan-50/78">You have not posted any items yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {myItems.map((item) => {
            const status = item.status || 'active';
            const statusMeta = getStatusMeta(status);
            const isSavingThis = statusSavingId === item.id;
            const displayPrice = item.price === 0 ? 'Free' : item.price ? `₹${item.price}` : 'Price TBD';
            const displayCategory = 'Books';

            return (
              <article key={item.id} className="lux-panel mb-0 flex items-center justify-between rounded-2xl p-4">
                <div className="flex min-w-0 items-center gap-4">
                  <img
                    src={item.photoUrl || 'https://via.placeholder.com/50'}
                    alt="item"
                    className="h-14 w-14 rounded-xl bg-cyan-300/12 object-cover"
                  />
                  <div className="min-w-0">
                    <h3 className="line-clamp-1 font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 text-xs text-cyan-50/68">{displayCategory} | {displayPrice}</p>
                    <p className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusMeta.badgeClass}`}>
                      {statusMeta.label}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(item)}
                    className="inline-flex items-center gap-1 rounded-xl border border-cyan-300/20 bg-[#08111a]/88 px-3 py-2 text-xs font-semibold text-cyan-50 transition hover:border-cyan-300/38 hover:bg-[#0b1824]"
                    aria-label={`Edit ${item.title}`}
                    title="Edit listing"
                  >
                    <PencilLine className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <select
                    value={status}
                    onChange={(event) => handleStatusChange(item.id, event.target.value)}
                    disabled={isSavingThis}
                    className="lux-select rounded-xl px-3 py-2 text-xs font-semibold text-cyan-50 disabled:opacity-60"
                    aria-label={`Update status for ${item.title}`}
                  >
                    <option className="text-slate-800" value="active">
                      Active
                    </option>
                    <option className="text-slate-800" value="reserved">
                      Reserved
                    </option>
                    <option className="text-slate-800" value="sold">
                      Sold
                    </option>
                  </select>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="rounded-xl border border-rose-200/35 bg-transparent p-2.5 text-rose-200 transition hover:bg-rose-300/20"
                    aria-label="Delete item"
                    title="Delete permanently"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/78 p-4 backdrop-blur-md">
          <form onSubmit={handleEditSubmit} className="glass-panel min-h-dvh w-full max-w-[1540px] overflow-y-auto rounded-none p-4 pt-[max(0.95rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:min-h-0 sm:rounded-[2rem] sm:p-6 lg:p-7 xl:p-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={closeEditModal}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-[#08111a]/88 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:border-cyan-300/34 hover:bg-white/[0.08]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <p className="hidden text-xs font-semibold text-cyan-50/54 sm:block">Editing live listing</p>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(420px,0.96fr)_minmax(0,1.04fr)]">
              <section className="space-y-4 2xl:sticky 2xl:top-5 2xl:self-start">
                <div className="lux-panel p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="lux-kicker">Media stage</p>
                      <h3 className="lux-title mt-2 text-xl">Refine the listing visuals</h3>
                    </div>
                    <span className="rounded-full border border-cyan-300/18 bg-[#09111a]/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-50/74">
                      Live editor
                    </span>
                  </div>

                  <label className="group relative block h-[260px] w-full cursor-pointer overflow-hidden rounded-[1.7rem] border border-dashed border-cyan-300/24 bg-[#08111a]/90 transition hover:border-cyan-300/38 hover:bg-[#0a141f] sm:h-[320px] lg:h-[380px] xl:h-[430px] 2xl:h-[500px]">
                    {editMedia.length > 0 ? (
                      <>
                        <img src={editMedia[editCoverIndex]?.previewUrl} alt="Listing preview" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.02]" />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,3,1,0.04),rgba(5,3,1,0.55))]" />
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-cyan-50/82">
                        <div className="mb-4 rounded-[1.4rem] border border-cyan-300/25 bg-black/28 p-4">
                          <Camera className="h-10 w-10 text-cyan-100" />
                        </div>
                        <span className="text-base font-semibold">Tap to add refreshed listing photos</span>
                      <span className="mt-1 text-xs text-cyan-50/58">Up to 2 photos, choose one as cover</span>
                      </div>
                    )}
                    <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-cyan-300/28 bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-50/82">
                      {editMedia.length}/{MAX_LISTING_PHOTOS}
                    </div>
                    <div className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-cyan-300/24 bg-black/48 px-2.5 py-1 text-[10px] font-semibold text-cyan-50/84">
                      First image appears in feed
                    </div>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleEditImageChange} />
                  </label>

                  {editMedia.length > 0 && (
                    <div className="mt-3 flex items-start gap-3 rounded-[1.2rem] border border-cyan-300/14 bg-[#08111a]/78 p-3">
                      <div className="w-[86px] shrink-0 overflow-hidden rounded-[1rem] border border-cyan-300/18 bg-[#09131d]">
                        <div className="aspect-[9/16] w-full overflow-hidden">
                          <img
                            src={editMedia[editCoverIndex]?.previewUrl}
                            alt="Mobile crop preview"
                            className="h-full w-full object-cover object-center"
                          />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/64">Mobile preview</p>
                        <p className="mt-1 text-sm font-semibold text-white">This is the visible crop on phone listings</p>
                        <p className="mt-1 text-xs leading-relaxed text-cyan-50/62">
                          The mobile card uses this portrait frame, so keep the book cover centered.
                        </p>
                      </div>
                    </div>
                  )}

                  {editMedia.length > 0 && (
                    <div className="lux-scroll mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-3 2xl:grid-cols-4">
                      {editMedia.map((media, index) => (
                        <div key={media.id} className="group relative overflow-hidden rounded-xl border border-cyan-300/14 bg-[#08111a]">
                          <img src={media.previewUrl} alt={`Listing ${index + 1}`} className="h-24 w-full object-cover xl:h-28" />
                          <div className="absolute left-1.5 top-1.5">
                            <button
                              type="button"
                              onClick={() => setEditCoverIndex(index)}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold transition ${
                                editCoverIndex === index
                                  ? 'border border-cyan-100/50 bg-cyan-200 text-[#051017]'
                                  : 'border border-cyan-300/24 bg-black/55 text-cyan-50 hover:bg-black/75'
                              }`}
                            >
                              <Star className={`h-3 w-3 ${editCoverIndex === index ? 'fill-current' : ''}`} />
                              {editCoverIndex === index ? 'Cover' : 'Set'}
                            </button>
                          </div>
                          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full border border-cyan-300/20 bg-black/55 px-1.5 py-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                            <button type="button" onClick={() => moveEditMedia(index, -1)} disabled={index === 0} className="rounded-full p-1 text-cyan-50 disabled:opacity-35">
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => moveEditMedia(index, 1)} disabled={index === editMedia.length - 1} className="rounded-full p-1 text-cyan-50 disabled:opacity-35">
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => removeEditMediaAt(index)} className="rounded-full p-1 text-rose-200">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_330px]">
                <div className="space-y-4">
                  <div className="lux-panel p-4 sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3 border-b border-cyan-300/14 pb-3">
                      <div>
                        <p className="lux-kicker">Item details</p>
                        <h3 className="lux-title mt-2 text-xl">Update the listing properly</h3>
                      </div>
                    </div>
                    <div className="mb-4 flex flex-wrap gap-2">
                      <span className="lux-meta-chip">Books</span>
                      <span className="lux-meta-chip">{editForm.price ? `Rs ${editForm.price}` : 'Set pricing'}</span>
                      <span className="lux-meta-chip">{editForm.classGrade || 'Add class / exam'}</span>
                      <span className="lux-meta-chip">{editForm.location || 'Add Saharanpur area'}</span>
                    </div>
                    <div className="grid gap-3.5 sm:grid-cols-2">
                      <input type="text" placeholder="Book name" className="lux-input text-sm font-medium sm:col-span-2" value={editForm.title} onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))} />
                      <textarea rows="4" placeholder="Describe the edition, condition, included books, markings, missing pages, defects, or anything else a buyer must know." className="lux-textarea text-sm font-medium sm:col-span-2" value={editForm.description} onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))} />
                      <input type="number" min="0" placeholder="Price in Rs" className="lux-input text-sm font-medium" value={editForm.price} onChange={(event) => setEditForm((prev) => ({ ...prev, price: event.target.value }))} />
                      <input type="text" placeholder="Subject (e.g., Maths, Physics)" className="lux-input text-sm font-medium" value={editForm.subject} onChange={(event) => setEditForm((prev) => ({ ...prev, subject: event.target.value }))} />
                      <input type="text" placeholder="Class / board / exam (required)" className="lux-input text-sm font-medium" value={editForm.classGrade} onChange={(event) => setEditForm((prev) => ({ ...prev, classGrade: event.target.value }))} />
                      <input type="text" placeholder="Saharanpur pickup area (required)" className="lux-input text-sm font-medium" value={editForm.location} onChange={(event) => setEditForm((prev) => ({ ...prev, location: event.target.value }))} />
                      <select className="lux-select text-sm font-medium sm:col-span-2" value={editForm.condition} onChange={(event) => setEditForm((prev) => ({ ...prev, condition: event.target.value }))}>
                        <option className="text-slate-800" value="">
                          Select condition (required)
                        </option>
                        {LISTING_CONDITION_OPTIONS.map((condition) => (
                          <option key={condition} className="text-slate-800" value={condition}>
                            {condition}
                          </option>
                        ))}
                      </select>
                      <div className="sm:col-span-2">
                        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-50/90">
                          <Sparkles className="h-4 w-4 text-cyan-100" /> Optional handover note
                        </label>
                        <textarea rows="3" placeholder="Any useful pickup or handover note for the buyer" className="lux-textarea text-sm font-medium" value={editForm.successNote} onChange={(event) => setEditForm((prev) => ({ ...prev, successNote: event.target.value }))} />
                      </div>
                    </div>
                  </div>
                </div>

                <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
                  <div className="lux-panel p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="lux-kicker">Save listing</p>
                        <h3 className="lux-title mt-2 text-xl">Push the updated version live</h3>
                      </div>
                      {isSavingEdit && <p className="text-xs font-semibold text-cyan-50/84">Uploading {Math.round(editUploadProgress)}%</p>}
                    </div>
                    {isSavingEdit && (
                      <div className="mb-4 h-2 overflow-hidden rounded-full bg-black/35">
                        <div className="h-full rounded-full bg-[linear-gradient(90deg,#39d0ff,#b7f4ff)] transition-all" style={{ width: `${Math.max(0, Math.min(100, Math.round(editUploadProgress)))}%` }} />
                      </div>
                    )}
                    <div className="lux-panel-soft mb-4 p-4">
                      <p className="text-sm font-semibold text-white">{editForm.title.trim() || 'Your book title will appear here'}</p>
                      <p className="mt-2 text-xs text-cyan-50/72">
                        {Number(editForm.price || 0) === 0 ? 'Free listing' : editForm.price ? `Rs ${editForm.price}` : 'Set a price'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {['Books', editForm.classGrade || 'Add class / exam', editForm.location || 'Add Saharanpur area', editForm.condition || 'Set condition'].map((meta) => (
                          <span key={`edit-publish-${meta}`} className="lux-meta-chip">
                            {meta}
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-cyan-50/66">
                        Buyer-facing summary: {editForm.description.trim() || 'Add a clear description so buyers can evaluate the item before contacting you.'}
                      </p>
                    </div>
                    {editError && (
                      <div className="mb-3 rounded-lg border border-rose-200/45 bg-rose-300/20 px-3 py-3 text-sm font-semibold text-rose-100">
                        {editError}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={closeEditModal} className="flex-1 rounded-xl border border-cyan-300/22 px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/10">
                        Cancel
                      </button>
                      <button type="submit" disabled={isSavingEdit} className="btn-primary inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60">
                        {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <PencilLine className="h-4 w-4" />}
                        {isSavingEdit ? 'Saving changes...' : 'Save changes'}
                      </button>
                    </div>
                  </div>
                </aside>
              </section>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
