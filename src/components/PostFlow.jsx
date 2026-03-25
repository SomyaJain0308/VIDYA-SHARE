import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Camera, Loader2, Sparkles, Trash2, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { collection, addDoc, serverTimestamp, getDocs, doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { sendLocalNotification } from '../utils/notifications';
import { normalizeText, extractKeywords, isLikelyMatch } from '../utils/matching';

const DEFAULT_FORM_DATA = {
  title: '',
  school: '',
  price: '',
  successNote: '',
  category: 'Books',
  subject: '',
  size: '',
  condition: '',
};

export default function PostFlow({ userProfile, onSuccess, onClose, onOpenProfileSetup }) {
  const UPLOAD_MAX_ATTEMPTS = 2;
  const UPLOAD_TOTAL_TIMEOUT_MS = 150000;
  const CLOUDINARY_CLOUD_NAME = 'dj2feiwwh';
  const CLOUDINARY_UPLOAD_PRESET = 'vidya_preset';
  const [mediaFiles, setMediaFiles] = useState([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [formData, setFormData] = useState({ ...DEFAULT_FORM_DATA });

  const conditionOptions = ['Like New', 'Good', 'Fair', 'Needs Repair'];
  const sellerContactPhone = userProfile?.contactPhone || userProfile?.phone || auth.currentUser?.phoneNumber || '';
  const mediaFilesRef = useRef([]);
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

  const handleImageChange = (e) => {
    const selected = Array.from(e.target.files || []).filter((entry) => entry.type.startsWith('image/'));
    if (selected.length === 0) return;

    setSubmitError('');
    setMediaFiles((prev) => {
      const remainingSlots = Math.max(0, 6 - prev.length);
      if (remainingSlots === 0) return prev;
      const accepted = selected.slice(0, remainingSlots).map((entry) => ({
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

  const shouldRetryUpload = (error) => {
    const code = (error?.code || '').toLowerCase();
    if (!code) return true;
    if (code.includes('400')) return false;
    if (code.includes('401')) return false;
    if (code.includes('403')) return false;
    return true;
  };

  const mapUploadError = (error) => {
    const code = String(error?.code || '');
    if (code.includes('401') || code.includes('403')) {
      return 'Cloudinary upload was denied. Check the upload preset and cloud name.';
    }
    if (code.includes('400')) {
      return 'Cloudinary rejected the image. Check the preset settings and file type.';
    }
    if ((error?.message || '').toLowerCase().includes('timeout') || code.includes('timeout')) {
      return 'Upload timed out. Please try again with a stable connection.';
    }
    return 'Upload failed. Please check your internet or Cloudinary setup, then try again.';
  };

  const pingMatchingRequesters = async ({ noticeId, noticeText, noticeKeywords }) => {
    try {
      const snapshot = await getDocs(collection(db, 'requests'));
      let pingCount = 0;

      for (const requestDoc of snapshot.docs) {
        const requestData = requestDoc.data();
        if (!requestData?.requesterId) continue;

        const requestText = requestData.text || '';
        const requestKeywords = Array.isArray(requestData.keywords) ? requestData.keywords : extractKeywords(requestText);
        const matched = isLikelyMatch(requestText, noticeText, requestKeywords, noticeKeywords);
        if (!matched) continue;

        const alertId = `notice_${noticeId}_requester_${requestData.requesterId}`;
        await setDoc(doc(db, 'alerts', alertId), {
          type: 'notice_match',
          recipientId: requestData.requesterId,
          recipientPhone: requestData.requesterPhone || '',
          requestId: requestDoc.id,
          noticeId,
          title: 'Wishlist Update',
          body: `A new listing may match your request: "${requestText}".`,
          read: false,
          createdAt: serverTimestamp(),
        });
        pingCount += 1;
      }

      if (pingCount > 0) {
        sendLocalNotification('Buyers Notified', `We pinged ${pingCount} matching requester${pingCount > 1 ? 's' : ''}.`);
      }
    } catch (error) {
      console.error('Failed to ping requesters for listing', error);
    }
  };

  const runUploadAttempt = (imageFile, imageIndex, totalImages, attempt) =>
    new Promise((resolve, reject) => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, UPLOAD_TOTAL_TIMEOUT_MS);

      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      formData.append('folder', 'vidya-share/books');
      formData.append('public_id', `${auth.currentUser.uid}-${Date.now()}-${imageIndex}-a${attempt}`);

      const baseProgress = (imageIndex / totalImages) * 100;
      const inFlightProgress = ((imageIndex + 0.7) / totalImages) * 100;
      setUploadProgress(baseProgress);

      fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload?.secure_url) {
            const error = new Error(payload?.error?.message || 'Cloudinary upload failed.');
            error.code = String(response.status || '');
            throw error;
          }
          setUploadProgress(inFlightProgress);
          resolve(payload.secure_url);
        })
        .catch((error) => {
          if (error?.name === 'AbortError') {
            const timeoutError = new Error('Upload timeout exceeded.');
            timeoutError.code = 'timeout';
            reject(timeoutError);
            return;
          }
          reject(error);
        })
        .finally(() => {
          window.clearTimeout(timeoutId);
        });
    });

  const uploadSingleImage = async (imageFile, imageIndex, totalImages) => {
    let lastError;
    for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt += 1) {
      try {
        return await runUploadAttempt(imageFile, imageIndex, totalImages, attempt);
      } catch (error) {
        lastError = error;
        if (attempt >= UPLOAD_MAX_ATTEMPTS || !shouldRetryUpload(error)) {
          throw error;
        }
      }
    }
    throw lastError || new Error('Upload failed.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!auth.currentUser) {
      setSubmitError('Please log in first to post an item.');
      return;
    }
    const trimmedTitle = formData.title.trim();
    if (!trimmedTitle) {
      setSubmitError('Please add the book title before posting.');
      return;
    }
    if (!sellerContactPhone) {
      setSubmitError('Add a contact number in your profile before posting so buyers can reach you.');
      return;
    }
    if (mediaFiles.length === 0) {
      setSubmitError('Please add at least one product photo before posting.');
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

      const uploadedUrls = [];
      for (let index = 0; index < orderedMedia.length; index += 1) {
        const imageUrl = await uploadSingleImage(orderedMedia[index].file, index, orderedMedia.length);
        uploadedUrls.push(imageUrl);
      }

      setUploadProgress(100);
      const coverPhotoUrl = uploadedUrls[0] || '';
      const priceValue = Number(formData.price || 0);
      const finalPrice = Number.isNaN(priceValue) ? 0 : priceValue;
      const cleanCondition = formData.condition.trim();
      const cleanSubject = formData.subject.trim();
      const cleanFormData = {
        title: trimmedTitle,
        school: '',
        price: finalPrice,
        successNote: formData.successNote.trim(),
        category: 'Books',
        condition: cleanCondition,
        subject: cleanSubject,
        size: '',
      };
      const metadataText = `${cleanFormData.subject} ${cleanFormData.condition}`;
      const noticeText = `${cleanFormData.title} ${cleanFormData.category} ${cleanFormData.school} ${metadataText}`.trim();
      const noticeKeywords = extractKeywords(noticeText);

      const newDoc = await addDoc(collection(db, 'notices'), {
        ...cleanFormData,
        normalizedTitle: normalizeText(cleanFormData.title),
        keywords: noticeKeywords,
        colony: userProfile?.colony || '',
        sellerName: userProfile?.displayName || 'Community Member',
        sellerSchool: userProfile?.primarySchool || '',
        photoUrl: coverPhotoUrl,
        photoUrls: uploadedUrls,
        imageCount: uploadedUrls.length,
        sellerId: auth.currentUser.uid,
        sellerPhone: sellerContactPhone,
        status: 'active',
        createdAt: serverTimestamp(),
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
        noticeId: newDoc.id,
        noticeText,
        noticeKeywords,
      });
      setIsSubmitting(false);
      onSuccess();
    } catch (error) {
      console.error('Error posting', error);
      setSubmitError(mapUploadError(error));
      setUploadProgress(0);
      setIsSubmitting(false);
    }
  };

  const fieldClass = 'lux-input text-sm font-medium';
  const selectClass = 'lux-select text-sm font-medium';
  const textareaClass = 'lux-textarea text-sm font-medium';
  const panelClass = 'lux-panel p-4 sm:p-5';
  const progressWidth = `${Math.max(0, Math.min(100, Math.round(uploadProgress)))}%`;
  const draftTimeLabel = draftSavedAt
    ? new Date(draftSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="glass-panel min-h-dvh w-full max-w-[1540px] overflow-y-auto rounded-none p-4 pt-[max(0.95rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:min-h-0 sm:rounded-[2rem] sm:p-6 lg:p-7 xl:p-8"
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

      <div className="grid gap-5 xl:grid-cols-[minmax(420px,0.96fr)_minmax(0,1.04fr)]">
        <section className="space-y-4 2xl:sticky 2xl:top-5 2xl:self-start">
          <div className={panelClass}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="lux-kicker">Media stage</p>
                <h3 className="lux-title mt-2 text-xl">Make the item feel premium</h3>
              </div>
              <span className="rounded-full border border-cyan-300/18 bg-[#09111a]/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-50/74">
                Cover ready
              </span>
            </div>
            <label className="group relative block h-[260px] w-full cursor-pointer overflow-hidden rounded-[1.7rem] border border-dashed border-cyan-300/24 bg-[#08111a]/90 transition hover:border-cyan-300/38 hover:bg-[#0a141f] sm:h-[320px] lg:h-[380px] xl:h-[430px] 2xl:h-[500px]">
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
                  <span className="text-base font-semibold">Tap to add listing photos</span>
                  <span className="mt-1 text-xs text-cyan-50/58">Up to 6 photos, choose one as cover</span>
                  <div className="mt-5 max-w-xs rounded-[1.1rem] border border-cyan-300/14 bg-black/22 px-4 py-3 text-center text-[11px] font-medium leading-relaxed text-cyan-50/66">
                    Front view, spine, close-up condition, and one real-life context shot usually performs best.
                  </div>
                </div>
              )}
              <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-cyan-300/28 bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-50/82">
                {mediaFiles.length}/6
              </div>
              <div className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-cyan-300/24 bg-black/48 px-2.5 py-1 text-[10px] font-semibold text-cyan-50/84">
                First image appears in feed
              </div>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
            </label>

          {mediaFiles.length > 0 && (
            <div className="lux-scroll grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-3 2xl:grid-cols-4">
              {mediaFiles.map((media, index) => (
                <div key={media.id} className="group relative overflow-hidden rounded-xl border border-cyan-300/14 bg-[#08111a]">
                  <img src={media.previewUrl} alt={`Listing ${index + 1}`} className="h-24 w-full object-cover xl:h-28" />
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

          <div className={`${panelClass} mt-4`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/70">Quality checklist</p>
            <ul className="mt-2 space-y-1.5 text-sm text-cyan-50/82">
              <li>Use 3-6 clear photos showing real condition.</li>
              <li>Keep title specific so buyers find it quickly.</li>
              <li>Set practical pricing so the offer feels fair and easy to trust.</li>
            </ul>
          </div>
          </div>
        </section>

        <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-4">
            <div className="lux-panel p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-cyan-300/14 pb-3">
                <div>
                  <p className="lux-kicker">Item details</p>
                  <h3 className="lux-title mt-2 text-xl">What are you listing?</h3>
                </div>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="lux-meta-chip">Books</span>
                <span className="lux-meta-chip">{formData.price ? `Rs ${formData.price}` : 'Set pricing'}</span>
                <span className="lux-meta-chip">{formData.subject || 'General discovery'}</span>
              </div>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="Book name (e.g., RD Sharma Maths Guide)"
                  className={`${fieldClass} sm:col-span-2`}
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Price in Rs (0 for free)"
                  className={fieldClass}
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Subject or exam detail (optional)"
                  className={fieldClass}
                  value={formData.subject}
                  onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                />

                <select
                  className={`${selectClass} sm:col-span-2`}
                  value={formData.condition}
                  onChange={(e) => setFormData((prev) => ({ ...prev, condition: e.target.value }))}
                >
                  <option className="text-slate-800" value="">
                    Select condition (optional)
                  </option>
                  {conditionOptions.map((condition) => (
                    <option key={condition} className="text-slate-800" value={condition}>
                      {condition}
                    </option>
                  ))}
                </select>

                <div className="sm:col-span-2">
                  <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-50/90">
                    <Sparkles className="h-4 w-4 text-cyan-100" /> A tip for the next family? (Optional)
                  </label>
                  <textarea
                    rows="3"
                    placeholder="e.g., Teacher prefers neat diagrams and labeled answers."
                    className={textareaClass}
                    value={formData.successNote}
                    onChange={(e) => setFormData({ ...formData, successNote: e.target.value })}
                  />
                </div>
              </div>
            </div>

          <div className="lux-panel p-4 sm:p-5">
            <p className="lux-kicker">Seller trust</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="lux-stat-tile">
                <p className="lux-kicker">Contact</p>
                <strong className="!text-[1.15rem]">{sellerContactPhone ? 'Ready' : 'Missing'}</strong>
                <p className="mt-2 text-xs text-cyan-50/66">Buyers can only connect if your contact profile is complete.</p>
                {!sellerContactPhone && (
                  <button
                    type="button"
                    onClick={onOpenProfileSetup}
                    className="mt-3 inline-flex items-center justify-center rounded-full border border-cyan-300/18 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-300/16"
                  >
                    Add mobile number
                  </button>
                )}
              </div>
              <div className="lux-stat-tile">
                <p className="lux-kicker">Photos</p>
                <strong className="!text-[1.15rem]">{mediaFiles.length}</strong>
                <p className="mt-2 text-xs text-cyan-50/66">Clear product photos make listings feel dramatically more trustworthy.</p>
              </div>
              <div className="lux-stat-tile">
                <p className="lux-kicker">Reach</p>
                <strong className="!text-[1.15rem]">City-wide</strong>
                <p className="mt-2 text-xs text-cyan-50/66">Strong titles and photos matter more than extra form fields here.</p>
              </div>
            </div>
          </div>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
            <div className="lux-panel p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="lux-kicker">Publish listing</p>
                  <h3 className="lux-title mt-2 text-xl">Ready to go live</h3>
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
              <div className="lux-panel-soft mb-4 p-4">
                <p className="text-sm font-semibold text-white">{formData.title.trim() || 'Your book title will appear here'}</p>
                <p className="mt-2 text-xs text-cyan-50/72">
                  {Number(formData.price || 0) === 0 ? 'Free listing' : formData.price ? `Rs ${formData.price}` : 'Set a price'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['Books', formData.subject || 'General discovery', formData.condition || 'Set condition'].map((meta) => (
                    <span key={`publish-${meta}`} className="lux-meta-chip">
                      {meta}
                    </span>
                  ))}
                </div>
              </div>
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
                  {!sellerContactPhone && (
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
            <div className="hidden lux-panel-soft p-4 text-sm text-cyan-50/76 sm:block">
              <p>Use your clearest photo as cover.</p>
              <p className="mt-2">Keep the item name precise and recognizable.</p>
              <p className="mt-2">This posting flow is focused only on books.</p>
            </div>
          </aside>
        </section>
      </div>
    </motion.form>
  );
}
