import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Mail,
  ArrowLeft,
  Chrome,
  User2,
  Lock,
} from 'lucide-react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';
import { BrandMark } from './BrandLogo';
import { APP_NAME } from '../config/compliance';
import { getStoredLegalAcceptance, saveLegalAcceptance } from '../utils/consent';

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
  if (code === 'auth/popup-closed-by-user') return 'Google sign-in was cancelled. You can keep browsing or try again.';
  if (code === 'auth/popup-blocked') return 'Popup was blocked. Allow popups and try Google sign-in again.';
  if (code === 'auth/cancelled-popup-request') return 'Another Google sign-in attempt is already in progress.';
  if (code === 'auth/account-exists-with-different-credential') {
    return 'This email already exists with another sign-in method. Try email sign-in instead.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google sign-in is disabled in Firebase Console. Enable Google in Authentication > Sign-in method.';
  }
  return 'Google sign-in could not complete right now.';
};

export default function AuthModal({ onClose, onSuccess }) {
  const storedLegalAcceptance = getStoredLegalAcceptance();
  const successTimeoutRef = useRef(null);
  const [view, setView] = useState('CHOICE');
  const [emailMode, setEmailMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('Welcome to Vidya Share');
  const [acceptedPolicies, setAcceptedPolicies] = useState(storedLegalAcceptance?.accepted === true);

  const resetTransientState = () => {
    setIsLoading(false);
    setErrorMessage('');
    setSuccessMessage('Welcome to Vidya Share');
    setPassword('');
    setConfirmPassword('');
  };

  const finishAuth = (message) => {
    if (acceptedPolicies) {
      saveLegalAcceptance();
    }
    if (successTimeoutRef.current) {
      window.clearTimeout(successTimeoutRef.current);
    }
    setSuccessMessage(message);
    setView('SUCCESS');
    successTimeoutRef.current = window.setTimeout(() => {
      if (onSuccess) onSuccess();
      onClose();
    }, 1100);
  };

  useEffect(() => () => {
    if (successTimeoutRef.current) {
      window.clearTimeout(successTimeoutRef.current);
    }
  }, []);

  const handleEmailAuth = async (event) => {
    event.preventDefault();
    if (isLoading) return;
    const cleanEmail = email.trim();
    const cleanName = fullName.trim();

    if (!acceptedPolicies) {
      setErrorMessage('Please review and accept the platform policies before continuing.');
      return;
    }
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
    if (isLoading) return;
    if (!acceptedPolicies) {
      setErrorMessage('Please review and accept the platform policies before continuing.');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      finishAuth('Google account connected');
    } catch (error) {
      console.error('Google auth failed', error);
      if (error?.code === 'auth/popup-closed-by-user') {
        resetTransientState();
        setErrorMessage('');
        return;
      }
      setErrorMessage(getGoogleAuthErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const goBackToChoice = () => {
    resetTransientState();
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
              <p className="mb-8 text-sm leading-relaxed text-cyan-50/72">Use Google or email to continue. You can keep browsing without logging in.</p>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading || !acceptedPolicies}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-cyan-300/18 bg-[#08111a]/92 px-4 py-4 text-sm font-semibold text-white transition hover:border-cyan-300/40 hover:bg-[#0c1721] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Chrome className="h-5 w-5" />}
                  Continue with Google
                </button>

                <button
                  type="button"
                  onClick={() => {
                    resetTransientState();
                    setView('EMAIL');
                  }}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-cyan-300/18 bg-[#08111a]/92 px-4 py-4 text-sm font-semibold text-white transition hover:border-cyan-300/40 hover:bg-[#0c1721]"
                >
                  <Mail className="h-5 w-5" />
                  Continue with Email
                </button>
              </div>

              <div className="mt-5 space-y-3 rounded-[1.4rem] border border-cyan-300/14 bg-[#08111a]/86 p-4">
                <label className="flex items-start gap-3 text-sm leading-relaxed text-cyan-50/80">
                  <input
                    name="accept_policies"
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-cyan-300"
                    checked={acceptedPolicies}
                    onChange={(event) => {
                      setAcceptedPolicies(event.target.checked);
                      if (event.target.checked) setErrorMessage('');
                    }}
                  />
                  <span>
                    I have reviewed the{' '}
                    <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold text-cyan-100 underline-offset-4 hover:underline">
                      Terms & Conditions
                    </a>
                    ,{' '}
                    <a href="/privacy" target="_blank" rel="noreferrer" className="font-semibold text-cyan-100 underline-offset-4 hover:underline">
                      Privacy Policy
                    </a>
                    ,{' '}
                    <a href="/refund-policy" target="_blank" rel="noreferrer" className="font-semibold text-cyan-100 underline-offset-4 hover:underline">
                      Refund / Return Policy
                    </a>
                    , and{' '}
                    <a href="/disclaimer" target="_blank" rel="noreferrer" className="font-semibold text-cyan-100 underline-offset-4 hover:underline">
                      Marketplace Disclaimer
                    </a>
                    . We will ask for confirmation before sensitive actions if needed.
                  </span>
                </label>

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
                    resetTransientState();
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
                    resetTransientState();
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
                      name="full_name"
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
                    name="email"
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
                    name="password"
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
                      name="confirm_password"
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
