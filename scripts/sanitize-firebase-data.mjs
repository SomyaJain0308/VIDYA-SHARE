import { initializeApp } from 'firebase/app';
import { collection, deleteField, doc, getDocs, getFirestore, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyBelv06gvLFT43yeBtH0x3Elij0t7gZtsE',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'vidya-share-30112.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID || 'vidya-share-30112',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'vidya-share-30112.firebasestorage.app',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '899340443248',
  appId: process.env.FIREBASE_APP_ID || '1:899340443248:web:e48e2fabf365dc2aab9eb5',
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || 'G-32DZ4DQQV7',
};

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const extractKeywords = (value) => {
  const tokens = normalizeText(value)
    .split(' ')
    .filter(Boolean)
    .filter((token) => token.length > 1);

  return [...new Set(tokens)].slice(0, 24);
};

const normalizePhone = (value) => String(value || '').replace(/\D/g, '').slice(-10);

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const canRevealContact = (data, phone, email) => data.sellerContactConsent === true && Boolean(phone || email);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const chunk = (items, size) => {
  const batches = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
};

const sanitizePublicListings = async () => {
  const snapshot = await getDocs(collection(db, 'publicListings'));
  const updates = [];

  snapshot.forEach((entry) => {
    const data = entry.data();
    const photoUrls = Array.isArray(data.photoUrls) && data.photoUrls.length > 0
      ? data.photoUrls.filter(Boolean)
      : data.photoUrl
        ? [data.photoUrl]
        : [];
    const title = String(data.title || '').trim();
    const description = String(data.description || data.successNote || 'Used school book listing on Vidya Share.').trim();
    const subject = String(data.subject || '').trim();
    const condition = String(data.condition || 'Good').trim() || 'Good';
    const successNote = String(data.successNote || '').trim();

    updates.push({
      ref: doc(db, 'publicListings', entry.id),
      type: 'set',
      data: {
        title,
        description,
        price: Number(data.price || 0) || 0,
        successNote,
        category: 'Books',
        subject,
        classGrade: String(data.classGrade || '').trim(),
        colony: String(data.colony || '').trim(),
        condition,
        sellerId: String(data.sellerId || '').trim(),
        sellerName: String(data.sellerName || '').trim(),
        sellerRole: String(data.sellerRole || 'Parent').trim() || 'Parent',
        sellerSchool: String(data.sellerSchool || '').trim(),
        sellerContactConsent: data.sellerContactConsent === true,
        sellerVerificationStatus: data.sellerVerificationStatus || 'pending',
        photoUrl: photoUrls[0] || '',
        photoUrls,
        imageCount: photoUrls.length,
        status: data.status || 'active',
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || data.createdAt || new Date(),
      },
    });
  });

  return updates;
};

const sanitizeRequests = async () => {
  const snapshot = await getDocs(collection(db, 'requests'));
  const updates = [];

  snapshot.forEach((entry) => {
    const data = entry.data();
    const text = String(data.text || '').trim();
    const subject = String(data.subject || '').trim();
    const normalizedText = normalizeText(text);
    const keywords = Array.isArray(data.keywords) && data.keywords.length > 0
      ? data.keywords
      : extractKeywords(`${text} ${subject} ${data.category || ''}`);

    updates.push({
      ref: doc(db, 'requests', entry.id),
      data: {
        requesterPhone: deleteField(),
        normalizedText,
        keywords,
        status: data.status || 'open',
        matchedCount: Number.isFinite(data.matchedCount) ? data.matchedCount : 0,
      },
    });
  });

  return updates;
};

const sanitizeAlerts = async () => {
  const snapshot = await getDocs(collection(db, 'alerts'));
  const updates = [];

  snapshot.forEach((entry) => {
    updates.push({
      ref: doc(db, 'alerts', entry.id),
      data: {
        recipientPhone: deleteField(),
      },
    });
  });

  return updates;
};

