import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY || '';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyBelv06gvLFT43yeBtH0x3Elij0t7gZtsE',
  authDomain: 'vidya-share-30112.firebaseapp.com',
  projectId: 'vidya-share-30112',
  messagingSenderId: '899340443248',
  appId: '1:899340443248:web:e48e2fabf365dc2aab9eb5',
  measurementId: 'G-32DZ4DQQV7',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

let analyticsInstance = null;
let analyticsModule = null;

const applyAnalyticsConsent = async (enabled) => {
  if (typeof window === 'undefined') return null;

  analyticsModule = analyticsModule || (await import('firebase/analytics'));
  const supported = await analyticsModule.isSupported();
  if (!supported) return null;

  if (!analyticsInstance) {
    analyticsInstance = analyticsModule.getAnalytics(app);
  }

  analyticsModule.setAnalyticsCollectionEnabled(analyticsInstance, Boolean(enabled));
  return analyticsInstance;
};

export const getAnalyticsClient = async () => applyAnalyticsConsent(true);

export const logAnalyticsEvent = async (eventName, params = {}) => {
  try {
    const analytics = await getAnalyticsClient();
    if (!analytics) return false;
    analyticsModule = analyticsModule || (await import('firebase/analytics'));
    analyticsModule.logEvent(analytics, eventName, params);
    return true;
  } catch (error) {
    console.warn(`Analytics event skipped: ${eventName}`, error);
    return false;
  }
};

export const setAnalyticsUserProperties = async (properties = {}) => {
  try {
    const analytics = await getAnalyticsClient();
    if (!analytics) return false;
    analyticsModule = analyticsModule || (await import('firebase/analytics'));
    analyticsModule.setUserProperties(analytics, properties);
    return true;
  } catch (error) {
    console.warn('Analytics user properties skipped', error);
    return false;
  }
};

if (typeof window !== 'undefined') {
  if (appCheckSiteKey) {
    const debugToken = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN || '';
    if (debugToken) {
      window.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === 'true' ? true : debugToken;
    }

    import('firebase/app-check')
      .then(({ ReCaptchaV3Provider, initializeAppCheck }) =>
        initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider(appCheckSiteKey),
          isTokenAutoRefreshEnabled: true,
        })
      )
      .catch((error) => {
        console.warn('App Check init skipped', error);
      });
  } else {
    console.warn('App Check site key is missing. Set VITE_FIREBASE_APPCHECK_SITE_KEY before production deployment.');
  }

  Promise.resolve(applyAnalyticsConsent(true))
    .catch((error) => {
      console.warn('Analytics init skipped', error);
    });
}

// Export instances for use in components
export const db = getFirestore(app);
export const auth = getAuth(app);
