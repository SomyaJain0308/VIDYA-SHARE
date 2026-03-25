import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Sparkles, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import SchoolSearchInput from './SchoolSearchInput';
import { SAHARANPUR_SCHOOLS, normalizeSchoolInput } from '../data/schools';

export default function ProfileSetup({ onComplete, onClose, initialProfile = {} }) {
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [colony, setColony] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [role, setRole] = useState('Parent');
  const [responseSpeed, setResponseSpeed] = useState('');
  const [profileTagline, setProfileTagline] = useState('');
  const [classFocus, setClassFocus] = useState('');
  const [preferredMeetup, setPreferredMeetup] = useState('');
  const [availability, setAvailability] = useState('');
  const [bio, setBio] = useState('');
  const [showPhoneOnProfile, setShowPhoneOnProfile] = useState(false);
  const [publicProfile, setPublicProfile] = useState(true);
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    setName(initialProfile?.displayName || '');
    setSchool(initialProfile?.primarySchool || '');
    setColony(initialProfile?.colony || '');
    setContactPhone((initialProfile?.contactPhone || initialProfile?.phone || auth.currentUser?.phoneNumber || '').replace(/\D/g, '').slice(-10));
    setRole(initialProfile?.role || 'Parent');
    setResponseSpeed(initialProfile?.responseSpeed || '');
    setProfileTagline(initialProfile?.profileTagline || '');
    setClassFocus(initialProfile?.classFocus || '');
    setPreferredMeetup(initialProfile?.preferredMeetup || '');
    setAvailability(initialProfile?.availability || '');
    setBio(initialProfile?.bio || '');
    setShowPhoneOnProfile(initialProfile?.showPhoneOnProfile === true);
    setPublicProfile(initialProfile?.publicProfile !== false);
    setShowAdvancedDetails(
      Boolean(
        (initialProfile?.profileTagline || '').trim() ||
          (initialProfile?.classFocus || '').trim() ||
          (initialProfile?.preferredMeetup || '').trim() ||
          (initialProfile?.availability || '').trim() ||
          (initialProfile?.bio || '').trim()
      )
    );
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
      role: role || 'Parent',
      responseSpeed: responseSpeed.trim(),
      profileTagline: profileTagline.trim(),
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
    <div className="fixed inset-0 z-[210] flex flex-col justify-end sm:items-center sm:justify-center sm:p-6">
      <div className="absolute inset-0 bg-black/58 backdrop-blur-[2px]" />

      <motion.form
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
        onSubmit={handleSubmit}
        autoComplete="off"
        className="glass-panel relative z-10 w-full max-w-[1180px] rounded-t-[2rem] p-6 pt-[max(1.15rem,env(safe-area-inset-top))] pb-[max(1.2rem,env(safe-area-inset-bottom))] sm:max-h-[min(94vh,900px)] sm:overflow-y-auto sm:rounded-[2rem] sm:p-7 lg:p-8"
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

        <h2 className="font-display mb-2 text-3xl font-semibold text-amber-50 lg:text-[2.2rem]">Customize your profile</h2>
        <p className="mb-6 max-w-2xl text-sm text-amber-100/74">
          Only your name is required. Everything else is optional, and helps buyers trust your listings faster.
        </p>

        <div className="mb-5 rounded-2xl border border-amber-200/22 bg-[#130d05]/46 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-amber-200/14 pb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/68">Public profile card</p>
            <p className="text-xs text-amber-100/64">Keep details simple and trustworthy</p>
          </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <input
            name="display_name"
            type="text"
            placeholder="Your Name"
            required
            autoFocus
            autoComplete="name"
            className="w-full rounded-xl border border-amber-200/20 bg-[#171106] p-3.5 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            name="colony_area"
            type="text"
            placeholder="Colony / Area (Optional)"
            autoComplete="address-level2"
            className="w-full rounded-xl border border-amber-200/20 bg-[#171106] p-3.5 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
            value={colony}
            onChange={(e) => setColony(e.target.value)}
          />

          <input
            name="contact_phone"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{10}"
            placeholder="WhatsApp / Contact Number (Optional)"
            autoComplete="new-password"
            autoCorrect="off"
            spellCheck={false}
            data-lpignore="true"
            className="w-full rounded-xl border border-amber-200/20 bg-[#171106] p-3.5 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45 sm:col-span-2"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
          />

          <select
            name="role"
            autoComplete="off"
            className="w-full rounded-xl border border-amber-200/20 bg-[#171106] p-3.5 text-sm font-medium text-amber-50 outline-none focus:border-amber-200/45"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option className="text-slate-800" value="Parent">
              Parent
            </option>
            <option className="text-slate-800" value="Student">
              Student
            </option>
            <option className="text-slate-800" value="Guardian">
              Guardian
            </option>
          </select>

          <input
            name="response_speed"
            type="text"
            placeholder="Response speed (e.g., under 1 hour)"
            autoComplete="off"
            className="w-full rounded-xl border border-amber-200/20 bg-[#171106] p-3.5 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
            value={responseSpeed}
            onChange={(e) => setResponseSpeed(e.target.value)}
          />

          <SchoolSearchInput
            id="profile-school"
            value={school}
            onChange={setSchool}
            schools={SAHARANPUR_SCHOOLS}
            placeholder="Your School (Optional)"
            wrapperClassName="sm:col-span-2"
          />
        </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvancedDetails((prev) => !prev)}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-200/25 bg-[#140f05]/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-amber-100/88 transition hover:border-amber-200/45 hover:bg-[#1b1308]"
        >
          {showAdvancedDetails ? (
            <>
              Hide optional details
              <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              Add more details
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </button>

        {showAdvancedDetails && (
          <div className="mb-6 grid gap-3.5 sm:grid-cols-2">
            <input
              name="profile_tagline"
              type="text"
              placeholder="Profile tagline (Optional)"
              autoComplete="off"
              className="w-full rounded-xl border border-amber-200/20 bg-[#171106] p-3.5 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45 sm:col-span-2"
              value={profileTagline}
              onChange={(e) => setProfileTagline(e.target.value)}
            />

            <input
              name="class_focus"
              type="text"
              placeholder="Classes (e.g., Class 8-10) Optional"
              autoComplete="off"
              className="w-full rounded-xl border border-amber-200/20 bg-[#171106] p-3.5 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
              value={classFocus}
              onChange={(e) => setClassFocus(e.target.value)}
            />

            <input
              name="preferred_handover"
              type="text"
              placeholder="Preferred Handover Spot (Optional)"
              autoComplete="off"
              className="w-full rounded-xl border border-amber-200/20 bg-[#171106] p-3.5 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
              value={preferredMeetup}
              onChange={(e) => setPreferredMeetup(e.target.value)}
            />

            <input
              name="availability"
              type="text"
              placeholder="Availability (Optional)"
              autoComplete="off"
              className="w-full rounded-xl border border-amber-200/20 bg-[#171106] p-3.5 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45 sm:col-span-2"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
            />

            <textarea
              name="profile_bio"
              rows="3"
              placeholder="Short profile bio (Optional)"
              autoComplete="off"
              className="w-full resize-none rounded-xl border border-amber-200/20 bg-[#171106] p-3.5 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45 sm:col-span-2"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
        )}

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
