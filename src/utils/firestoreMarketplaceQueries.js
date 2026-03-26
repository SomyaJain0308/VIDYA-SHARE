import { collection, getDocs, limit, orderBy, query, startAfter, where } from 'firebase/firestore';

export const LISTING_FEED_PAGE_SIZE = 12;
export const REQUEST_BOARD_PAGE_SIZE = 12;
const MATCH_CANDIDATE_LIMIT = 12;

const mapSnapshotDocs = (snapshot) => snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));

const buildListingFeedQuery = ({ db, afterDoc = null, pageSize = LISTING_FEED_PAGE_SIZE }) => {
  const constraints = [where('status', '==', 'active'), orderBy('createdAt', 'desc')];
  if (afterDoc) constraints.push(startAfter(afterDoc));
  constraints.push(limit(pageSize));
  return query(collection(db, 'publicListings'), ...constraints);
};

export const fetchListingFeedPage = async ({ db, afterDoc = null, pageSize = LISTING_FEED_PAGE_SIZE }) => {
  const snapshot = await getDocs(buildListingFeedQuery({ db, afterDoc, pageSize }));
  return {
    docs: mapSnapshotDocs(snapshot),
    cursor: snapshot.docs[snapshot.docs.length - 1] || afterDoc || null,
    hasMore: snapshot.docs.length === pageSize,
  };
};

export const buildRequestBoardQuery = ({ db, pageSize = REQUEST_BOARD_PAGE_SIZE }) =>
  query(
    collection(db, 'requests'),
    where('status', 'in', ['open', 'matched']),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );

const dedupeById = (entries) => {
  const seen = new Set();
  return entries.filter((entry) => {
    if (!entry?.id || seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
};

export const fetchMatchingListingCandidates = async ({
  db,
  subject = '',
  classGrade = '',
  maxPrice = null,
  excludeSellerId = '',
}) => {
  const cleanSubject = String(subject || '').trim();
  const cleanClassGrade = String(classGrade || '').trim();
  const candidateQueries = [];

  if (cleanSubject) {
    candidateQueries.push(
      query(
        collection(db, 'publicListings'),
        where('status', '==', 'active'),
        where('subject', '==', cleanSubject),
        orderBy('createdAt', 'desc'),
        limit(MATCH_CANDIDATE_LIMIT)
      )
    );
  }

  candidateQueries.push(
    query(
      collection(db, 'publicListings'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(MATCH_CANDIDATE_LIMIT)
    )
  );

  const snapshots = await Promise.all(candidateQueries.map((candidateQuery) => getDocs(candidateQuery)));
  const mergedDocs = dedupeById(snapshots.flatMap((snapshot) => mapSnapshotDocs(snapshot)));

  return mergedDocs
    .filter((entry) => !excludeSellerId || entry.sellerId !== excludeSellerId)
    .filter((entry) => !cleanClassGrade || String(entry.classGrade || '').trim() === cleanClassGrade)
    .filter((entry) => {
      if (typeof maxPrice !== 'number' || Number.isNaN(maxPrice) || maxPrice <= 0) return true;
      return Number(entry.price || 0) <= maxPrice;
    })
    .slice(0, MATCH_CANDIDATE_LIMIT);
};

export const fetchMatchingRequestCandidates = async ({
  db,
  subject = '',
  minimumBudget = 0,
  excludeRequesterId = '',
}) => {
  const cleanSubject = String(subject || '').trim();
  const candidateQueries = [];

  if (cleanSubject) {
    candidateQueries.push(
      query(
        collection(db, 'requests'),
        where('status', 'in', ['open', 'matched']),
        where('subject', '==', cleanSubject),
        orderBy('createdAt', 'desc'),
        limit(MATCH_CANDIDATE_LIMIT)
      )
    );
  }

  candidateQueries.push(
    query(
      collection(db, 'requests'),
      where('status', 'in', ['open', 'matched']),
      orderBy('createdAt', 'desc'),
      limit(MATCH_CANDIDATE_LIMIT)
    )
  );

  const snapshots = await Promise.all(candidateQueries.map((candidateQuery) => getDocs(candidateQuery)));
  const mergedDocs = dedupeById(snapshots.flatMap((snapshot) => mapSnapshotDocs(snapshot)));

  return mergedDocs
    .filter((entry) => !excludeRequesterId || entry.requesterId !== excludeRequesterId)
    .filter((entry) => Number(entry.budget || 0) === 0 || Number(entry.budget || 0) >= minimumBudget)
    .slice(0, MATCH_CANDIDATE_LIMIT);
};
