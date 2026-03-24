import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Loader2, Sparkles } from 'lucide-react';
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

export default function PostFlow({ userProfile, onSuccess }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [postedItem, setPostedItem] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    school: '',
    price: '',
    successNote: '',
    category: 'Books',
    classGrade: '',
    subject: '',
    size: '',
    condition: '',
  });

  const isUniformCategory = formData.category === 'Uniforms';
  const isBookCategory = formData.category === 'Books';
  const conditionOptions = ['Like New', 'Good', 'Fair', 'Needs Repair'];
  const sellerContactPhone = userProfile?.contactPhone || userProfile?.phone || auth.currentUser?.phoneNumber || '';

  const handleImageChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setSubmitError('');
    }
  };

  const triggerSuccess = () => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#d4af37', '#f3deac', '#b78f32'],
    });
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
    try {
      const scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: { width: 250, height: 150 } }, false);
      scanner.render(
        async (decodedText) => {
          try {
            const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${decodedText}`);
            const data = await response.json();
            if (data.items && data.items[0]?.volumeInfo?.title) {
              setFormData((prev) => ({ ...prev, title: data.items[0].volumeInfo.title }));
              scanner.clear();
            }
          } catch (error) {
            console.log('Scanner lookup failed', error);
          }
        },
        () => {
          // silent scan errors
        }
      );
    } catch (error) {
      console.error('Failed to start scanner', error);
      alert('Unable to access camera/scanner. Please allow camera permission or try a different device.');
    }
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
    if (!file) {
      setSubmitError('Please add a product photo before posting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${auth.currentUser.uid}-${Date.now()}.${fileExt}`;
      const storageRef = ref(storage, `items/${fileName}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Upload failed', error);
          setSubmitError('Upload failed. Please check your internet and try again.');
          setIsSubmitting(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
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
            photoUrl: downloadURL,
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
            img: downloadURL,
            photoUrl: downloadURL,
          });
          await pingMatchingRequesters({
            noticeId: newDoc.id,
            noticeText,
            noticeKeywords,
          });
        }
      );
    } catch (error) {
      console.error('Error posting', error);
      setSubmitError('Could not post your listing. Please retry in a moment.');
      setIsSubmitting(false);
    }
  };

  if (postedItem) {
    return (
      <div className="glass-panel w-full max-w-lg rounded-[1.8rem] p-6">
        <ShareCardGenerator item={postedItem} onDone={onSuccess} />
      </div>
    );
  }

  return (
    <motion.form onSubmit={handleSubmit} className="glass-panel w-full max-w-lg rounded-[1.8rem] p-5 sm:p-6">
      <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200/25 bg-amber-200/10 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-amber-100 uppercase">
        <Sparkles className="h-3.5 w-3.5" />
        Listing Flow
      </p>
      <h2 className="font-display mb-5 text-2xl font-semibold text-amber-50">List an Item</h2>

      <label className="relative mb-5 block h-48 w-full cursor-pointer overflow-hidden rounded-2xl border border-dashed border-amber-200/35 bg-[#151005] transition-colors hover:bg-[#1d1507]">
        {preview ? (
          <img src={preview} alt="Preview" className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-amber-100/75">
            <Camera className="mb-2 h-8 w-8" />
            <span className="text-sm font-semibold">Tap to add product photo</span>
          </div>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
      </label>

      <button
        type="button"
        onClick={startScanner}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200/30 bg-amber-200/10 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-200/15"
      >
        <Camera className="h-4 w-4" /> Scan Book Barcode
      </button>
      <div id="reader" className="mb-4 overflow-hidden rounded-2xl border border-amber-200/20" />

      <input
        type="text"
        placeholder="Item Name (e.g., Class 8 History)"
        className="mb-4 w-full rounded-xl border border-amber-200/20 bg-[#171106] p-4 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
      />
      <input
        type="number"
        min="0"
        placeholder="Price in Rs (use 0 for free)"
        className="mb-4 w-full rounded-xl border border-amber-200/20 bg-[#171106] p-4 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
        value={formData.price}
        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
      />
      <select
        className="mb-4 w-full appearance-none rounded-xl border border-amber-200/20 bg-[#171106] p-4 text-sm font-medium text-amber-50 outline-none focus:border-amber-200/45"
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
        <div className="mb-4 space-y-4">
          <SchoolSearchInput
            id="uniform-school"
            required
            value={formData.school}
            onChange={(nextSchool) => setFormData((prev) => ({ ...prev, school: nextSchool }))}
            schools={SAHARANPUR_SCHOOLS}
            placeholder="Search school for this uniform listing"
            helperText="School tagging is used only for uniforms so buyers can find exact matches quickly."
          />
          <input
            type="text"
            placeholder="Uniform size (e.g., 34, M, Class 7)"
            className="w-full rounded-xl border border-amber-200/20 bg-[#171106] p-4 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
            value={formData.size}
            onChange={(e) => setFormData((prev) => ({ ...prev, size: e.target.value }))}
          />
        </div>
      )}

      {isBookCategory && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Class / Grade (optional)"
            className="w-full rounded-xl border border-amber-200/20 bg-[#171106] p-4 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
            value={formData.classGrade}
            onChange={(e) => setFormData((prev) => ({ ...prev, classGrade: e.target.value }))}
          />
          <input
            type="text"
            placeholder="Subject (optional)"
            className="w-full rounded-xl border border-amber-200/20 bg-[#171106] p-4 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
            value={formData.subject}
            onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
          />
        </div>
      )}

      <select
        className="mb-4 w-full appearance-none rounded-xl border border-amber-200/20 bg-[#171106] p-4 text-sm font-medium text-amber-50 outline-none focus:border-amber-200/45"
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

      <div className="mb-6">
        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-100/90">
          <Sparkles className="h-4 w-4 text-amber-100" /> A tip for the next family? (Optional)
        </label>
        <textarea
          rows="2"
          placeholder="e.g., The teacher loves neat diagrams!"
          className="w-full resize-none rounded-xl border border-amber-200/20 bg-[#171106] p-4 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
          value={formData.successNote}
          onChange={(e) => setFormData({ ...formData, successNote: e.target.value })}
        />
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
          <div className="absolute bottom-0 left-0 top-0 bg-black/20 transition-all" style={{ width: `${uploadProgress}%` }} />
        )}
      </button>
      {submitError && (
        <p className="mt-3 rounded-lg border border-rose-200/45 bg-rose-300/20 px-3 py-2 text-sm font-semibold text-rose-100">{submitError}</p>
      )}
    </motion.form>
  );
}
