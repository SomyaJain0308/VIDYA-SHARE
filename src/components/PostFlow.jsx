import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Loader2, Sparkles, Trash2, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { collection, addDoc, serverTimestamp, getDocs, doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../firebase';
import { Html5QrcodeScanner } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import { sendLocalNotification } from '../utils/notifications';
import ShareCardGenerator from './ShareCardGenerator';
import { normalizeText, extractKeywords, isLikelyMatch } from '../utils/matching';
import SchoolSearchInput from './SchoolSearchInput';
import { SAHARANPUR_SCHOOLS, normalizeSchoolInput } from '../data/schools';

const DEFAULT_FORM_DATA = {
  title: '',
  school: '',
  price: '',
  successNote: '',
  category: 'Books',
  classGrade: '',
  subject: '',
  size: '',
  condition: '',
};

export default function PostFlow({ userProfile, onSuccess }) {
  const UPLOAD_MAX_ATTEMPTS = 2;
  const UPLOAD_IDLE_TIMEOUT_MS = 20000;
  const UPLOAD_TOTAL_TIMEOUT_MS = 150000;
  const [mediaFiles, setMediaFiles] = useState([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [postedItem, setPostedItem] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [formData, setFormData] = useState({ ...DEFAULT_FORM_DATA });

  const isUniformCategory = formData.category === 'Uniforms';
  const isBookCategory = formData.category === 'Books';
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
    if (postedItem) return;
    const autosaveTimer = window.setTimeout(() => {
      try {
        const savedAt = Date.now();
        localStorage.setItem(
          draftStorageKey,
          JSON.stringify({
            savedAt,
            formData: {
              ...formData,
              school: normalizeSchoolInput(formData.school),
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
  }, [draftStorageKey, formData, postedItem]);

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
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#d4af37', '#f3deac', '#b78f32'],
    });
  };

  const shouldRetryUpload = (error) => {
    const code = (error?.code || '').toLowerCase();
    if (!code) return true;
    if (code.includes('unauthorized')) return false;
    if (code.includes('quota-exceeded')) return false;
    if (code.includes('bucket-not-found')) return false;
    if (code.includes('project-not-found')) return false;
    if (code.includes('invalid-checksum')) return false;
    return true;
  };

  const mapUploadError = (error) => {
    const code = error?.code || '';
    if (code.includes('storage/unauthorized')) {
      return 'Storage permission denied. Update Firebase Storage rules to allow signed-in uploads.';
    }
    if (code.includes('storage/quota-exceeded')) {
      return 'Storage quota is full. Free up space or upgrade your Firebase plan.';
    }
    if (code.includes('storage/bucket-not-found') || code.includes('storage/project-not-found')) {
      return 'Storage bucket is not configured. Check your Firebase project and bucket settings.';
    }
    if (code.includes('storage/canceled') && (error?.message || '').includes('stalled')) {
      return 'Upload stalled. Check internet or Firebase Storage CORS/rules and try again.';
    }
    if ((error?.message || '').toLowerCase().includes('timeout')) {
      return 'Upload timed out. Please try again with a stable connection.';
    }
    return 'Upload failed. Please check your internet and Firebase Storage setup, then try again.';
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

  const startScanner = () => {
    if (isScannerVisible) return;
    setIsScannerVisible(true);
    try {
      setTimeout(() => {
        const scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: { width: 250, height: 150 } }, false);
        scanner.render(
          async (decodedText) => {
            try {
              const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${decodedText}`);
              const data = await response.json();
              if (data.items && data.items[0]?.volumeInfo?.title) {
                setFormData((prev) => ({ ...prev, title: data.items[0].volumeInfo.title }));
                scanner.clear();
                setIsScannerVisible(false);
              }
            } catch (error) {
              console.log('Scanner lookup failed', error);
            }
          },
          () => {
            // silent scan errors
          }
        );
      }, 80);
    } catch (error) {
      console.error('Failed to start scanner', error);
      setIsScannerVisible(false);
      alert('Unable to access camera/scanner. Please allow camera permission or try a different device.');
    }
  };

  const runUploadAttempt = (imageFile, imageIndex, totalImages, attempt) =>
    new Promise((resolve, reject) => {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${auth.currentUser.uid}-${Date.now()}-${imageIndex}-a${attempt}.${fileExt}`;
      const storageRef = ref(storage, `items/${fileName}`);
      const uploadTask = uploadBytesResumable(storageRef, imageFile);
      let settled = false;
      let idleTimer;
      let totalTimer;

      const clearTimers = () => {
        if (idleTimer) clearTimeout(idleTimer);
        if (totalTimer) clearTimeout(totalTimer);
      };

      const fail = (error) => {
        if (settled) return;
        settled = true;
        clearTimers();
        reject(error);
      };

      const resetIdleTimer = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          try {
            uploadTask.cancel();
          } catch (cancelError) {
            console.warn('Upload cancel failed after idle timeout', cancelError);
          }
          fail(new Error('Upload stalled for too long.'));
        }, UPLOAD_IDLE_TIMEOUT_MS);
      };

      totalTimer = setTimeout(() => {
        try {
          uploadTask.cancel();
        } catch (cancelError) {
          console.warn('Upload cancel failed after total timeout', cancelError);
        }
        fail(new Error('Upload timeout exceeded.'));
      }, UPLOAD_TOTAL_TIMEOUT_MS);

      resetIdleTimer();

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          resetIdleTimer();
          const singleProgress = snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes : 0;
          const overall = ((imageIndex + singleProgress) / totalImages) * 100;
          setUploadProgress(overall);
        },
        (error) => fail(error),
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            if (settled) return;
            settled = true;
            clearTimers();
            resolve(downloadURL);
          } catch (error) {
            fail(error);
          }
        }
      );
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
    const categoryIsUniform = formData.category === 'Uniforms';

    if (!auth.currentUser) {
      setSubmitError('Please log in first to post an item.');
      return;
    }
    const trimmedTitle = formData.title.trim();
    const normalizedSchool = normalizeSchoolInput(formData.school);
    if (!trimmedTitle || !formData.category || (categoryIsUniform && !normalizedSchool)) {
      setSubmitError('Please complete title and category. School is required for uniform listings.');
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
      const schoolForNotice = categoryIsUniform ? normalizedSchool : '';
      const cleanCondition = formData.condition.trim();
      const cleanClassGrade = formData.classGrade.trim();
      const cleanSubject = formData.subject.trim();
      const cleanSize = formData.size.trim();
      const cleanFormData = {
        title: trimmedTitle,
        school: schoolForNotice,
        price: finalPrice,
        successNote: formData.successNote.trim(),
        category: formData.category,
        condition: cleanCondition,
        classGrade: categoryIsUniform ? '' : cleanClassGrade,
        subject: categoryIsUniform ? '' : cleanSubject,
        size: categoryIsUniform ? cleanSize : '',
      };
      const metadataText = categoryIsUniform
        ? `${cleanFormData.size} ${cleanFormData.condition}`
        : `${cleanFormData.classGrade} ${cleanFormData.subject} ${cleanFormData.condition}`;
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

      setIsSubmitting(false);
      triggerSuccess();
      setPostedItem({
        id: newDoc.id,
        ...cleanFormData,
        img: coverPhotoUrl,
        photoUrl: coverPhotoUrl,
        photoUrls: uploadedUrls,
      });
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
    } catch (error) {
      console.error('Error posting', error);
      setSubmitError(mapUploadError(error));
      setUploadProgress(0);
      setIsSubmitting(false);
    }
  };

  if (postedItem) {
    return (
      <div className="glass-panel w-full max-w-[980px] rounded-[1.8rem] p-6 sm:p-7">
        <ShareCardGenerator item={postedItem} onDone={onSuccess} />
      </div>
    );
  }

  const fieldClass =
    'w-full rounded-xl border border-amber-200/32 bg-[#1a1207]/72 px-4 py-3.5 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/45 transition focus:border-amber-200/58 focus:bg-[#24190b]/86';
  const helperCardClass = 'rounded-2xl border border-amber-200/24 bg-[#140e05]/62 p-4 sm:p-5';
  const draftTimeLabel = draftSavedAt
    ? new Date(draftSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <motion.form onSubmit={handleSubmit} className="glass-panel w-full max-w-[1240px] rounded-[1.9rem] p-5 pt-[max(1rem,env(safe-area-inset-top))] sm:p-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-amber-200/18 pb-4">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-amber-200/25 bg-amber-200/10 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-amber-100 uppercase">
            <Sparkles className="h-3.5 w-3.5" />
            Listing Flow
          </p>
          <h2 className="font-display mt-3 text-2xl font-semibold text-amber-50 sm:text-3xl">Create a trusted listing</h2>
          <p className="mt-1 text-sm text-amber-100/75">Keep it clean, clear, and local so families respond faster.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="rounded-full border border-amber-200/25 bg-[#161006]/80 px-4 py-2 text-xs font-semibold text-amber-100/82">
            {isUniformCategory ? 'Uniform listing mode' : 'Books listing mode'}
          </div>
          <div className="flex items-center gap-2">
            {draftMessage && (
              <p className="text-[11px] font-semibold text-amber-100/70">
                {draftMessage}
                {draftTimeLabel ? ` · ${draftTimeLabel}` : ''}
              </p>
            )}
            <button
              type="button"
              onClick={clearDraft}
              className="rounded-full border border-amber-200/25 px-3 py-1.5 text-[11px] font-semibold text-amber-100/75 transition hover:bg-amber-100/10 hover:text-amber-50"
            >
              Clear draft
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <label className="relative block h-[250px] w-full cursor-pointer overflow-hidden rounded-2xl border border-dashed border-amber-200/40 bg-[#151005]/85 transition-colors hover:bg-[#1d1507] lg:h-[410px]">
            {mediaFiles.length > 0 ? (
              <img src={mediaFiles[coverIndex]?.previewUrl} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-amber-100/80">
                <Camera className="mb-2 h-10 w-10" />
                <span className="text-sm font-semibold">Tap to add product photos</span>
                <span className="mt-1 text-xs text-amber-100/62">Up to 6 photos, cover selectable</span>
              </div>
            )}
            <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-amber-200/35 bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-100">
              {mediaFiles.length}/6
            </div>
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
          </label>

          {mediaFiles.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {mediaFiles.map((media, index) => (
                <div key={media.id} className="group relative overflow-hidden rounded-xl border border-amber-200/22 bg-[#130d05]">
                  <img src={media.previewUrl} alt={`Listing ${index + 1}`} className="h-20 w-full object-cover sm:h-24" />
                  <div className="absolute left-1.5 top-1.5">
                    <button
                      type="button"
                      onClick={() => setCoverIndex(index)}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold transition ${
                        coverIndex === index
                          ? 'border border-amber-100/50 bg-amber-200 text-[#3d2a05]'
                          : 'border border-amber-200/40 bg-black/55 text-amber-100 hover:bg-black/75'
                      }`}
                    >
                      <Star className={`h-3 w-3 ${coverIndex === index ? 'fill-current' : ''}`} />
                      {coverIndex === index ? 'Cover' : 'Set'}
                    </button>
                  </div>
                  <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full border border-amber-200/28 bg-black/55 px-1.5 py-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => moveMedia(index, -1)}
                      disabled={index === 0}
                      className="rounded-full p-1 text-amber-100 disabled:opacity-35"
                      aria-label="Move image left"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveMedia(index, 1)}
                      disabled={index === mediaFiles.length - 1}
                      className="rounded-full p-1 text-amber-100 disabled:opacity-35"
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

          <button
            type="button"
            onClick={startScanner}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200/30 bg-amber-200/12 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-200/18"
          >
            <Camera className="h-4 w-4" /> Scan Book Barcode
          </button>

          {isScannerVisible && <div id="reader" className="overflow-hidden rounded-2xl border border-amber-200/20 bg-[#110c04]" />}

          <div className={helperCardClass}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/72">Quick quality checklist</p>
            <ul className="mt-2 space-y-1.5 text-sm text-amber-100/80">
              <li>Use 3 to 6 clear photos (front, side, condition).</li>
              <li>Mention class/subject for books.</li>
              <li>Keep price realistic for students.</li>
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200/24 bg-[#130d05]/48 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-amber-200/14 pb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/68">Item details</p>
            <p className="text-xs text-amber-100/65">Looks great on desktop and phone</p>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Item Name (e.g., Class 8 History)"
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
            <select
              className={fieldClass}
              value={formData.category}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  category: e.target.value,
                  school: e.target.value === 'Uniforms' ? prev.school : '',
                  classGrade: e.target.value === 'Books' ? prev.classGrade : '',
                  subject: e.target.value === 'Books' ? prev.subject : '',
                  size: e.target.value === 'Uniforms' ? prev.size : '',
                  condition: prev.condition,
                }))
              }
            >
              <option className="text-slate-800" value="">
                Select Category
              </option>
              <option className="text-slate-800" value="Books">
                Books &amp; Notes
              </option>
              <option className="text-slate-800" value="Uniforms">
                Uniforms &amp; Sports
              </option>
            </select>

            {isUniformCategory && (
              <div className="space-y-3.5 sm:col-span-2">
                <SchoolSearchInput
                  id="uniform-school"
                  required
                  value={formData.school}
                  onChange={(nextSchool) => setFormData((prev) => ({ ...prev, school: nextSchool }))}
                  schools={SAHARANPUR_SCHOOLS}
                  placeholder="Search school for this uniform listing"
                  helperText="School tagging is only for uniforms so buyers can match exact school requirements."
                />
                <input
                  type="text"
                  placeholder="Uniform size (e.g., 34, M, Class 7)"
                  className={fieldClass}
                  value={formData.size}
                  onChange={(e) => setFormData((prev) => ({ ...prev, size: e.target.value }))}
                />
              </div>
            )}

            {isBookCategory && (
              <>
                <input
                  type="text"
                  placeholder="Class / Grade (Optional)"
                  className={fieldClass}
                  value={formData.classGrade}
                  onChange={(e) => setFormData((prev) => ({ ...prev, classGrade: e.target.value }))}
                />
                <input
                  type="text"
                  placeholder="Subject (Optional)"
                  className={fieldClass}
                  value={formData.subject}
                  onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                />
              </>
            )}

            <select
              className={`${fieldClass} sm:col-span-2`}
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
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-100/90">
                <Sparkles className="h-4 w-4 text-amber-100" /> A tip for the next family? (Optional)
              </label>
              <textarea
                rows="3"
                placeholder="e.g., Teacher prefers neat diagrams and labeled answers."
                className={`${fieldClass} resize-none`}
                value={formData.successNote}
                onChange={(e) => setFormData({ ...formData, successNote: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      <button
        disabled={isSubmitting}
        type="submit"
        className="btn-primary relative mt-6 w-full overflow-hidden rounded-xl py-3.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? (
          <span className="relative z-10 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Uploading {Math.round(uploadProgress)}%
          </span>
        ) : (
          'Post to Community'
        )}
        {isSubmitting && <div className="absolute bottom-0 left-0 top-0 bg-black/20 transition-all" style={{ width: `${uploadProgress}%` }} />}
      </button>
      {submitError && (
        <p className="mt-3 rounded-lg border border-rose-200/45 bg-rose-300/20 px-3 py-2 text-sm font-semibold text-rose-100">{submitError}</p>
      )}
    </motion.form>
  );
}
