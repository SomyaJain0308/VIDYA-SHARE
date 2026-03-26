import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getReportSeverity } from './marketplaceCompliance';

export const buildListingReportId = (listingId, reporterId) => `${listingId}_${reporterId}`;

export const submitListingReport = async ({
  db,
  listing,
  reporterId,
  reporterName = '',
  reason,
  details = '',
}) => {
  if (!listing?.id || !reporterId) {
    throw new Error('Report is missing listing or user details.');
  }

  const reportRef = doc(db, 'reports', buildListingReportId(listing.id, reporterId));
  const existingSnapshot = await getDoc(reportRef);
  if (existingSnapshot.exists()) {
    return { id: reportRef.id, alreadyExists: true };
  }

  const normalizedReason = String(reason || '').trim();
  const normalizedDetails = String(details || '').trim();
  const severity = getReportSeverity(normalizedReason);

  await setDoc(reportRef, {
    reportedItemId: listing.id,
    noticeTitle: String(listing.title || '').trim(),
    sellerId: String(listing.sellerId || '').trim(),
    sellerName: String(listing.sellerName || 'Community member').trim(),
    reporterId,
    reporterName: String(reporterName || '').trim(),
    reason: normalizedReason,
    details: normalizedDetails,
    severity,
    status: 'open',
    adminNotes: '',
    resolvedAt: null,
    reportedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: reportRef.id, alreadyExists: false };
};
