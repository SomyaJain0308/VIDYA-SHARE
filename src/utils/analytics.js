import { logAnalyticsEvent, setAnalyticsUserProperties } from '../firebase';

const trimString = (value, max = 100) => String(value || '').trim().slice(0, max);

const sanitizeValue = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string') return trimString(value, 100);
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    const nextArray = value
      .map((entry) => sanitizeValue(entry))
      .filter((entry) => entry !== undefined);
    return nextArray.length > 0 ? nextArray : undefined;
  }
  if (typeof value === 'object') {
    const nextObject = Object.fromEntries(
      Object.entries(value)
        .map(([key, entry]) => [key, sanitizeValue(entry)])
        .filter(([, entry]) => entry !== undefined)
    );
    return Object.keys(nextObject).length > 0 ? nextObject : undefined;
  }
  return undefined;
};

const sanitizeParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params)
      .map(([key, value]) => [key, sanitizeValue(value)])
      .filter(([, value]) => value !== undefined)
  );

const buildPriceBucket = (price) => {
  const priceValue = Number(price || 0);
  if (!Number.isFinite(priceValue) || priceValue <= 0) return 'free';
  if (priceValue < 200) return 'under_200';
  if (priceValue <= 500) return '200_to_500';
  return 'over_500';
};

const buildBudgetBucket = (budget) => {
  const budgetValue = Number(budget || 0);
  if (!Number.isFinite(budgetValue) || budgetValue <= 0) return 'open';
  if (budgetValue < 200) return 'under_200';
  if (budgetValue <= 500) return '200_to_500';
  return 'over_500';
};

const buildListingItem = (listing = {}) => ({
  item_id: trimString(listing.id || listing.noticeId || '', 80),
  item_name: trimString(listing.title || listing.noticeTitle || 'Listing', 100),
  item_category: 'Books',
  item_variant: trimString(listing.condition || 'Not specified', 40),
  price: Number.isFinite(Number(listing.price)) ? Number(listing.price) : 0,
  quantity: 1,
});

const buildListingContext = (listing = {}) => ({
  listing_id: trimString(listing.id || listing.noticeId || '', 80),
  listing_status: trimString(listing.status || 'active', 24),
  class_grade: trimString(listing.classGrade || '', 40),
  condition: trimString(listing.condition || '', 40),
  location_area: trimString(listing.colony || '', 60),
  price_bucket: buildPriceBucket(listing.price),
  seller_verification: listing.sellerVerificationStatus === 'basic-self-declared' ? 'verified' : 'pending',
});

export const trackAppOpen = async ({ entryPath = '/', pageType = 'home' } = {}) =>
  logAnalyticsEvent('app_open', sanitizeParams({
    entry_path: entryPath,
    page_type: pageType,
  }));

export const trackPageVisit = async ({ path = '/', pageType = 'home', routeName = '' } = {}) =>
  logAnalyticsEvent('page_view', sanitizeParams({
    page_path: path,
    page_type: pageType,
    route_name: routeName || pageType,
    page_location: typeof window !== 'undefined' ? window.location.href : path,
    page_title: typeof document !== 'undefined' ? document.title : '',
  }));

export const trackListingClick = async ({ listing, surface = 'feed', authState = 'guest', index = null } = {}) =>
  logAnalyticsEvent('select_item', sanitizeParams({
    item_list_name: surface,
    item_list_id: surface,
    index: typeof index === 'number' ? index + 1 : undefined,
    auth_state: authState,
    ...buildListingContext(listing),
    items: [buildListingItem(listing)],
  }));

export const trackListingView = async ({ listing, surface = 'listing_detail', authState = 'guest' } = {}) =>
  logAnalyticsEvent('view_item', sanitizeParams({
    auth_state: authState,
    surface,
    ...buildListingContext(listing),
    items: [buildListingItem(listing)],
  }));

export const trackListingSaved = async ({ listing, surface = 'feed', authState = 'signed_in' } = {}) =>
  logAnalyticsEvent('add_to_wishlist', sanitizeParams({
    auth_state: authState,
    surface,
    ...buildListingContext(listing),
    items: [buildListingItem(listing)],
  }));

export const trackContactInitiated = async ({
  listing,
  surface = 'listing_detail',
  authState = 'guest',
  contactState = 'available',
} = {}) =>
  logAnalyticsEvent('generate_lead', sanitizeParams({
    lead_type: 'contact_seller',
    contact_state: contactState,
    auth_state: authState,
    surface,
    ...buildListingContext(listing),
    items: [buildListingItem(listing)],
  }));

export const trackContactRevealSuccess = async ({
  listing,
  surface = 'listing_detail',
  authState = 'signed_in',
  channels = [],
} = {}) =>
  logAnalyticsEvent('contact_revealed', sanitizeParams({
    auth_state: authState,
    surface,
    channels,
    ...buildListingContext(listing),
  }));

export const trackListingCreated = async ({ listing } = {}) =>
  logAnalyticsEvent('listing_created', sanitizeParams({
    ...buildListingContext(listing),
    has_images: Number(listing?.imageCount || 0) > 0,
    items: [buildListingItem(listing)],
  }));

export const trackRequestCreated = async ({ request, matchedCount = 0 } = {}) =>
  logAnalyticsEvent('request_created', sanitizeParams({
    category: trimString(request?.category || 'Books', 40),
    subject: trimString(request?.subject || '', 40),
    urgency: trimString(request?.urgency || 'Anytime', 24),
    budget_bucket: buildBudgetBucket(request?.budget),
    matched_count: Number(matchedCount || 0),
    request_status: trimString(request?.status || 'open', 24),
  }));

export const syncAnalyticsUserContext = async ({
  isAuthenticated = false,
  role = '',
  primarySchool = '',
  isAdmin = false,
} = {}) =>
  setAnalyticsUserProperties(sanitizeParams({
    auth_state: isAuthenticated ? 'signed_in' : 'guest',
    account_role: role || 'unknown',
    has_school: Boolean(primarySchool),
    is_admin: Boolean(isAdmin),
  }));
