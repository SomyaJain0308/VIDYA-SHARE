export const LISTING_CONDITION_OPTIONS = ['New', 'Like New', 'Good', 'Fair', 'Needs Repair'];
export const LISTING_TYPE_OPTIONS = [
  { value: 'single', label: 'Selling a single book' },
  { value: 'set', label: 'Selling a set of books' },
];

export const buildListingPath = (listingId = '') =>
  listingId ? `/listing/${encodeURIComponent(String(listingId).trim())}` : '/';

export const buildListingShareUrl = (listingId, origin = '') => {
  const baseOrigin = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${baseOrigin}${buildListingPath(listingId)}`;
};

export const getListingLocationLabel = (listing = {}) =>
  String(listing.colony || '').trim() || 'Saharanpur pickup area';

export const buildPublicListingPayload = (listing = {}) => {
  const photoUrls = Array.isArray(listing.photoUrls) && listing.photoUrls.length > 0
    ? listing.photoUrls.filter(Boolean)
    : listing.photoUrl
      ? [listing.photoUrl]
      : [];
  const photoPathsSource = Array.isArray(listing.photoPaths) ? listing.photoPaths.filter((entry) => typeof entry === 'string') : [];
  const photoPaths =
    photoPathsSource.length === photoUrls.length
      ? photoPathsSource
      : photoUrls.map((_, index) => photoPathsSource[index] || '');

  return {
    category: 'Books',
    listingType: String(listing.listingType || 'single').trim() || 'single',
    title: String(listing.title || '').trim(),
    description: String(listing.description || listing.successNote || '').trim(),
    price: Number.isFinite(Number(listing.price)) ? Math.max(0, Number(listing.price)) : 0,
    successNote: String(listing.successNote || '').trim(),
    subject: String(listing.subject || '').trim(),
    classGrade: String(listing.classGrade || '').trim(),
    condition: String(listing.condition || '').trim(),
    colony: String(listing.colony || '').trim(),
    sellerId: String(listing.sellerId || '').trim(),
    sellerName: String(listing.sellerName || 'Community member').trim(),
    sellerRole: String(listing.sellerRole || listing.role || '').trim(),
    sellerSchool: String(listing.sellerSchool || '').trim(),
    sellerVerificationStatus: String(listing.sellerVerificationStatus || 'pending').trim() || 'pending',
    sellerContactConsent: listing.sellerContactConsent === true,
    photoUrl: photoUrls[0] || '',
    photoUrls,
    photoPaths,
    imageCount: photoUrls.length,
    status: String(listing.status || 'active').trim() || 'active',
    ...(listing.createdAt !== undefined ? { createdAt: listing.createdAt } : {}),
    ...(listing.updatedAt !== undefined ? { updatedAt: listing.updatedAt } : {}),
  };
};
