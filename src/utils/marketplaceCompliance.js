const PROHIBITED_TERMS = [
  'aadhaar',
  'adult content',
  'answer key leak',
  'beer',
  'cigarette',
  'counterfeit',
  'driver license',
  'exam leak',
  'firecracker',
  'gun',
  'knife',
  'leaked paper',
  'medicine',
  'passport',
  'pan card',
  'pirated',
  'porn',
  'prescription',
  'school id',
  'steroid',
  'stolen',
  'tobacco',
  'vape',
  'weapon',
  'wine',
];

const SUSPICIOUS_MARKETPLACE_TERMS = [
  'advance payment',
  'booking amount',
  'courier only',
  'delivery fee first',
  'instagram dm',
  'no inspection',
  'otp',
  'pay first',
  'payment screenshot',
  'telegram',
  'upi first',
  'whatsapp only',
];

export const LISTING_STANDARDS = [
  'Use a real title, genuine photos, and an accurate description of the item and its condition.',
  'Only list lawful school-related goods that you own or are authorized to sell.',
  'Do not post prohibited, unsafe, age-restricted, infringing, misleading, or stolen items.',
  'Set a clear price and let buyers inspect the item before paying.',
];

export const MARKETPLACE_SAFETY_TIPS = [
  'Meet in a public place during daylight when possible.',
  'Inspect the books before you pay and avoid advance payments.',
  'Keep the conversation inside trusted channels until the meetup is confirmed.',
];

export const REPORT_REASON_OPTIONS = [
  'Fake or misleading listing',
  'Suspicious payment request',
  'Unsafe meetup or behavior',
  'Counterfeit or prohibited item',
  'Spam or duplicate listing',
  'Wrong category or details',
];

const normalizeComplianceText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const findBlockedMarketplaceTerms = (value) => {
  const normalizedValue = normalizeComplianceText(value);
  if (!normalizedValue) return [];

  return PROHIBITED_TERMS.filter((term) => normalizedValue.includes(term));
};

export const containsBlockedMarketplaceTerms = (value) => findBlockedMarketplaceTerms(value).length > 0;

export const findSuspiciousMarketplaceTerms = (value) => {
  const normalizedValue = normalizeComplianceText(value);
  if (!normalizedValue) return [];

  return SUSPICIOUS_MARKETPLACE_TERMS.filter((term) => normalizedValue.includes(term));
};

export const getBlockedContentMessage = (contentType = 'listing') =>
  `This ${contentType} appears to mention illegal, unsafe, prohibited, or infringing items. Remove those references before submitting.`;

export const getSuspiciousContentMessage = (contentType = 'listing') =>
  `This ${contentType} asks buyers to pay early, move to untrusted channels, or skip inspection. Remove that language before submitting.`;

export const isBasicSellerVerificationComplete = (profile = {}) => {
  const contactPhone = String(profile.contactPhone || profile.phone || '')
    .replace(/\D/g, '')
    .slice(-10);
  const city = String(profile.city || '').trim();
  const state = String(profile.state || '').trim();
  const email = String(profile.email || '').trim();

  return Boolean(
    contactPhone.length === 10 &&
      city &&
      state &&
      email &&
      profile.sellerContactConsent === true &&
      profile.sellerRulesAccepted === true
  );
};

export const getSellerVerificationSummary = (profile = {}) =>
  isBasicSellerVerificationComplete(profile) ? 'Basic seller check completed' : 'Basic seller check pending';

export const getSellerVerificationDetail = (profile = {}) =>
  isBasicSellerVerificationComplete(profile)
    ? 'Self-declared seller identity, contact details, and marketplace declarations are on file.'
    : 'Seller has not yet completed the required marketplace declarations for a verified listing.';

export const getReportSeverity = (reason = '') => {
  const normalizedReason = normalizeComplianceText(reason);
  if (!normalizedReason) return 'medium';
  if (
    normalizedReason.includes('suspicious payment')
    || normalizedReason.includes('unsafe meetup')
    || normalizedReason.includes('counterfeit')
    || normalizedReason.includes('prohibited')
  ) {
    return 'high';
  }
  if (normalizedReason.includes('spam') || normalizedReason.includes('wrong category')) {
    return 'low';
  }
  return 'medium';
};

export const buildListingTrustFlags = (listing = {}) => {
  const flags = [];
  const combinedText = `${listing.title || ''} ${listing.description || ''} ${listing.successNote || ''}`;
  const suspiciousTerms = findSuspiciousMarketplaceTerms(combinedText);
  const blockedTerms = findBlockedMarketplaceTerms(combinedText);
  const normalizedTitle = normalizeComplianceText(listing.title || '');

  if (listing.sellerVerificationStatus !== 'basic-self-declared') {
    flags.push('Seller verification pending');
  }
  if (suspiciousTerms.length > 0) {
    flags.push(`Suspicious wording: ${suspiciousTerms.join(', ')}`);
  }
  if (blockedTerms.length > 0) {
    flags.push(`Blocked terms detected: ${blockedTerms.join(', ')}`);
  }
  if (!String(listing.description || '').trim() || String(listing.description || '').trim().length < 40) {
    flags.push('Description is too thin to build buyer trust');
  }
  if (!String(listing.colony || '').trim()) {
    flags.push('Pickup area missing');
  }
  if (/(.)\1{3,}/.test(normalizedTitle)) {
    flags.push('Noisy title pattern');
  }

  return flags;
};