const sanitizePublicProfiles = async () => {
  const snapshot = await getDocs(collection(db, 'publicProfiles'));
  const updates = [];

  snapshot.forEach((entry) => {
    const data = entry.data();

    updates.push({
      ref: doc(db, 'publicProfiles', entry.id),
      type: 'update',
      data: {
        availability: deleteField(),
        bio: deleteField(),
        city: deleteField(),
        colony: deleteField(),
        email: deleteField(),
        legalName: deleteField(),
        accountAccessMode: deleteField(),
        preferredMeetup: deleteField(),
        profileTagline: deleteField(),
        responseSpeed: deleteField(),
        role: deleteField(),
        sellerRulesAccepted: deleteField(),
        showPhoneOnProfile: deleteField(),
        state: deleteField(),
        contactPhone: deleteField(),
        displayName: String(data.displayName || '').trim(),
        primarySchool: data.publicProfile === false ? '' : String(data.primarySchool || '').trim(),
      },
    });
  });

  return updates;
};

const sanitizeUsers = async () => {
  const snapshot = await getDocs(collection(db, 'users'));
  const updates = [];

  snapshot.forEach((entry) => {
    const data = entry.data();
    const normalizedContactPhone = normalizePhone(data.contactPhone || data.phone || '');
    const normalizedEmail = normalizeEmail(data.email || '');
    const revealEnabled = canRevealContact(data, normalizedContactPhone, normalizedEmail);

    updates.push({
      ref: doc(db, 'users', entry.id),
      type: 'update',
      data: {
        contactPhone: normalizedContactPhone,
        email: normalizedEmail,
        isAdmin: deleteField(),
        isVerifiedParent: deleteField(),
        karmaPoints: deleteField(),
        phone: normalizePhone(data.phone || ''),
        successfulHandovers: deleteField(),
        sellerContactConsent: revealEnabled,
        showPhoneOnProfile: data.showPhoneOnProfile === true && normalizedContactPhone.length === 10,
      },
    });
  });

  return updates;
};

const sanitizePrivateContacts = async () => {
  const snapshot = await getDocs(collection(db, 'users'));
  const updates = [];

  snapshot.forEach((entry) => {
    const data = entry.data();
    const normalizedContactPhone = normalizePhone(data.contactPhone || data.phone || '');
    const normalizedEmail = normalizeEmail(data.email || '');

    if (!normalizedContactPhone && !normalizedEmail) {
      return;
    }

    updates.push({
      ref: doc(db, 'privateContacts', entry.id),
      type: 'set',
      data: {
        contactPhone: normalizedContactPhone,
        email: normalizedEmail,
        contactRevealEnabled: canRevealContact(data, normalizedContactPhone, normalizedEmail),
        revealPhone: data.showPhoneOnProfile === true && normalizedContactPhone.length === 10,
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date(),
      },
    });
  });

  return updates;
};

const commitUpdates = async (label, updates) => {
  if (updates.length === 0) {
    console.log(`${label}: no changes needed`);
    return;
  }

  for (const group of chunk(updates, 400)) {
    const batch = writeBatch(db);
    group.forEach((update) => {
      if (update.type === 'set') {
        batch.set(update.ref, update.data, { merge: true });
      } else {
        batch.update(update.ref, update.data);
      }
    });
    await batch.commit();
  }

  console.log(`${label}: updated ${updates.length} documents`);
};

const main = async () => {
  console.log('Starting Firebase data sanitation...');

  await commitUpdates('publicListings', await sanitizePublicListings());
  await commitUpdates('requests', await sanitizeRequests());
  await commitUpdates('alerts', await sanitizeAlerts());
  await commitUpdates('publicProfiles', await sanitizePublicProfiles());
  await commitUpdates('users', await sanitizeUsers());
  await commitUpdates('privateContacts', await sanitizePrivateContacts());

  console.log('Firebase data sanitation complete.');
};

main().catch((error) => {
  console.error('Firebase data sanitation failed.', error);
  process.exitCode = 1;
});
