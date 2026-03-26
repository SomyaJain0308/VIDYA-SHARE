import { CONSENT_VERSION } from '../config/compliance';

export const COOKIE_CONSENT_STORAGE_KEY = 'vidya-share:cookie-consent';
export const LEGAL_ACCEPTANCE_STORAGE_KEY = 'vidya-share:legal-acceptance';

const parseStoredJson = (storageKey) => {
  if (typeof window === 'undefined') return null;

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) return null;
    return JSON.parse(rawValue);
  } catch (error) {
    console.warn(`Could not parse stored value for ${storageKey}`, error);
    return null;
  }
};

export const getStoredCookieConsent = () => parseStoredJson(COOKIE_CONSENT_STORAGE_KEY);

export const hasSavedCookieConsent = () => {
  const storedConsent = getStoredCookieConsent();
  return Boolean(storedConsent?.version);
};

export const hasAnalyticsConsent = () => getStoredCookieConsent()?.analytics === true;

export const saveCookieConsent = ({ analytics = false } = {}) => {
  const payload = {
    essential: true,
    analytics: Boolean(analytics),
    version: CONSENT_VERSION,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(payload));
  }

  return payload;
};

export const getStoredLegalAcceptance = () => parseStoredJson(LEGAL_ACCEPTANCE_STORAGE_KEY);

export const saveLegalAcceptance = () => {
  const payload = {
    accepted: true,
    version: CONSENT_VERSION,
    acceptedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LEGAL_ACCEPTANCE_STORAGE_KEY, JSON.stringify(payload));
  }

  return payload;
};
