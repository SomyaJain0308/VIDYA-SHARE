import {
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { buildPublicListingPayload } from './listings';
import { REQUEST_STATUS } from './requestIntegrity';

const rejectSiblingDeals = async ({ db, noticeId, keepDealId = '' }) => {
  if (!noticeId) return;

  const siblingSnapshot = await getDocs(query(collection(db, 'dealRequests'), where('noticeId', '==', noticeId)));
  const siblingRefs = siblingSnapshot.docs.filter((entry) => entry.id !== keepDealId);
  if (siblingRefs.length === 0) return;

  const batch = writeBatch(db);
  let hasWrites = false;
  siblingRefs.forEach((entry) => {
    const status = entry.data()?.status || REQUEST_STATUS.PENDING;
    if (status === REQUEST_STATUS.REJECTED || status === REQUEST_STATUS.COMPLETED) return;
    batch.update(entry.ref, {
      status: REQUEST_STATUS.REJECTED,
      rejectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    hasWrites = true;
  });

  if (hasWrites) {
    await batch.commit();
  }
};

export const deleteListingWithRelations = async ({ db, listingId }) => {
  if (!listingId) return;
  await deleteDoc(doc(db, 'publicListings', listingId));
};

export const updateListingLifecycleStatus = async ({
  db,
  listingId,
  sellerId,
  nextStatus,
}) => {
  if (!listingId || !sellerId) {
    throw new Error('Listing status update is missing identifiers.');
  }

  const listingRef = doc(db, 'publicListings', listingId);

  return runTransaction(db, async (transaction) => {
    const listingSnapshot = await transaction.get(listingRef);
    if (!listingSnapshot.exists()) {
      throw new Error('Listing not found.');
    }

    const listingData = listingSnapshot.data() || {};
    if ((listingData.sellerId || '') !== sellerId) {
      throw new Error('You do not have permission to update this listing.');
    }

    const listingPatch = {
      status: nextStatus,
      updatedAt: serverTimestamp(),
      soldAt: nextStatus === 'sold' ? listingData.soldAt || serverTimestamp() : deleteField(),
    };

    if (nextStatus === 'active') {
      listingPatch.reservedForBuyerId = deleteField();
      listingPatch.reservedForBuyerName = deleteField();
    }

    transaction.set(
      listingRef,
      buildPublicListingPayload({
        ...listingData,
        ...listingPatch,
      }),
      { merge: true }
    );
  });
};

export const updateDealRequestState = async ({
  db,
  dealId,
  actorUserId,
  action,
}) => {
  if (!dealId || !actorUserId) {
    throw new Error('Deal update is missing identifiers.');
  }

  const dealRef = doc(db, 'dealRequests', dealId);
  const outcome = await runTransaction(db, async (transaction) => {
    const dealSnapshot = await transaction.get(dealRef);
    if (!dealSnapshot.exists()) {
      throw new Error('Pickup request not found.');
    }

    const dealData = dealSnapshot.data() || {};
    if ((dealData.sellerId || '') !== actorUserId) {
      throw new Error('You do not have permission to update this pickup request.');
    }

    const listingRef = doc(db, 'publicListings', dealData.noticeId);
    const listingSnapshot = await transaction.get(listingRef);
    if (!listingSnapshot.exists()) {
      throw new Error('Listing not found.');
    }

    const listingData = listingSnapshot.data() || {};

    if (action === 'accept') {
      if ((listingData.status || 'active') !== 'active') {
        throw new Error('Only active listings can accept pickup requests.');
      }

      transaction.update(dealRef, {
        status: REQUEST_STATUS.ACCEPTED,
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      transaction.set(
        listingRef,
        buildPublicListingPayload({
          ...listingData,
          status: 'reserved',
          reservedForBuyerId: dealData.buyerId || '',
          reservedForBuyerName: dealData.buyerName || '',
          soldAt: null,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      );

      return { noticeId: dealData.noticeId, keepDealId: dealId, rejectSiblings: true };
    }

    if (action === 'reject') {
      const listingPatch =
        listingData.reservedForBuyerId === dealData.buyerId
          ? {
              status: 'active',
              reservedForBuyerId: deleteField(),
              reservedForBuyerName: deleteField(),
              soldAt: deleteField(),
              updatedAt: serverTimestamp(),
            }
          : {
              updatedAt: serverTimestamp(),
            };

      transaction.update(dealRef, {
        status: REQUEST_STATUS.REJECTED,
        rejectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      transaction.set(
        listingRef,
        buildPublicListingPayload({
          ...listingData,
          ...(listingData.reservedForBuyerId === dealData.buyerId
            ? {
                status: 'active',
                reservedForBuyerId: '',
                reservedForBuyerName: '',
                soldAt: null,
              }
            : {}),
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      );

      return { noticeId: dealData.noticeId, keepDealId: '', rejectSiblings: false };
    }

    if (action === 'complete') {
      transaction.update(dealRef, {
        status: REQUEST_STATUS.COMPLETED,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      transaction.set(
        listingRef,
        buildPublicListingPayload({
          ...listingData,
          status: 'sold',
          reservedForBuyerId: dealData.buyerId || listingData.reservedForBuyerId || '',
          reservedForBuyerName: dealData.buyerName || listingData.reservedForBuyerName || '',
          soldAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      );

      return { noticeId: dealData.noticeId, keepDealId: dealId, rejectSiblings: true };
    }

    throw new Error('Unsupported pickup request action.');
  });

  if (outcome?.rejectSiblings && outcome.noticeId) {
    await rejectSiblingDeals({
      db,
      noticeId: outcome.noticeId,
      keepDealId: outcome.keepDealId,
    });
  }
};
