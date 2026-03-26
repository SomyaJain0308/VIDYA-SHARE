import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Sparkles, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import SchoolSearchInput from './SchoolSearchInput';
import { BrandMark } from './BrandLogo';
import { LUCKNOW_SCHOOLS, normalizeSchoolInput } from '../data/schools';
import { CONSENT_VERSION } from '../config/compliance';
import { getStoredLegalAcceptance } from '../utils/consent';
import { isBasicSellerVerificationComplete } from '../utils/marketplaceCompliance';

const availabilityOptions = [
  'Weekdays after school',
  'Weekday evenings',
  'Saturday only',
  'Sunday only',
  'Weekends',
  'Flexible this week',
];

export default function ProfileSetup({ onComplete, onClose, initialProfile = {} }) {
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [colony, setColony] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('Uttar Pradesh');
  const [contactPhone, setContactPhone] = useState('');
  const [role, setRole] = useState('Student');
  const [responseSpeed, setResponseSpeed] = useState('');
  const [profileTagline, setProfileTagline] = useState('');
  const [preferredMeetup, setPreferredMeetup] = useState('');
  const [availability, setAvailability] = useState('');
  const [bio, setBio] = useState('');
  const [showPhoneOnProfile, setShowPhoneOnProfile] = useState(false);
  const [publicProfile, setPublicProfile] = useState(true);
  const [sellerContactConsent, setSellerContactConsent] = useState(false);
  const [sellerRulesAccepted, setSellerRulesAccepted] = useState(false);
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const normalizedAuthPhone = String(auth.currentUser?.phoneNumber || '').replace(/\D/g, '').slice(-10);
  const hasInvalidContactPhone = Boolean(contactPhone) && contactPhone.length !== 10;

  const completionSignals = [
    school,
    colony,
    city,
    stateName,
    contactPhone,
    responseSpeed,
    profileTagline,
    preferredMeetup,
    availability,
    bio,
  ].filter((value) => Boolean((value || '').toString().trim())).length;

  useEffect(() => {
    setName(initialProfile?.displayName || '');
    setSchool(initialProfile?.primarySchool || '');
    setColony(initialProfile?.colony || '');
    setCity(initialProfile?.city || 'Saharanpur');
    setStateName(initialProfile?.state || 'Uttar Pradesh');
    setContactPhone((initialProfile?.contactPhone || initialProfile?.phone || normalizedAuthPhone || '').replace(/\D/g, '').slice(-10));
    setRole(initialProfile?.role || 'Student');
    setResponseSpeed(initialProfile?.responseSpeed || '');
    setProfileTagline(initialProfile?.profileTagline || '');
    setPreferredMeetup(initialProfile?.preferredMeetup || '');
    setAvailability(initialProfile?.availability || '');
    setBio(initialProfile?.bio || '');
    setShowPhoneOnProfile(initialProfile?.showPhoneOnProfile === true);
    setPublicProfile(initialProfile?.publicProfile !== false);
    setSellerContactConsent(initialProfile?.sellerContactConsent === true);
    setSellerRulesAccepted(initialProfile?.sellerRulesAccepted === true);
    setShowAdvancedDetails(
      Boolean(
        (initialProfile?.profileTagline || '').trim() ||
          (initialProfile?.preferredMeetup || '').trim() ||
          (initialProfile?.availability || '').trim() ||
          (initialProfile?.bio || '').trim()
      )
    );
  }, [initialProfile, normalizedAuthPhone]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || !auth.currentUser) return;

    const normalizedContactPhone = contactPhone.replace(/\D/g, '').slice(-10);
    const normalizedEmail = String(auth.currentUser.email || '').trim();
    const cleanColony = colony.trim();
    if (contactPhone && normalizedContactPhone.length !== 10) {
      setSubmitError('Contact phone must be a valid 10-digit number.');
      return;
    }
    if (!cleanColony) {
      setSubmitError('Colony, street, or area is required.');
      return;
    }
    if (sellerContactConsent && !normalizedContactPhone && !normalizedEmail) {
      setSubmitError('Add a phone number or sign in with an email account before enabling Contact Seller.');
      return;
    }
    if (sellerContactConsent && showPhoneOnProfile && !normalizedContactPhone) {
      setSubmitError('Add a phone number before choosing to reveal it to buyers.');
      return;
    }

    const storedLegalAcceptance = getStoredLegalAcceptance();
    const privateProfileValues = {
      phone: normalizedContactPhone || normalizedAuthPhone || '',
      contactPhone: normalizedContactPhone,
      email: normalizedEmail,
      displayName: cleanName,
      role: role || 'Parent',
      accountAccessMode: String(initialProfile?.accountAccessMode || '').trim(),
      responseSpeed: responseSpeed.trim(),
      profileTagline: profileTagline.trim(),
      primarySchool: normalizeSchoolInput(school),
      colony: cleanColony,
      city: city.trim(),
      state: stateName.trim(),
      preferredMeetup: preferredMeetup.trim(),
      availability: availability.trim(),
      bio: bio.trim(),
      publicProfile,
      showPhoneOnProfile,
      sellerContactConsent,
      sellerRulesAccepted,
      policyAcceptedVersion: storedLegalAcceptance?.accepted ? CONSENT_VERSION : '',
      policyAcceptedAt: storedLegalAcceptance?.acceptedAt || '',
    };
    const basicSellerVerificationCompleted = isBasicSellerVerificationComplete(privateProfileValues);
    const profileValues = {
      ...privateProfileValues,
      basicSellerVerificationCompleted,
      sellerVerificationStatus: basicSellerVerificationCompleted ? 'basic-self-declared' : 'pending',
    };
    const publicProfileValues = {
      displayName: cleanName,
      primarySchool: publicProfile ? normalizeSchoolInput(school) : '',
      publicProfile,
      sellerRole: role || 'Parent',
      sellerContactConsent,
      basicSellerVerificationCompleted,
      sellerVerificationStatus: basicSellerVerificationCompleted ? 'basic-self-declared' : 'pending',
      updatedAt: serverTimestamp(),
    };
    const privateContactValues = {
      contactPhone: normalizedContactPhone,
      email: normalizedEmail,
      contactRevealEnabled: sellerContactConsent,
      revealPhone: showPhoneOnProfile,
      updatedAt: serverTimestamp(),
    };

    setIsLoading(true);
    setSubmitError('');
    try {
      const payload = {
        ...profileValues,
        updatedAt: serverTimestamp(),
      };
      if (!initialProfile?.createdAt) payload.createdAt = serverTimestamp();

      await setDoc(doc(db, 'users', auth.currentUser.uid), payload, { merge: true });
      const publicPayload = {
        ...publicProfileValues,
      };
      const privateContactPayload = {
        ...privateContactValues,
      };
      if (!initialProfile?.createdAt) {
        publicPayload.createdAt = serverTimestamp();
        privateContactPayload.createdAt = serverTimestamp();
      }

      await setDoc(doc(db, 'publicProfiles', auth.currentUser.uid), publicPayload, { merge: true });
      await setDoc(doc(db, 'privateContacts', auth.currentUser.uid), privateContactPayload, { merge: true });
      setIsLoading(false);
      onComplete({
        ...initialProfile,
        ...profileValues,
        createdAt: initialProfile?.createdAt || new Date(),
      });
    } catch (error) {
      console.error('Error saving profile', error);
      setSubmitError(error?.message || 'Could not save your profile right now. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[210] flex flex-col justify-end sm:items-center sm:justify-center sm:p-5 lg:p-6">
      <div className="absolute inset-0 bg-black/62 backdrop-blur-[3px]" />

      <motion.form
        initial={{ opacity: 0, y: 48, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.985 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260 }}
        onSubmit={handleSubmit}
        autoComplete="off"
        className="glass-panel hide-scrollbar relative z-10 w-full max-w-[1440px] overflow-y-auto rounded-t-[2rem] p-5 pt-[max(1.1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-h-[min(94vh,940px)] sm:rounded-[2rem] sm:p-7 lg:p-8 xl:p-9"
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-xl border border-cyan-300/18 bg-[#08111a]/92 p-2 text-cyan-50/80 transition hover:border-cyan-300/34 hover:text-white sm:right-5 sm:top-5"
            aria-label="Close profile setup"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="lux-panel mb-5 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <BrandMark className="h-14 w-14" />
              <div className="min-w-0">
                <p className="lux-kicker">Profile Setup</p>
                <h2 className="lux-title mt-2 text-2xl sm:text-3xl">Customize your profile</h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-cyan-50/72">
                  Add your marketplace identity and disclosure details. Basic seller verification stays self-declared unless the platform later introduces a formal review process.
                </p>
              </div>
            </div>
            <div className="lux-chip-row">
              <span className="lux-meta-chip">{role || 'Student'} account</span>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(290px,340px)_minmax(0,1fr)]">
          <aside className="space-y-4 lg:sticky lg:top-0 lg:h-fit">
            <div className="lux-panel p-4 sm:p-5">
              <p className="lux-kicker">Trust preview</p>
              <div className="lux-panel-soft mt-4 p-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/18 bg-cyan-300/10">
                    <User className="h-5 w-5 text-cyan-100" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{name.trim() || 'Your Name'}</p>
                    <p className="text-xs text-cyan-50/70">{role || 'Student'} account</p>
                  </div>
                </div>
                <div className="lux-divider" />
                <div className="mt-3 space-y-1">
                  {school.trim() ? <p className="text-xs text-cyan-50/70">{school.trim()}</p> : null}
                  {colony.trim() ? <p className="text-xs text-cyan-50/62">{colony.trim()}</p> : null}
                  {city.trim() ? <p className="text-xs text-cyan-50/62">{city.trim()}</p> : null}
                  {responseSpeed.trim() ? (
                    <p className="text-xs text-cyan-50/62">Replies {responseSpeed.trim()}</p>
                  ) : null}
                  {profileTagline.trim() ? <p className="pt-2 text-sm text-cyan-50/84">"{profileTagline.trim()}"</p> : null}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="lux-stat-tile">
                  <p className="lux-kicker">Profile strength</p>
                  <strong>{Math.min(100, 10 + completionSignals * 9)}%</strong>
                  <p className="mt-2 text-xs text-cyan-50/62">More complete seller identity and disclosure data means safer listings.</p>
                </div>
                <div className="lux-stat-tile">
                  <p className="lux-kicker">Visible signals</p>
                  <strong>{completionSignals}</strong>
                  <p className="mt-2 text-xs text-cyan-50/62">Identity, city, response, and meetup details all strengthen compliance.</p>
                </div>
              </div>
            </div>

            <div className="lux-panel p-4 sm:p-5">
              <p className="lux-kicker">Why this matters</p>
              <ul className="mt-4 space-y-2 text-sm leading-relaxed text-cyan-50/72">
                <li>Seller identity details reduce anonymous or misleading listings.</li>
                <li>Mandatory contact disclosures help buyers identify who they are dealing with.</li>
                <li>Optional profile details can be hidden, but listing disclosures still remain mandatory.</li>
              </ul>
            </div>
          </aside>

          <div className="space-y-5">
            <section className="lux-panel p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-cyan-300/14 pb-3">
                <div>
                  <p className="lux-kicker">Public profile card</p>
                  <h3 className="lux-title mt-2 text-xl">Core trust details</h3>
                </div>
                <p className="text-xs text-cyan-50/62">Clear details, faster replies</p>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <input
                  name="display_name"
                  type="text"
                  placeholder="Display name"
                  required
                  autoFocus
                  autoComplete="off"
                  data-lpignore="true"
                  className="lux-input text-sm font-medium"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />

                <input
                  name="colony_area"
                  type="text"
                  placeholder="Colony / Street / Area"
                  required
                  autoComplete="address-level2"
                  className="lux-input text-sm font-medium"
                  value={colony}
                  onChange={(e) => {
                    setColony(e.target.value);
                    if (submitError === 'Colony, street, or area is required.') {
                      setSubmitError('');
                    }
                  }}
                />

                <input
                  name="city"
                  type="text"
                  placeholder="City"
                  autoComplete="address-level2"
                  className="lux-input text-sm font-medium"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />

                <input
                  name="state"
                  type="text"
                  placeholder="State"
                  autoComplete="address-level1"
                  className="lux-input text-sm font-medium"
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
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
                  aria-invalid={hasInvalidContactPhone}
                  className={`lux-input text-sm font-medium sm:col-span-2 ${
                    hasInvalidContactPhone ? 'border-rose-300/60 focus:border-rose-300' : ''
                  }`}
                  value={contactPhone}
                  onChange={(e) => {
                    setContactPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                    if (submitError === 'Contact phone must be a valid 10-digit number.') {
                      setSubmitError('');
                    }
                  }}
                />
                {hasInvalidContactPhone ? (
                  <p className="sm:col-span-2 text-sm font-semibold text-rose-100">
                    Contact phone must be exactly 10 digits.
                  </p>
                ) : null}

                <select
                  name="role"
                  autoComplete="off"
                  className="lux-select text-sm font-medium"
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
                  className="lux-input text-sm font-medium"
                  value={responseSpeed}
                  onChange={(e) => setResponseSpeed(e.target.value)}
                />

                <SchoolSearchInput
                  id="profile-school"
                  value={school}
                  onChange={setSchool}
                  schools={LUCKNOW_SCHOOLS}
                  placeholder="Your School or College (Optional)"
                  wrapperClassName="sm:col-span-2"
                />
              </div>
            </section>

            <section className="lux-panel p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-cyan-300/14 pb-3">
                <div>
                  <p className="lux-kicker">Seller verification</p>
                  <h3 className="lux-title mt-2 text-xl">Basic marketplace KYC</h3>
                </div>
                <p className="text-xs text-cyan-50/62">
                  {isBasicSellerVerificationComplete({
                    contactPhone,
                    email: auth.currentUser?.email || initialProfile?.email || '',
                    city,
                    state: stateName,
                    sellerContactConsent,
                    sellerRulesAccepted,
                  })
                    ? 'Ready to list'
                    : 'Needed before listing'}
                </p>
              </div>

              <div className="grid gap-3 text-sm text-cyan-50/78">
                <label className="lux-panel-soft flex cursor-pointer items-start gap-3 p-3.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-cyan-300"
                    checked={sellerContactConsent}
                    onChange={(e) => setSellerContactConsent(e.target.checked)}
                  />
                  <span>I consent to reveal my contact details only after a logged-in user clicks Contact Seller and confirms they want to reach me.</span>
                </label>
                <label className="lux-panel-soft flex cursor-pointer items-start gap-3 p-3.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-cyan-300"
                    checked={sellerRulesAccepted}
                    onChange={(e) => setSellerRulesAccepted(e.target.checked)}
                  />
                  <span>I confirm my listings will be lawful, accurate, non-misleading, and limited to permitted school-related goods.</span>
                </label>
              </div>
            </section>

            <section className="lux-panel p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="lux-kicker">Optional trust boosters</p>
                  <h3 className="lux-title mt-2 text-xl">Add more detail</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedDetails((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-[#08111a]/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-cyan-50/88 transition hover:border-cyan-300/34 hover:bg-[#0b1824]"
                >
                  {showAdvancedDetails ? (
                    <>
                      Hide details
                      <ChevronUp className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Add details
                      <ChevronDown className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>

              {showAdvancedDetails && (
                <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
                  <input
                    name="profile_tagline"
                    type="text"
                    placeholder="Short intro (e.g. Fast replies, science books, pickup near Court Road)"
                    autoComplete="off"
                    className="lux-input text-sm font-medium sm:col-span-2"
                    value={profileTagline}
                    onChange={(e) => setProfileTagline(e.target.value)}
                  />

                  <input
                    name="preferred_handover"
                    type="text"
                    placeholder="Preferred Meetup Spot (Optional)"
                    autoComplete="off"
                    className="lux-input text-sm font-medium"
                    value={preferredMeetup}
                    onChange={(e) => setPreferredMeetup(e.target.value)}
                  />

                  <select
                    name="availability"
                    autoComplete="off"
                    className="lux-select text-sm font-medium sm:col-span-2"
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value)}
                  >
                    <option className="text-slate-800" value="">
                      Availability (Optional)
                    </option>
                    {availabilityOptions.map((option) => (
                      <option key={option} className="text-slate-800" value={option}>
                        {option}
                      </option>
                    ))}
                  </select>

                  <textarea
                    name="profile_bio"
                    rows="4"
                    placeholder="Short bio (e.g. Parent selling well-kept Class 10 and 12 books. Usually available on weekends for pickup.)"
                    autoComplete="off"
                    className="lux-textarea text-sm font-medium sm:col-span-2"
                    value={bio}
                    maxLength={180}
                    onChange={(e) => setBio(e.target.value)}
                  />
                  <p className="text-xs text-cyan-50/62 sm:col-span-2">
                    Keep it short and useful. Max 180 characters.
                  </p>
                </div>
              )}
            </section>

            <section className="lux-panel p-4 sm:p-5">
              <p className="lux-kicker">Privacy and visibility</p>
              <div className="mt-4 space-y-3">
                <label className="lux-panel-soft flex cursor-pointer items-start gap-3 p-3.5 text-sm text-cyan-50/84">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-cyan-300"
                    checked={publicProfile}
                    onChange={(e) => setPublicProfile(e.target.checked)}
                  />
                  <span>Show optional profile details publicly on my listings</span>
                </label>
                <label className="lux-panel-soft flex cursor-pointer items-start gap-3 p-3.5 text-sm text-cyan-50/84">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-cyan-300"
                    checked={showPhoneOnProfile}
                    onChange={(e) => setShowPhoneOnProfile(e.target.checked)}
                  />
                  <span>Include my phone number in that controlled reveal. If unchecked, only my email will be shared after confirmation.</span>
                </label>
              </div>
            </section>
          </div>
        </div>

        <div className="mt-5 border-t border-cyan-300/14 pt-4">
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
        </div>
      </motion.form>
    </div>
  );
}

