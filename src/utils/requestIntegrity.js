import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';

export const RESERVE_REQUEST_ACTION = 'reserve_request';
export const BOARD_REQUEST_ACTION = 'listing_request';

export const REQUEST_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
};

const ACTION_RATE_LIMITS = {
  [RESERVE_REQUEST_ACTION]: {
    maxActions: 3,
    windowMs: 60 * 1000,
    message: 'Too many reserve requests. Please wait a minute and try again.',
  },
  [BOARD_REQUEST_ACTION]: {
    maxActions: 1,
    windowMs: 60 * 1000,
    message: 'Please wait a minute before posting another request.',
  },
};

export const buildDealRequestId = (noticeId, buyerId) => `${noticeId}_${buyerId}`;

export const buildActionRateLimitId = (action, userId) => `${action}_${userId}`;

const timestampToMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return 0;
};

const applyActionRateLimit = async (transaction, db, { action, userId, nowMs = Date.now() }) => {
  const config = ACTION_RATE_LIMITS[action];
  if (!config) {
    throw new Error('Unsupported request action.');
  }

  const rateLimitRef = doc(db, 'actionRateLimits', buildActionRateLimitId(action, userId));
  const rateLimitSnap = await transaction.get(rateLimitRef);
  const existingData = rateLimitSnap.exists() ? rateLimitSnap.data() : null;
  const windowStartedAtMs = timestampToMillis(existingData?.windowStartedAt);
  const isWithinWindow = windowStartedAtMs > 0 && nowMs - windowStartedAtMs < config.windowMs;

  if (isWithinWindow && Number(existingData?.count || 0) >= config.maxActions) {
    throw new Error(config.message);
  }

  const nextCount = !existingData || !isWithinWindow ? 1 : Number(existingData.count || 0) + 1;
  const nextPayload = {
    action,
    userId,
    maxActions: config.maxActions,
    count: nextCount,
    createdAt: existingData?.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
    windowStartedAt: !existingData || !isWithinWindow ? serverTimestamp() : existingData.windowStartedAt,
  };

  transaction.set(rateLimitRef, nextPayload);
  return rateLimitRef;
};

export const createReserveRequest = async ({
  db,
  notice,
  currentUser,
  buyerProfile,
  buyerPhone,
  reserveForm,
}) => {
  if (!notice?.id) {
    throw new Error('Listing details are missing.');
  }
  if (!currentUser?.uid) {
    throw new Error('Please sign in to continue.');
  }

  const dealRef = doc(db, 'dealRequests', buildDealRequestId(notice.id, currentUser.uid));
  const listingRef = doc(db, 'publicListings', notice.id);

  return runTransaction(db, async (transaction) => {
    const listingSnap = await transaction.get(listingRef);
    if (!listingSnap.exists()) {
      throw new Error('This listing is no longer available.');
    }

    const listingData = listingSnap.data() || {};
    if ((listingData.status || 'active') !== 'active') {
      throw new Error('This listing is not accepting reserve requests.');
    }
    if ((listingData.sellerId || '') === currentUser.uid) {
      throw new Error('You cannot reserve your own listing.');
    }

    const existingDealSnap = await transaction.get(dealRef);
    if (existingDealSnap.exists()) {
      throw new Error('You already sent a request for this listing.');
    }

    await applyActionRateLimit(transaction, db, {
      action: RESERVE_REQUEST_ACTION,
      userId: currentUser.uid,
    });

    transaction.set(dealRef, {
      noticeId: notice.id,
      noticeTitle: listingData.title || notice.title || 'Listing',
      noticePhotoUrl: listingData.photoUrl || notice.photoUrl || '',
      sellerId: listingData.sellerId || notice.sellerId || '',
      sellerName: listingData.sellerName || notice.sellerName || '',
      buyerId: currentUser.uid,
      buyerName: buyerProfile?.displayName || currentUser.displayName || 'Community member',
      buyerPhone,
      buyerSchool: buyerProfile?.primarySchool || '',
      preferredMeetup: reserveForm.preferredMeetup.trim(),
      preferredTime: reserveForm.preferredTime.trim(),
      note: reserveForm.note.trim(),
      status: REQUEST_STATUS.PENDING,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { id: dealRef.id };
  });
};

export const createMarketplaceRequest = async ({ db, currentUser, requestPayload }) => {
  if (!currentUser?.uid) {
    throw new Error('Please sign in to continue.');
  }

  const requestRef = doc(collection(db, 'requests'));

  return runTransaction(db, async (transaction) => {
    await applyActionRateLimit(transaction, db, {
      action: BOARD_REQUEST_ACTION,
      userId: currentUser.uid,
    });

    transaction.set(requestRef, {
      ...requestPayload,
      requesterId: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { id: requestRef.id };
  });
};
