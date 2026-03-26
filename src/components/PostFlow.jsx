import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Camera, Loader2, Trash2, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { collection, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { sendLocalNotification } from '../utils/notifications';
import { normalizeText, extractKeywords, isLikelyMatch } from '../utils/matching';
import { CONSENT_VERSION } from '../config/compliance';
import { trackListingCreated } from '../utils/analytics';
import { deleteListingImage, MAX_LISTING_IMAGE_SIZE_BYTES, uploadListingImage } from '../utils/listingImageStorage';
import { buildPublicListingPayload, LISTING_CONDITION_OPTIONS, LISTING_TYPE_OPTIONS } from '../utils/listings';
import { fetchMatchingRequestCandidates } from '../utils/firestoreMarketplaceQueries';
import {
  findBlockedMarketplaceTerms,
  findSuspiciousMarketplaceTerms,
  getBlockedContentMessage,
  getSuspiciousContentMessage,
  isBasicSellerVerificationComplete,
} from '../utils/marketplaceCompliance';

const DEFAULT_FORM_DATA = {
  title: '',
  description: '',
  school: '',
  price: '',
  successNote: '',
  category: 'Books',
  listingType: 'single',
  subject: '',
  classGrade: '',
  location: '',
  size: '',
  condition: '',
  ownershipConfirmed: false,
  pricingConfirmed: false,
  marketplaceDisclosureConfirmed: false,
};

const MAX_LISTING_PHOTOS = 2;

export default function PostFlow({ userProfile, onSuccess, onClose, onOpenProfileSetup }) {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [fileValidationErrors, setFileValidationErrors] = useState([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [formData, setFormData] = useState({ ...DEFAULT_FORM_DATA });

  const conditionOptions = LISTING_CONDITION_OPTIONS;
  const listingTypeOptions = LISTING_TYPE_OPTIONS;
  const sellerContactPhone = userProfile?.contactPhone || userProfile?.phone || auth.currentUser?.phoneNumber || '';
  const hasBasicSellerVerification = isBasicSellerVerificationComplete({
    ...userProfile,
    phone: userProfile?.phone || auth.currentUser?.phoneNumber || '',
    contactPhone: userProfile?.contactPhone || auth.currentUser?.phoneNumber || '',
    email: userProfile?.email || auth.currentUser?.email || '',
  });
  const mediaFilesRef = useRef([]);
  const currentDraftListingIdRef = useRef('');
  const draftStorageKey = `vidya-share:list-draft:${auth.currentUser?.uid || 'guest'}`;

  useEffect(() => {
    mediaFilesRef.current = mediaFiles;
  }, [mediaFiles]);

  useEffect(() => {
    return () => {
      mediaFilesRef.current.forEach((entry) => {
        if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    try {
      const rawDraft = localStorage.getItem(draftStorageKey);
      if (!rawDraft) return;
      const parsed = JSON.parse(rawDraft);
      if (parsed?.formData && typeof parsed.formData === 'object') {
        setFormData((prev) => ({
          ...prev,
          ...parsed.formData,
        }));
        setDraftMessage('Draft restored');
        setDraftSavedAt(parsed.savedAt || Date.now());
      }
    } catch (error) {
      console.warn('Could not restore listing draft', error);
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (!userProfile?.colony) return;
    setFormData((prev) => (prev.location ? prev : { ...prev, location: userProfile.colony }));
  }, [userProfile?.colony]);

  useEffect(() => {
    const autosaveTimer = window.setTimeout(() => {
      try {
        const savedAt = Date.now();
        localStorage.setItem(
          draftStorageKey,
          JSON.stringify({
            savedAt,
            formData: {
              ...formData,
              category: 'Books',
              listingType: formData.listingType || 'single',
              school: '',
              size: '',
            },
          })
        );
        setDraftSavedAt(savedAt);
        setDraftMessage('Draft auto-saved');
      } catch (error) {
        console.warn('Draft autosave failed', error);
      }
    }, 420);

    return () => window.clearTimeout(autosaveTimer);
  }, [draftStorageKey, formData]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(draftStorageKey);
    } catch (error) {
      console.warn('Draft clear failed', error);
    }
    setFormData({ ...DEFAULT_FORM_DATA });
    setDraftSavedAt(null);
    setDraftMessage('Draft cleared');
  };

  const validateSelectedImages = (files = []) => {
    const acceptedFiles = [];
    const validationErrors = [];

    files.forEach((entry) => {
      if (!entry.type.startsWith('image/')) {
        validationErrors.push(`${entry.name}: only image files are allowed.`);
        return;
      }

      if (entry.size > MAX_LISTING_IMAGE_SIZE_BYTES) {
        validationErrors.push(`${entry.name}: image must be 5MB or smaller.`);
        return;
      }

      acceptedFiles.push(entry);
    });

    return { acceptedFiles, validationErrors };
  };

  const handleImageChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    const { acceptedFiles, validationErrors } = validateSelectedImages(selected);
    if (e.target) e.target.value = '';

    setSubmitError('');
    setFileValidationErrors(validationErrors);
    if (acceptedFiles.length === 0) return;
    setMediaFiles((prev) => {
      const remainingSlots = Math.max(0, MAX_LISTING_PHOTOS - prev.length);
      if (remainingSlots === 0) return prev;
      const accepted = acceptedFiles.slice(0, remainingSlots).map((entry) => ({
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 9)}`,
        file: entry,
        previewUrl: URL.createObjectURL(entry),
      }));
      return [...prev, ...accepted];
    });
  };

  const removeMediaAt = (index) => {
    setMediaFiles((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      const next = prev.filter((_, idx) => idx !== index);
      if (next.length === 0) {
        setCoverIndex(0);
      } else if (coverIndex > index) {
        setCoverIndex((prevCover) => Math.max(0, prevCover - 1));
      } else if (coverIndex >= next.length) {
        setCoverIndex(next.length - 1);
      }
      return next;
    });
  };

  const moveMedia = (index, direction) => {
    setMediaFiles((prev) => {
      const target = index + direction;
      if (index < 0 || target < 0 || index >= prev.length || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      setCoverIndex((prevCover) => {
        if (prevCover === index) return target;
        if (prevCover === target) return index;
        return prevCover;
      });
      return next;
    });
  };

  const triggerSuccess = () => {
    import('canvas-confetti')
      .then(({ default: confetti }) =>
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#39d0ff', '#b7f4ff', '#5be8ff'],
        })
      )
      .catch((error) => {
        console.warn('Confetti load failed', error);
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
      return `Upload failed: ${error.message}`;
    }
    return 'Upload failed. Please check your Cloudinary setup and try again.';
  };

  const pingMatchingRequesters = async ({ noticeText, noticeKeywords }) => {
    try {
      const snapshot = await fetchMatchingRequestCandidates({
        db,
        subject: formData.subject.trim(),
        minimumBudget: Number(formData.price || 0) || 0,
        excludeRequesterId: auth.currentUser?.uid || '',
      });
      let pingCount = 0;

      for (const requestData of snapshot) {
        if (!requestData?.requesterId) continue;

        const requestText = requestData.text || '';
        const requestKeywords = Array.isArray(requestData.keywords) ? requestData.keywords : extractKeywords(requestText);
        const matched = isLikelyMatch(requestText, noticeText, requestKeywords, noticeKeywords);
        if (!matched) continue;
        pingCount += 1;
      }

      if (pingCount > 0) {
        sendLocalNotification('Matching Requests Found', `${pingCount} active request${pingCount > 1 ? 's' : ''} match this listing.`);
      }
    } catch (error) {
      console.error('Failed to ping requesters for listing', error);
    }
  };

  const uploadSingleImage = async (imageFile, imageIndex, totalImages) =>
    uploadListingImage({
      sourceFile: imageFile,
      ownerId: auth.currentUser.uid,
      listingId: currentDraftListingIdRef.current,
      imageLabel: `listing-${imageIndex + 1}`,
      onProgress: (ratio) => {
        const overallProgress = ((imageIndex + ratio) / totalImages) * 100;
        setUploadProgress(overallProgress);
      },
    });

  const cleanupListingArtifacts = async ({ listingId, storagePaths = [] }) => {
    await Promise.allSettled(storagePaths.filter(Boolean).map((path) => deleteListingImage(path)));
    if (listingId) {
      await Promise.allSettled([deleteDoc(doc(db, 'publicListings', listingId))]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setFileValidationErrors([]);

    if (!auth.currentUser) {
      setSubmitError('Please log in first to post an item.');
      return;
    }
    const trimmedTitle = formData.title.trim();
    const trimmedDescription = formData.description.trim();
    const cleanCondition = formData.condition.trim();
    const cleanSubject = formData.subject.trim();
    const cleanClassGrade = formData.classGrade.trim();
    const cleanLocation = formData.location.trim();
    if (!trimmedTitle) {
      setSubmitError('Please add the book title before posting.');
      return;
    }
    if (!trimmedDescription || trimmedDescription.length < 20) {
      setSubmitError('Add a clear description of at least 20 characters covering edition, condition, and what the buyer will receive.');
      return;
    }
    const priceValue = Number(formData.price || 0);
    const finalPrice = Number.isNaN(priceValue) ? null : Math.max(0, priceValue);
    if (finalPrice === null) {
      setSubmitError('Add a valid price. Just type the number and we will add Rs for you.');
      return;
    }
    if (!cleanSubject) {
      setSubmitError('Add the subject before posting.');
      return;
    }
    if (!cleanClassGrade) {
      setSubmitError('Add the class, board, or exam this listing is for.');
      return;
    }
    if (!cleanCondition) {
      setSubmitError('Select the item condition before posting.');
      return;
    }
    if (!sellerContactPhone) {
      setSubmitError('Add a contact number in your profile before posting so buyers can reach you.');
      return;
    }
    if (!hasBasicSellerVerification) {
      setSubmitError('Complete the seller verification fields in your profile before posting a listing.');
      return;
    }
    if (mediaFiles.length === 0) {
      setSubmitError('Please add at least one product photo before posting.');
      return;
    }
    const { validationErrors } = validateSelectedImages(mediaFiles.map((entry) => entry.file));
    if (validationErrors.length > 0) {
      setFileValidationErrors(validationErrors);
      setSubmitError('Fix the image errors before posting.');
      return;
    }
    if (!formData.ownershipConfirmed || !formData.pricingConfirmed || !formData.marketplaceDisclosureConfirmed) {
      setSubmitError('Confirm the listing declarations before publishing.');
      return;
    }
    const blockedTerms = [
      ...new Set(
        [
          ...findBlockedMarketplaceTerms(trimmedTitle),
          ...findBlockedMarketplaceTerms(trimmedDescription),
          ...findBlockedMarketplaceTerms(cleanSubject),
          ...findBlockedMarketplaceTerms(formData.successNote),
        ].filter(Boolean)
      ),
    ];
    if (blockedTerms.length > 0) {
      setSubmitError(getBlockedContentMessage('listing'));
      return;
    }
    const suspiciousTerms = [
      ...new Set(
        [
          ...findSuspiciousMarketplaceTerms(trimmedTitle),
          ...findSuspiciousMarketplaceTerms(trimmedDescription),
          ...findSuspiciousMarketplaceTerms(formData.successNote),
        ].filter(Boolean)
      ),
    ];
    if (suspiciousTerms.length > 0) {
      setSubmitError(getSuspiciousContentMessage('listing'));
      return;
    }

    setUploadProgress(0);
    setIsSubmitting(true);
    try {
      const orderedMedia = [...mediaFiles];
      if (coverIndex > 0 && coverIndex < orderedMedia.length) {
        const [coverMedia] = orderedMedia.splice(coverIndex, 1);
        orderedMedia.unshift(coverMedia);
      }
      const cleanFormData = {
        title: trimmedTitle,
        description: trimmedDescription,
        school: '',
        price: finalPrice,
        successNote: formData.successNote.trim(),
        category: 'Books',
        listingType: formData.listingType === 'set' ? 'set' : 'single',
        condition: cleanCondition,
        subject: cleanSubject,
        classGrade: cleanClassGrade,
        size: '',
      };
      const metadataText = `${cleanFormData.subject} ${cleanFormData.classGrade} ${cleanFormData.condition} ${cleanFormData.description}`;
      const noticeText = `${cleanFormData.title} ${cleanFormData.category} ${cleanFormData.school} ${metadataText}`.trim();
      const noticeKeywords = extractKeywords(noticeText);
      const draftListingPayload = {
        ...cleanFormData,
        normalizedTitle: normalizeText(cleanFormData.title),
        keywords: noticeKeywords,
        colony: cleanLocation,
        sellerName: userProfile?.displayName || 'Community Member',
        sellerRole: userProfile?.role || 'Parent',
        sellerSchool: userProfile?.primarySchool || '',
        sellerId: auth.currentUser.uid,
        ownershipConfirmed: true,
        pricingConfirmed: true,
        marketplaceDisclosureConfirmed: true,
        directTransactionModel: 'buyer_seller_direct',
        complianceVersion: CONSENT_VERSION,
        sellerVerificationStatus: hasBasicSellerVerification ? 'basic-self-declared' : 'pending',
        photoUrl: '',
        photoUrls: [],
        photoPaths: [],
        imageCount: 0,
        status: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const listingRef = doc(collection(db, 'publicListings'));
      const listingId = listingRef.id;
      currentDraftListingIdRef.current = listingId;

      await setDoc(
        listingRef,
        buildPublicListingPayload({
          ...draftListingPayload,
          sellerRole: userProfile?.role || 'Parent',
          sellerContactConsent: userProfile?.sellerContactConsent === true,
        })
      );

      const uploadedUrls = [];
      const uploadedPaths = [];
      try {
        for (let index = 0; index < orderedMedia.length; index += 1) {
          const { downloadUrl, storagePath } = await uploadSingleImage(orderedMedia[index].file, index, orderedMedia.length);
          uploadedUrls.push(downloadUrl);
          uploadedPaths.push(storagePath);
        }
      } catch (uploadError) {
        await cleanupListingArtifacts({ listingId, storagePaths: uploadedPaths });
        currentDraftListingIdRef.current = '';
        throw uploadError;
      }

      setUploadProgress(100);
      const { createdAt: _draftCreatedAt, ...draftListingPayloadWithoutCreatedAt } = draftListingPayload;
      const finalListingPayload = {
        ...draftListingPayloadWithoutCreatedAt,
        photoUrl: uploadedUrls[0] || '',
        photoUrls: uploadedUrls,
        photoPaths: uploadedPaths,
        imageCount: uploadedUrls.length,
        status: 'active',
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(
          listingRef,
          buildPublicListingPayload({
            ...finalListingPayload,
            sellerRole: userProfile?.role || 'Parent',
            sellerContactConsent: userProfile?.sellerContactConsent === true,
            createdAt: undefined,
            updatedAt: serverTimestamp(),
          }),
          { merge: true }
        );
      } catch (finalizeError) {
        await cleanupListingArtifacts({ listingId, storagePaths: uploadedPaths });
        currentDraftListingIdRef.current = '';
        throw finalizeError;
      }
      trackListingCreated({
        listing: {
          id: listingId,
          ...finalListingPayload,
        },
      });

      triggerSuccess();
      try {
        localStorage.removeItem(draftStorageKey);
      } catch (error) {
        console.warn('Could not clear draft after post', error);
      }
      setDraftSavedAt(null);
      setDraftMessage('');
      await pingMatchingRequesters({
        noticeText,
        noticeKeywords,
      });
      currentDraftListingIdRef.current = '';
      setIsSubmitting(false);
      onSuccess?.(listingId);
    } catch (error) {
      console.error('Error posting', error);
      setSubmitError(mapUploadError(error));
      setUploadProgress(0);
      currentDraftListingIdRef.current = '';
      setIsSubmitting(false);
    }
  };

  const fieldClass = 'lux-input text-sm font-medium';
  const selectClass = 'lux-select text-sm font-medium';
  const textareaClass = 'lux-textarea text-sm font-medium';
  const panelClass = 'lux-panel p-4 sm:p-5';
  const progressWidth = `${Math.max(0, Math.min(100, Math.round(uploadProgress)))}%`;

  return (
      <motion.form
        onSubmit={handleSubmit}
        className="glass-panel min-h-dvh w-full max-w-[860px] rounded-none p-4 pt-[max(0.95rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:min-h-0 sm:rounded-[2rem] sm:p-6 lg:p-7"
      >
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-[#08111a]/88 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:border-cyan-300/34 hover:bg-white/[0.08]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <p className="hidden text-xs font-semibold text-cyan-50/54 sm:block">Press Esc to go back</p>
      </div>

      <div className="mx-auto flex max-w-[760px] flex-col gap-5">
        <section className="order-2 space-y-4">
          <div className={panelClass}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/62">Step 2</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Photos</h3>
              </div>
              <span className="rounded-full border border-cyan-300/18 bg-[#09111a]/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-50/74">
                Optional
              </span>
            </div>
            <p className="mb-3 text-sm text-cyan-50/64">
              Clear screenshots of the exact book can work too, as long as they match what you are actually selling.
            </p>
            <label className="group relative block h-[200px] w-full cursor-pointer overflow-hidden rounded-[1.4rem] border border-dashed border-cyan-300/24 bg-[#08111a]/90 transition hover:border-cyan-300/38 hover:bg-[#0a141f] sm:h-[240px]">
              {mediaFiles.length > 0 ? (
                <>
                  <img
                    src={mediaFiles[coverIndex]?.previewUrl}
                    alt="Preview"
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,3,1,0.04),rgba(5,3,1,0.55))]" />
                </>
              ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-cyan-50/82">
                  <div className="mb-4 rounded-[1.4rem] border border-cyan-300/25 bg-black/28 p-4">
                    <Camera className="h-10 w-10 text-cyan-100" />
                  </div>
                  <span className="text-base font-semibold">Add photos</span>
                    <span className="mt-1 text-xs text-cyan-50/58">Up to 2 photos. First photo shows in the feed.</span>
                </div>
              )}
              <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-cyan-300/28 bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-50/82">
                    {mediaFiles.length}/{MAX_LISTING_PHOTOS}
              </div>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
            </label>

          {fileValidationErrors.length > 0 && (
            <div className="mt-3 rounded-[1.2rem] border border-rose-200/45 bg-rose-300/20 px-3 py-3 text-sm font-semibold text-rose-100">
              {fileValidationErrors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          )}

          {mediaFiles.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {mediaFiles.map((media, index) => (
                <div key={media.id} className="group relative overflow-hidden rounded-xl border border-cyan-300/14 bg-[#08111a]">
                  <img src={media.previewUrl} alt={`Listing ${index + 1}`} className="h-24 w-full object-cover" />
                  <div className="absolute left-1.5 top-1.5">
                    <button
                      type="button"
                      onClick={() => setCoverIndex(index)}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold transition ${
                        coverIndex === index
                          ? 'border border-cyan-100/50 bg-cyan-200 text-[#051017]'
                          : 'border border-cyan-300/24 bg-black/55 text-cyan-50 hover:bg-black/75'
                      }`}
                    >
                      <Star className={`h-3 w-3 ${coverIndex === index ? 'fill-current' : ''}`} />
                      {coverIndex === index ? 'Cover' : 'Set'}
                    </button>
                  </div>
                  <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full border border-cyan-300/20 bg-black/55 px-1.5 py-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => moveMedia(index, -1)}
                      disabled={index === 0}
                      className="rounded-full p-1 text-cyan-50 disabled:opacity-35"
                      aria-label="Move image left"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveMedia(index, 1)}
                      disabled={index === mediaFiles.length - 1}
                      className="rounded-full p-1 text-cyan-50 disabled:opacity-35"
                      aria-label="Move image right"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeMediaAt(index)}
                      className="rounded-full p-1 text-rose-200"
                      aria-label="Remove image"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          </div>
        </section>

        <section className="order-1 space-y-4">
            <div className="lux-panel p-4 sm:p-5">
              <div className="mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/62">Step 1</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Details</h3>
              </div>
              <div className="mb-4 rounded-[1.2rem] border border-cyan-300/14 bg-[#08111a]/72 p-4">
                <p className="mb-3 text-sm font-semibold text-white">What are you selling?</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {listingTypeOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-[1rem] border px-4 py-3 text-left text-sm font-semibold transition ${
                        formData.listingType === option.value
                          ? 'border-cyan-300/40 bg-cyan-300/[0.14] text-white'
                          : 'border-cyan-300/18 bg-[#08111a]/88 text-cyan-50/78 hover:bg-[#0a141f]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="listingType"
                        className="h-4 w-4 accent-cyan-300"
                        checked={formData.listingType === option.value}
                        onChange={() => setFormData((prev) => ({ ...prev, listingType: option.value }))}
                      />
                      <span>{option.value === 'single' ? 'Single Book' : 'Book Set'}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <input
                  name="listing_title"
                  type="text"
                  placeholder={formData.listingType === 'set' ? 'Set title (e.g., Class 12 PCM Full Set)' : 'Book name (e.g., RD Sharma Maths Guide)'}
                  className={`${fieldClass} sm:col-span-2`}
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
                <textarea
                  name="listing_description"
                  rows="4"
                  placeholder={formData.listingType === 'set'
                    ? 'List the books included, mention the edition like 2024-25, and add condition or defects if buyers should know.'
                    : 'Mention the edition like 2024-25, plus condition, markings, missing pages, defects, or anything buyers should know.'}
                  className={`${textareaClass} sm:col-span-2`}
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                />
                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-cyan-50/55">Price</span>
                  <div className="overflow-hidden rounded-[1.1rem] border border-cyan-300/18 bg-[#08111a]/90 focus-within:border-cyan-300/34 focus-within:bg-[#0a141f]">
                    <input
                      name="listing_price"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Just type 250"
                      className="w-full border-0 bg-transparent px-4 py-3.5 text-sm font-medium text-white outline-none placeholder:text-cyan-50/42"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value.replace(/\D/g, '') })}
                    />
                  </div>
                  <span className="mt-2 block text-xs text-cyan-50/58">Do not add the rupee sign. We add it automatically.</span>
                </label>
                <input
                  name="listing_subject"
                  type="text"
                  placeholder="Subject (required)"
                  className={fieldClass}
                  value={formData.subject}
                  onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                />
                <input
                  name="listing_location"
                  type="text"
                  placeholder="Pickup area in Saharanpur (optional for now)"
                  className={fieldClass}
                  value={formData.location}
                  onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                />
                <input
                  name="listing_class_grade"
                  type="text"
                  placeholder="Class / board / exam (required)"
                  className={`${fieldClass} sm:col-span-2`}
                  value={formData.classGrade}
                  onChange={(e) => setFormData((prev) => ({ ...prev, classGrade: e.target.value }))}
                />

                <select
                  name="listing_condition"
                  className={`${selectClass} sm:col-span-2`}
                  value={formData.condition}
                  onChange={(e) => setFormData((prev) => ({ ...prev, condition: e.target.value }))}
                >
                  <option className="text-slate-800" value="">
                    Select condition (required)
                  </option>
                  {conditionOptions.map((condition) => (
                    <option key={condition} className="text-slate-800" value={condition}>
                      {condition}
                    </option>
                  ))}
                </select>

                <div className="sm:col-span-2">
                  <textarea
                    name="listing_success_note"
                    rows="3"
                    placeholder="Optional note for pickup or handover"
                    className={textareaClass}
                    value={formData.successNote}
                    onChange={(e) => setFormData({ ...formData, successNote: e.target.value })}
                  />
                </div>

                <div className="sm:col-span-2 space-y-3 rounded-[1.2rem] border border-cyan-300/14 bg-[#08111a]/80 p-4 text-sm text-cyan-50/80">
                  <label className="flex items-start gap-3">
                    <input
                      name="ownership_confirmed"
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-cyan-300"
                      checked={formData.ownershipConfirmed}
                      onChange={(e) => setFormData((prev) => ({ ...prev, ownershipConfirmed: e.target.checked }))}
                    />
                    <span>I confirm I own this item or I am authorized to list it.</span>
                  </label>
                  <label className="flex items-start gap-3">
                    <input
                      name="pricing_confirmed"
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-cyan-300"
                      checked={formData.pricingConfirmed}
                      onChange={(e) => setFormData((prev) => ({ ...prev, pricingConfirmed: e.target.checked }))}
                    />
                    <span>I confirm the pricing and product information are accurate and not misleading.</span>
                  </label>
                  <label className="flex items-start gap-3">
                    <input
                      name="marketplace_disclosure_confirmed"
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-cyan-300"
                      checked={formData.marketplaceDisclosureConfirmed}
                      onChange={(e) => setFormData((prev) => ({ ...prev, marketplaceDisclosureConfirmed: e.target.checked }))}
                    />
                    <span>I understand Vidya Share is only a marketplace platform and that payment, handover, returns, and product quality remain between buyer and seller.</span>
                  </label>
                </div>
              </div>
            </div>

        </section>

        <section className="order-3 space-y-4">
          <div className="lux-panel sticky bottom-3 z-10 border border-cyan-200/18 bg-[#07111a]/95 p-4 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.9)] backdrop-blur sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/62">Step 3</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Publish</h3>
              </div>
              {isSubmitting && (
                <p className="text-xs font-semibold text-cyan-50/84">Uploading {Math.round(uploadProgress)}%</p>
              )}
            </div>
            {isSubmitting && (
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-black/35">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#39d0ff,#b7f4ff)] transition-all"
                  style={{ width: progressWidth }}
                />
              </div>
            )}
            <p className="mb-4 text-sm text-cyan-50/70">
              {formData.title.trim() || 'Your listing'} {formData.price ? `for Rs ${formData.price}` : ''} will go live to the community.
            </p>
            <button
              disabled={isSubmitting}
              type="submit"
              className="btn-primary relative w-full overflow-hidden rounded-xl py-3.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading {Math.round(uploadProgress)}%
                </span>
              ) : (
                'Post to Community'
              )}
              {isSubmitting && (
                <div className="absolute bottom-0 left-0 top-0 bg-black/20 transition-all" style={{ width: progressWidth }} />
              )}
            </button>
            {submitError && (
              <div className="mt-3 space-y-3 rounded-lg border border-rose-200/45 bg-rose-300/20 px-3 py-3 text-sm font-semibold text-rose-100">
                <p>{submitError}</p>
                {(!sellerContactPhone || !hasBasicSellerVerification) && (
                  <button
                    type="button"
                    onClick={onOpenProfileSetup}
                    className="inline-flex items-center justify-center rounded-full border border-cyan-300/18 bg-[#08111a]/90 px-3.5 py-2 text-xs font-semibold text-cyan-50 transition hover:border-cyan-300/34 hover:bg-white/[0.08]"
                  >
                    Open profile setup
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
      </motion.form>
  );
}
