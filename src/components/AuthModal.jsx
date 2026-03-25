import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Phone,
  ShieldCheck,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Mail,
  ArrowLeft,
  Chrome,
  Apple,
  User2,
  Lock,
} from 'lucide-react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';
import { BrandMark } from './BrandLogo';

const getSendOtpErrorMessage = (error) => {
  const code = error?.code || '';
  const host = window.location.hostname;

  if (code === 'auth/invalid-phone-number') return 'Enter a valid 10-digit Indian mobile number.';
  if (code === 'auth/missing-phone-number') return 'Phone number is required.';
  if (code === 'auth/captcha-check-failed') return 'Captcha verification failed. Please tap Get Code again.';
  if (code === 'auth/too-many-requests') return 'Too many attempts from this device. Please try again later.';
  if (code === 'auth/quota-exceeded') return 'OTP quota exceeded on Firebase. Please try later.';
  if (code === 'auth/operation-not-allowed') {
    return 'Phone sign-in is disabled in Firebase Console. Enable it in Authentication > Sign-in method.';
  }
  if (code === 'auth/app-not-authorized') {
    return `Domain "${host}" is not authorized. Add it in Firebase Authentication > Settings > Authorized domains.`;
  }
  return 'Could not send OTP right now. Please try again.';
};

const getVerifyOtpErrorMessage = (error) => {
  const code = error?.code || '';
  if (code === 'auth/invalid-verification-code') return 'Invalid OTP. Please check and try again.';
  if (code === 'auth/code-expired' || code === 'auth/session-expired') return 'OTP expired. Please request a new code.';
  return 'Could not verify OTP. Please try again.';
};

const getEmailAuthErrorMessage = (error, mode) => {
  const code = error?.code || '';
  if (code === 'auth/invalid-email') return 'Enter a valid email address.';
  if (code === 'auth/user-not-found') return 'No account exists with this email yet.';
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'Incorrect email or password.';
  if (code === 'auth/email-already-in-use') return 'An account with this email already exists.';
  if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
  if (code === 'auth/user-disabled') return 'This account has been disabled.';
  if (code === 'auth/too-many-requests') return 'Too many login attempts. Please try again later.';
  if (code === 'auth/operation-not-allowed') {
    return mode === 'signup'
      ? 'Email/password sign-up is disabled in Firebase Console. Enable Email/Password in Authentication > Sign-in method.'
      : 'Email/password sign-in is disabled in Firebase Console. Enable Email/Password in Authentication > Sign-in method.';
  }
  return mode === 'signup' ? 'Could not create your account right now.' : 'Could not sign you in right now.';
};

const getGoogleAuthErrorMessage = (error) => {
  const code = error?.code || '';
  if (code === 'auth/popup-closed-by-user') return 'Google sign-in was closed before it completed.';
  if (code === 'auth/popup-blocked') return 'Popup was blocked. Allow popups and try Google sign-in again.';
  if (code === 'auth/cancelled-popup-request') return 'Another sign-in attempt is already in progress.';
  if (code === 'auth/account-exists-with-different-credential') {
    return 'This email already exists with another sign-in method. Try email sign-in instead.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google sign-in is disabled in Firebase Console. Enable Google in Authentication > Sign-in method.';
  }
  return 'Google sign-in could not complete right now.';
};

const getAppleAuthErrorMessage = (error) => {
  const code = error?.code || '';
  if (code === 'auth/popup-closed-by-user') return 'Apple sign-in was closed before it completed.';
  if (code === 'auth/popup-blocked') return 'Popup was blocked. Allow popups and try Apple sign-in again.';
  if (code === 'auth/cancelled-popup-request') return 'Another sign-in attempt is already in progress.';
  if (code === 'auth/account-exists-with-different-credential') {
    return 'This email already exists with another sign-in method. Try email sign-in instead.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Apple sign-in is disabled in Firebase Console. Enable Apple in Authentication > Sign-in method.';
  }
  if (code === 'auth/unauthorized-domain' || code === 'auth/app-not-authorized') {
    return 'This domain is not authorized for Apple sign-in. Add it in Firebase Authentication > Settings > Authorized domains.';
  }
  return 'Apple sign-in could not complete right now.';
};

