import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Sparkles, Loader2, X } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import SchoolSearchInput from './SchoolSearchInput';
import { SAHARANPUR_SCHOOLS, normalizeSchoolInput } from '../data/schools';

export default function ProfileSetup({ onComplete, onClose, initialProfile = {} }) {
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [colony, setColony] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [classFocus, setClassFocus] = useState('');
  const [preferredMeetup, setPreferredMeetup] = useState('');
  const [availability, setAvailability] = useState('');
  const [bio, setBio] = useState('');
  const [showPhoneOnProfile, setShowPhoneOnProfile] = useState(false);
  const [publicProfile, setPublicProfile] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    setName(initialProfile?.displayName || '');
    setSchool(initialProfile?.primarySchool || '');
    setColony(initialProfile?.colony || '');
    setContactPhone((initialProfile?.contactPhone || initialProfile?.phone || auth.currentUser?.phoneNumber || '').replace(/\D/g, '').slice(-10));
    setClassFocus(initialProfile?.classFocus || '');
    setPreferredMeetup(initialProfile?.preferredMeetup || '');
    setAvailability(initialProfile?.availability || '');
    setBio(initialProfile?.bio || '');
    setShowPhoneOnProfile(initialProfile?.showPhoneOnProfile === true);
    setPublicProfile(initialProfile?.publicProfile !== false);
  }, [initialProfile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || !auth.currentUser) return;
    const normalizedContactPhone = contactPhone.replace(/\D/g, '').slice(-10);
    if (contactPhone && normalizedContactPhone.length !== 10) {
      setSubmitError('Contact phone must be a valid 10-digit number.');
      return;
    }

    const profileValues = {
      phone: normalizedContactPhone || auth.currentUser.phoneNumber || '',
      contactPhone: normalizedContactPhone,
      email: auth.currentUser.email || '',
      displayName: cleanName,
      primarySchool: normalizeSchoolInput(school),
      colony: colony.trim(),
      classFocus: classFocus.trim(),
      preferredMeetup: preferredMeetup.trim(),
      availability: availability.trim(),
      bio: bio.trim(),
      publicProfile,
      showPhoneOnProfile,
      isVerifiedParent: true,
      karmaPoints: typeof initialProfile?.karmaPoints === 'number' ? initialProfile.karmaPoints : 10,
    };

    setIsLoading(true);
    setSubmitError('');
    try {
      const payload = {
        ...profileValues,
        updatedAt: serverTimestamp(),
      };
      if (!initialProfile?.createdAt) {
        payload.createdAt = serverTimestamp();
      }

      await setDoc(doc(db, 'users', auth.currentUser.uid), payload, { merge: true });
      setIsLoading(false);
      onComplete({
        ...initialProfile,
        ...profileValues,
        createdAt: initialProfile?.createdAt || new Date(),
      });
    } catch (error) {
      console.error('Error saving profile', error);
      setSubmitError('Could not save your profile right now. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[210] flex flex-col justify-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

      <motion.form
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
        onSubmit={handleSubmit}
        className="glass-panel relative z-10 w-full max-w-xl rounded-t-[2rem] p-6 sm:rounded-[2rem] sm:p-7"
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 rounded-lg border border-amber-200/20 bg-[#171106] p-2 text-amber-100/80 transition hover:border-amber-200/40 hover:text-amber-50"
            aria-label="Close profile setup"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200/25 bg-amber-200/10">
          <User className="h-7 w-7 text-amber-100" />
        </div>

        <h2 className="font-display mb-2 text-3xl font-semibold text-amber-50">Customize your profile</h2>
        <p className="mb-7 text-sm text-amber-100/74">
          Only your name is required. Everything else is optional, and helps buyers trust your listings faster.
        </p>

        <div className="mb-7 grid gap-3.5 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Your Name"
            required
            autoFocus
            className="w-full rounded-xl border border-amber-200/20 bg-[#171106] p-3.5 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            type="text"
            placeholder="Colony / Area (Optional)"
            className="w-full rounded-xl border border-amber-200/20 bg-[#171106] p-3.5 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
            value={colony}
            onChange={(e) => setColony(e.target.value)}
          />

          <input
            type="tel"
            placeholder="WhatsApp / Contact Number (Optional)"
            className="w-full rounded-xl border border-amber-200/20 bg-[#171106] p-3.5 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45 sm:col-span-2"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
          />

          <SchoolSearchInput
            id="profile-school"
            value={school}
            onChange={setSchool}
            schools={SAHARANPUR_SCHOOLS}
            placeholder="Your School (Optional)"
            wrapperClassName="sm:col-span-2"
          />

          <input
            type="text"
            placeholder="Classes (e.g., Class 8-10) Optional"
            className="w-full rounded-xl border border-amber-200/20 bg-[#171106] p-3.5 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
            value={classFocus}
            onChange={(e) => setClassFocus(e.target.value)}
          />

          <input
            type="text"
            placeholder="Preferred Handover Spot (Optional)"
            className="w-full rounded-xl border border-amber-200/20 bg-[#171106] p-3.5 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
            value={preferredMeetup}
            onChange={(e) => setPreferredMeetup(e.target.value)}
          />

          <input
            type="text"
            placeholder="Availability (Optional)"
            className="w-full rounded-xl border border-amber-200/20 bg-[#171106] p-3.5 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45 sm:col-span-2"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
          />

          <textarea
            rows="3"
            placeholder="Short profile bio (Optional)"
            className="w-full resize-none rounded-xl border border-amber-200/20 bg-[#171106] p-3.5 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45 sm:col-span-2"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>

        <div className="mb-6 space-y-3 rounded-xl border border-amber-200/20 bg-[#140f05]/70 p-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-amber-100/85">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-amber-300"
              checked={publicProfile}
              onChange={(e) => setPublicProfile(e.target.checked)}
            />
            <span>Show my profile publicly on my listings</span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-amber-100/85">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-amber-300"
              checked={showPhoneOnProfile}
              onChange={(e) => setShowPhoneOnProfile(e.target.checked)}
            />
            <span>Show phone number in profile card (WhatsApp button still works either way)</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading || !name.trim()}
          className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-55"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              Save Profile <Sparkles className="h-4 w-4" />
            </>
          )}
        </button>
        {submitError && (
          <p className="mt-3 rounded-lg border border-rose-200/45 bg-rose-300/20 px-3 py-2 text-sm font-semibold text-rose-100">
            {submitError}
          </p>
        )}
      </motion.form>
    </div>
  );
}
