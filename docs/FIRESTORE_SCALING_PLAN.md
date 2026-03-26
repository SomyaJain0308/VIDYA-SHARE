# Firestore Scaling Plan

## Recommended Schema

### `users/{uid}`
- Private account profile.
- Owner-only read/write.
- Keep sensitive fields here only: `email`, `phone`, `contactPhone`, legal identity fields.

### `publicProfiles/{uid}`
- Small public seller summary.
- Use only fields needed in public UI:
  - `displayName`
  - `primarySchool`
  - `sellerContactConsent`
  - `sellerVerificationStatus`
  - `basicSellerVerificationCompleted`

### `privateContacts/{uid}`
- Separate private contact reveal record.
- Readable only by the owner or by a logged event-driven reveal.

### `notices/{listingId}`
- Canonical seller-owned listing record.
- Keep seller-facing workflow fields here:
  - `status`
  - `reservedForBuyerId`
  - `reservedForBuyerName`
  - `soldAt`
  - `photoPaths`
  - compliance fields
- This collection should be paged, never fully read by the feed.

### `publicListings/{listingId}`
- Public-safe read model for listing detail and future guest feed use.
- Duplicate only feed/detail-safe fields:
  - `title`, `description`, `price`
  - `condition`, `classGrade`, `subject`, `colony`
  - `sellerName`, `sellerSchool`, `sellerVerificationStatus`
  - `sellerContactConsent`
  - `photoUrl`, `photoUrls`
  - `status`

### `requests/{requestId}`
- Public request board.
- Store only lightweight request summary fields:
  - `text`, `normalizedText`, `keywords`
  - `subject`, `budget`, `urgency`
  - `requesterName`, `requesterSchool`
  - `status`, `matchedCount`
- Board reads should query only `open` and `matched`.

### `dealRequests/{listingId}_{buyerId}`
- One reserve request per buyer per listing.
- Use deterministic IDs for duplicate protection.
- Seller workflow fields:
  - `status`
  - `acceptedAt`, `rejectedAt`, `completedAt`
  - `preferredMeetup`, `preferredTime`

### `savedOffers/{uid}_{listingId}`
- One saved record per user/listing.
- Deterministic ID prevents duplicates.

## Query Rules

- Feed:
  - query `notices`
  - order by `createdAt desc`
  - page with `limit` + `startAfter`
- Request board:
  - query `requests`
  - filter `status in ['open', 'matched']`
  - order by `createdAt desc`
  - cap board reads to recent documents
- My Listings:
  - query `notices where sellerId == uid orderBy createdAt desc`
- My Requests:
  - query `requests where requesterId == uid orderBy createdAt desc`
- Seller pickup inbox:
  - query `dealRequests where sellerId == uid orderBy createdAt desc`
- Matching:
  - never scan the full `notices` or `requests` collection
  - first fetch a bounded candidate set by `status`, optional `subject`, and recency
  - then apply fuzzy matching in memory on that smaller candidate set

## Consistency Rules

- Listing delete must also remove:
  - `publicListings/{listingId}`
  - linked `savedOffers`
  - linked `dealRequests`
  - linked `reports`
- Accepting a reserve request should:
  - reserve the listing
  - update the accepted `dealRequests` document
  - reject sibling pending requests for the same listing
- Completing a reserve request should:
  - mark the listing as sold
  - mark the winning deal as completed
  - reject remaining sibling requests
- Reopening a reserved listing should clear reservation fields.

## What Breaks At 1000+ Users

- Full collection reads in the feed or request board become expensive and slow.
- Client-side matching over every listing/request becomes unbounded.
- Per-listing N+1 reads for seller profile lookups multiply read costs.
- Multi-step status writes drift under retries and multi-tab use.

## Next Steps Beyond This Patch

- Move guest feed reads to `publicListings` once list access is intentionally allowed by rules.
- Add a dedicated search service for full-text lookup if catalog size grows beyond a few thousand listings.
- Add server-side counters or analytics documents instead of deriving marketplace metrics from raw collections.
- Move high-integrity write flows to Cloud Functions if moderation or payment workflows are added later.