export default function AuthModal({ onClose, onSuccess }) {
  const [view, setView] = useState('CHOICE');
  const [emailMode, setEmailMode] = useState('signin');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('Welcome to Vidya Share');
  const otpRefs = useRef([]);

  const clearRecaptcha = () => {
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (error) {
        console.error('Failed to clear reCAPTCHA', error);
      }
      window.recaptchaVerifier = null;
    }
    window.recaptchaWidgetId = null;
  };

  const initializeRecaptcha = async () => {
    if (window.recaptchaVerifier) return window.recaptchaVerifier;

    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {},
      'expired-callback': () => {
        setErrorMessage('Captcha expired. Please tap Get Code again.');
      },
    });

    window.recaptchaVerifier = verifier;
    window.recaptchaWidgetId = await verifier.render();
    return verifier;
  };

  const resetRecaptchaWidget = () => {
    try {
      if (window.grecaptcha && window.recaptchaWidgetId !== null && window.recaptchaWidgetId !== undefined) {
        window.grecaptcha.reset(window.recaptchaWidgetId);
      }
    } catch (error) {
      console.error('Failed to reset reCAPTCHA widget', error);
    }
  };

  const finishAuth = (message) => {
    setSuccessMessage(message);
    setView('SUCCESS');
    setTimeout(() => {
      if (onSuccess) onSuccess();
      onClose();
    }, 1100);
  };

  useEffect(() => {
    return () => {
      clearRecaptcha();
      window.confirmationResult = null;
    };
  }, []);

  useEffect(() => {
    if (view !== 'PHONE' && view !== 'OTP') return undefined;

    auth.languageCode = 'en';
    initializeRecaptcha().catch((error) => {
      console.error('reCAPTCHA init failed', error);
      setErrorMessage('Captcha could not initialize. Refresh and try again.');
    });

    return undefined;
  }, [view]);

  const sendOTP = async () => {
    const onlyDigits = phone.replace(/\D/g, '');
    const localPhone = onlyDigits.slice(-10);

    if (localPhone.length !== 10) {
      setErrorMessage('Enter a valid 10-digit Indian mobile number.');
      return;
    }

    setPhone(localPhone);
    setIsLoading(true);
    setErrorMessage('');

    try {
      const appVerifier = await initializeRecaptcha();
      const formattedPhone = `+91${localPhone}`;
      const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      window.confirmationResult = confirmationResult;
      setOtp(['', '', '', '', '', '']);
      setView('OTP');
    } catch (error) {
      console.error('SMS not sent', error);
      setErrorMessage(getSendOtpErrorMessage(error));
      resetRecaptchaWidget();
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (otp.some((digit) => digit === '')) return;
    if (!window.confirmationResult) {
      setErrorMessage('OTP session expired. Please request a new code.');
      setView('PHONE');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      const code = otp.join('');
      await window.confirmationResult.confirm(code);
      window.confirmationResult = null;
      finishAuth('Phone verified successfully');
    } catch (error) {
      console.error('Invalid OTP', error);
      setErrorMessage(getVerifyOtpErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (event) => {
    event.preventDefault();
    const cleanEmail = email.trim();
    const cleanName = fullName.trim();

    if (!cleanEmail || !password) {
      setErrorMessage('Enter your email and password.');
      return;
    }
    if (emailMode === 'signup' && password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    if (emailMode === 'signup' && password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      if (emailMode === 'signup') {
        const result = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        if (cleanName) {
          await updateProfile(result.user, { displayName: cleanName });
        }
        finishAuth('Email account created');
      } else {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
        finishAuth('Signed in with email');
      }
    } catch (error) {
      console.error('Email auth failed', error);
      setErrorMessage(getEmailAuthErrorMessage(error, emailMode));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      finishAuth('Google account connected');
    } catch (error) {
      console.error('Google auth failed', error);
      setErrorMessage(getGoogleAuthErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      await signInWithPopup(auth, provider);
      finishAuth('Apple account connected');
    } catch (error) {
      console.error('Apple auth failed', error);
      setErrorMessage(getAppleAuthErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const cleanValue = value.replace(/\D/g, '').slice(-1);
    if (value !== '' && cleanValue === '') return;

    const nextOtp = [...otp];
    nextOtp[index] = cleanValue;
    setOtp(nextOtp);

    if (cleanValue !== '' && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    if (cleanValue !== '' && index === 5 && nextOtp.every((digit) => digit !== '')) {
      verifyOTP();
    }
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const goBackToChoice = () => {
    setErrorMessage('');
    setIsLoading(false);
    if (view === 'OTP') {
      setOtp(['', '', '', '', '', '']);
    }
    setView('CHOICE');
  };

  return (
    <div className="fixed inset-0 z-[220] flex flex-col justify-end sm:items-center sm:justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-[#02060c]/82 backdrop-blur-xl" />

      <motion.div
        initial={{ y: '100%', rotateX: 20 }}
        animate={{ y: 0, rotateX: 0 }}
        exit={{ y: '100%', rotateX: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
        className="glass-panel relative z-10 w-full max-w-xl overflow-hidden rounded-t-[2rem] border border-cyan-300/16 bg-[#07111a]/96 p-6 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-[0_32px_100px_rgba(2,10,16,0.7)] sm:rounded-[2rem] sm:p-8"
      >
        <div className="absolute right-5 top-5 sm:right-6 sm:top-6">
          <motion.button
            whileHover={{ rotate: 90 }}
            whileTap={{ scale: 0.8 }}
            onClick={onClose}
            className="rounded-full border border-cyan-300/20 bg-[#09131d]/92 p-2.5 text-cyan-50/80 transition-colors hover:border-cyan-300/38 hover:text-white"
          >
            <X className="h-5 w-5" />
          </motion.button>
        </div>

        <div id="recaptcha-container" className="min-h-[1px]" />

        <AnimatePresence mode="wait">
          {view === 'CHOICE' && (
            <motion.div
              key="choice"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-4"
            >
              <BrandMark className="mb-6 h-14 w-14" />
              <p className="mb-2 text-[10px] font-semibold tracking-[0.2em] text-cyan-100/70 uppercase">Secure Access</p>
              <h2 className="font-display mb-3 text-3xl font-semibold leading-tight text-white sm:text-[2rem]">Sign in your way</h2>
              <p className="mb-8 text-sm leading-relaxed text-cyan-50/72">Use Google, email, or your phone number to enter Vidya Share securely.</p>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-cyan-300/18 bg-[#08111a]/92 px-4 py-4 text-sm font-semibold text-white transition hover:border-cyan-300/40 hover:bg-[#0c1721] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Chrome className="h-5 w-5" />}
                  Continue with Google
                </button>

                <button
                  type="button"
                  onClick={handleAppleSignIn}
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-cyan-300/18 bg-[#08111a]/92 px-4 py-4 text-sm font-semibold text-white transition hover:border-cyan-300/40 hover:bg-[#0c1721] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Apple className="h-5 w-5" />}
                  Continue with Apple
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage('');
                    setView('EMAIL');
                  }}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-cyan-300/18 bg-[#08111a]/92 px-4 py-4 text-sm font-semibold text-white transition hover:border-cyan-300/40 hover:bg-[#0c1721]"
                >
                  <Mail className="h-5 w-5" />
                  Continue with Email
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage('');
                    setView('PHONE');
                  }}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-cyan-300/18 bg-[#08111a]/92 px-4 py-4 text-sm font-semibold text-white transition hover:border-cyan-300/40 hover:bg-[#0c1721]"
                >
                  <Phone className="h-5 w-5" />
                  Continue with Phone OTP
                </button>
              </div>

              {errorMessage && <p className="mt-4 rounded-lg border border-rose-200/45 bg-rose-300/20 px-3 py-2 text-sm font-semibold text-rose-100">{errorMessage}</p>}
            </motion.div>
          )}

          {view === 'EMAIL' && (
            <motion.form
              key="email"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="mt-4"
              onSubmit={handleEmailAuth}
            >
              <button
                type="button"
                onClick={goBackToChoice}
                className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-[#08111a]/90 px-3 py-1.5 text-xs font-semibold text-cyan-50/82 transition hover:border-cyan-300/36 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>

              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/24 bg-cyan-300/10">
                <Mail className="h-7 w-7 text-cyan-100" />
              </div>
              <p className="mb-2 text-[10px] font-semibold tracking-[0.2em] text-cyan-100/70 uppercase">Email Access</p>
              <h2 className="font-display mb-3 text-3xl font-semibold leading-tight text-white">
                {emailMode === 'signup' ? 'Create your email account' : 'Sign in with email'}
              </h2>
              <p className="mb-6 text-sm leading-relaxed text-cyan-50/72">
                {emailMode === 'signup'
                  ? 'Create a Firebase email account for Vidya Share.'
                  : 'Use the email and password linked to your Vidya Share account.'}
              </p>

              <div className="mb-6 flex rounded-2xl border border-cyan-300/18 bg-[#08111a]/88 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setEmailMode('signin');
                    setErrorMessage('');
                  }}
                  className={`flex-1 rounded-[1rem] px-4 py-2.5 text-sm font-semibold transition ${
                    emailMode === 'signin' ? 'bg-cyan-300 text-[#06131d]' : 'text-cyan-50/68'
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailMode('signup');
                    setErrorMessage('');
                  }}
                  className={`flex-1 rounded-[1rem] px-4 py-2.5 text-sm font-semibold transition ${
                    emailMode === 'signup' ? 'bg-cyan-300 text-[#06131d]' : 'text-cyan-50/68'
                  }`}
                >
                  Create account
                </button>
              </div>

              <div className="space-y-3">
                {emailMode === 'signup' && (
                  <div className="relative">
                    <User2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-50/42" />
                    <input
                      type="text"
                      placeholder="Your name"
                      autoFocus
                      className="lux-input w-full py-4 pl-11 pr-4 text-sm font-medium"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                    />
                  </div>
                )}

                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-50/42" />
                  <input
                    type="email"
                    placeholder="name@gmail.com"
                    autoFocus={emailMode !== 'signup'}
                    className="lux-input w-full py-4 pl-11 pr-4 text-sm font-medium"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>

                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-50/42" />
                  <input
                    type="password"
                    placeholder="Password"
                    className="lux-input w-full py-4 pl-11 pr-4 text-sm font-medium"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>

                {emailMode === 'signup' && (
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-50/42" />
                    <input
                      type="password"
                      placeholder="Confirm password"
                      className="lux-input w-full py-4 pl-11 pr-4 text-sm font-medium"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                  </div>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading}
                className="btn-primary mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    {emailMode === 'signup' ? 'Create Account' : 'Sign In'} <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </motion.button>

              {errorMessage && <p className="mt-4 rounded-lg border border-rose-200/45 bg-rose-300/20 px-3 py-2 text-sm font-semibold text-rose-100">{errorMessage}</p>}
            </motion.form>
          )}

          {view === 'PHONE' && (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="mt-4"
            >
              <button
                type="button"
                onClick={goBackToChoice}
                className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-[#08111a]/90 px-3 py-1.5 text-xs font-semibold text-cyan-50/82 transition hover:border-cyan-300/36 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>

              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/24 bg-cyan-300/10">
                <ShieldCheck className="h-7 w-7 text-cyan-100" />
              </div>
              <p className="mb-2 text-[10px] font-semibold tracking-[0.2em] text-cyan-100/70 uppercase">Phone Login</p>
              <h2 className="font-display mb-3 text-3xl font-semibold leading-tight text-white sm:text-[2rem]">Secure phone login</h2>
              <p className="mb-8 text-sm leading-relaxed text-cyan-50/72">Verify your number with OTP to join the local parent network.</p>

              <div className="group relative mb-8 flex items-center">
                <div className="absolute inset-y-0 left-0 flex items-center justify-center rounded-l-2xl border-r border-cyan-300/18 bg-[#08111a] pl-5 pr-3">
                  <span className="text-base font-semibold text-cyan-100">+91</span>
                </div>
                <input
                  type="tel"
                  maxLength="10"
                  autoFocus
                  placeholder="98765 43210"
                  className="w-full rounded-2xl border border-cyan-300/18 bg-[#08111a] py-5 pl-24 pr-4 text-2xl font-semibold tracking-[0.12em] text-white outline-none transition-colors placeholder:text-cyan-50/28 focus:border-cyan-300/42"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/\D/g, ''))}
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={sendOTP}
                disabled={phone.length < 10 || isLoading}
                className="btn-primary flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Get Code <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </motion.button>

              {errorMessage && <p className="mt-4 rounded-lg border border-rose-200/45 bg-rose-300/20 px-3 py-2 text-sm font-semibold text-rose-100">{errorMessage}</p>}
            </motion.div>
          )}

          {view === 'OTP' && (
            <motion.div key="otp" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="mt-4">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage('');
                  setView('PHONE');
                }}
                className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-[#08111a]/90 px-3 py-1.5 text-xs font-semibold text-cyan-50/82 transition hover:border-cyan-300/36 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>

              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/24 bg-cyan-300/10">
                <Phone className="h-7 w-7 text-cyan-100" />
              </div>
              <p className="mb-2 text-[10px] font-semibold tracking-[0.2em] text-cyan-100/70 uppercase">Verification</p>
              <h2 className="font-display mb-3 text-3xl font-semibold leading-tight text-white">Enter 6-digit OTP</h2>
              <p className="mb-8 text-sm leading-relaxed text-cyan-50/72">
                Code sent to <span className="font-semibold text-white">+91 {phone}</span>.{' '}
                <button onClick={() => setView('PHONE')} className="font-semibold text-cyan-100 underline underline-offset-4">
                  Edit number
                </button>
              </p>

              <div className="mb-8 flex justify-between gap-2.5 sm:gap-3">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      otpRefs.current[index] = element;
                    }}
                    type="tel"
                    maxLength="1"
                    className="h-16 w-full rounded-xl border border-cyan-300/18 bg-[#08111a] text-center text-3xl font-semibold text-white outline-none transition-colors placeholder:text-cyan-50/22 focus:border-cyan-300/42 sm:h-20"
                    value={digit}
                    placeholder="-"
                    onChange={(event) => handleOtpChange(index, event.target.value)}
                    onKeyDown={(event) => handleOtpKeyDown(index, event)}
                  />
                ))}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={verifyOTP}
                disabled={otp.some((value) => value === '') || isLoading}
                className="btn-primary flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verify & Enter'}
              </motion.button>

              {errorMessage && <p className="mt-4 rounded-lg border border-rose-200/45 bg-rose-300/20 px-3 py-2 text-sm font-semibold text-rose-100">{errorMessage}</p>}

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={sendOTP}
                  className="text-xs font-semibold text-cyan-100/70 underline underline-offset-4 transition-colors hover:text-white"
                >
                  Resend Code
                </button>
              </div>
            </motion.div>
          )}

          {view === 'SUCCESS' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.5, rotate: -20 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} className="flex flex-col items-center justify-center py-16 text-center">
              <motion.div
                initial={{ rotate: -180, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', damping: 10, stiffness: 100 }}
                className="mb-8 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-cyan-300/20 bg-cyan-300/12"
              >
                <CheckCircle2 className="h-14 w-14 text-cyan-100" strokeWidth={2.5} />
              </motion.div>
              <h2 className="font-display mb-3 text-3xl font-semibold leading-tight text-white">You are in</h2>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/70">{successMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
