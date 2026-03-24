import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, ShieldCheck, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../firebase';

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

export default function AuthModal({ onClose, onSuccess }) {
  const [step, setStep] = useState('PHONE');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
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

  useEffect(() => {
    auth.languageCode = 'en';
    initializeRecaptcha().catch((error) => {
      console.error('reCAPTCHA init failed', error);
      setErrorMessage('Captcha could not initialize. Refresh and try again.');
    });

    return () => {
      clearRecaptcha();
      window.confirmationResult = null;
    };
  }, []);

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
      setStep('OTP');
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
      setStep('PHONE');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      const code = otp.join('');
      await window.confirmationResult.confirm(code);
      setStep('SUCCESS');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1200);
    } catch (error) {
      console.error('Invalid OTP', error);
      setErrorMessage(getVerifyOtpErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const cleanValue = value.replace(/\D/g, '').slice(-1);
    if (value !== '' && cleanValue === '') return;

    const newOtp = [...otp];
    newOtp[index] = cleanValue;
    setOtp(newOtp);

    if (cleanValue !== '' && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    if (cleanValue !== '' && index === 5 && newOtp.every((v) => v !== '')) {
      verifyOTP();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex flex-col justify-end sm:items-center sm:justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/75 backdrop-blur-lg" />

      <motion.div
        initial={{ y: '100%', rotateX: 20 }}
        animate={{ y: 0, rotateX: 0 }}
        exit={{ y: '100%', rotateX: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
        className="glass-panel relative z-10 w-full max-w-lg overflow-hidden rounded-t-[2rem] p-6 pb-8 sm:rounded-[2rem] sm:p-8"
      >
        <div className="absolute right-5 top-5 sm:right-6 sm:top-6">
          <motion.button
            whileHover={{ rotate: 90 }}
            whileTap={{ scale: 0.8 }}
            onClick={onClose}
            className="rounded-full border border-amber-200/20 bg-[#1a1207] p-2.5 text-amber-100/85 transition-colors hover:text-amber-50"
          >
            <X className="h-5 w-5" />
          </motion.button>
        </div>

        <div id="recaptcha-container" className="min-h-[1px]" />

        <AnimatePresence mode="wait">
          {step === 'PHONE' && (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="mt-4"
            >
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200/30 bg-amber-200/10">
                <ShieldCheck className="h-7 w-7 text-amber-100" />
              </div>
              <p className="mb-2 text-[10px] font-semibold tracking-[0.2em] text-amber-100/75 uppercase">Community Security</p>
              <h2 className="font-display mb-3 text-3xl font-semibold leading-tight text-amber-50 sm:text-[2rem]">Secure phone login</h2>
              <p className="mb-8 text-sm text-amber-100/75">Join the local parent network with one-time verification.</p>

              <div className="group relative mb-8 flex items-center">
                <div className="absolute inset-y-0 left-0 flex items-center justify-center rounded-l-2xl border-r border-amber-200/25 bg-[#171106] pl-5 pr-3">
                  <span className="text-base font-semibold text-amber-100">+91</span>
                </div>
                <input
                  type="tel"
                  maxLength="10"
                  autoFocus
                  placeholder="98765 43210"
                  className="w-full rounded-2xl border border-amber-200/25 bg-[#171106] py-5 pl-24 pr-4 text-2xl font-semibold tracking-[0.12em] text-amber-50 outline-none transition-colors placeholder:text-amber-100/35 focus:border-amber-200/45"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
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

          {step === 'OTP' && (
            <motion.div key="otp" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="mt-4">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200/30 bg-amber-200/10">
                <Phone className="h-7 w-7 text-amber-100" />
              </div>
              <p className="mb-2 text-[10px] font-semibold tracking-[0.2em] text-amber-100/75 uppercase">Verification</p>
              <h2 className="font-display mb-3 text-3xl font-semibold leading-tight text-amber-50">Enter 6-digit OTP</h2>
              <p className="mb-8 text-sm text-amber-100/72">
                Code sent to <span className="font-semibold text-amber-50">+91 {phone}</span>.{' '}
                <button onClick={() => setStep('PHONE')} className="font-semibold text-amber-100 underline underline-offset-4">
                  Edit number
                </button>
              </p>

              <div className="mb-8 flex justify-between gap-2.5 sm:gap-3">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      otpRefs.current[index] = el;
                    }}
                    type="tel"
                    maxLength="1"
                    className="h-16 w-full rounded-xl border border-amber-200/25 bg-[#171106] text-center text-3xl font-semibold text-amber-50 outline-none transition-colors placeholder:text-amber-100/25 focus:border-amber-200/50 sm:h-20"
                    value={digit}
                    placeholder="-"
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  />
                ))}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={verifyOTP}
                disabled={otp.some((v) => v === '') || isLoading}
                className="btn-primary flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verify & Enter'}
              </motion.button>

              {errorMessage && <p className="mt-4 rounded-lg border border-rose-200/45 bg-rose-300/20 px-3 py-2 text-sm font-semibold text-rose-100">{errorMessage}</p>}

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={sendOTP}
                  className="text-xs font-semibold text-amber-100/70 underline underline-offset-4 transition-colors hover:text-amber-50"
                >
                  Resend Code
                </button>
              </div>
            </motion.div>
          )}

          {step === 'SUCCESS' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.5, rotate: -20 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} className="flex flex-col items-center justify-center py-16 text-center">
              <motion.div
                initial={{ rotate: -180, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', damping: 10, stiffness: 100 }}
                className="mb-8 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-amber-200/20"
              >
                <CheckCircle2 className="h-14 w-14 text-amber-100" strokeWidth={2.5} />
              </motion.div>
              <h2 className="font-display mb-3 text-3xl font-semibold leading-tight text-amber-50">Trust verified</h2>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/75">Welcome to School Swap</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
