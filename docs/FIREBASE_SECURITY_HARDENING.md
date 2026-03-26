# Firebase Security Hardening

This repo now contains strict Firestore and Storage rules, App Check bootstrap, and client changes that keep phone numbers and emails out of public marketplace documents.

## What changed

- `firestore.rules` defaults to deny-all and only allows least-privilege access.
- `storage.rules` restricts uploads to authenticated users under their own UID path, images only, max 5 MB.
- `src/firebase.js` initializes Firebase Storage and App Check from environment variables.
- Public marketplace docs (`notices`, `requests`, `publicProfiles`) no longer store seller/requester email or phone.
- Public seller profile data is now minimized to display name, optional school, and marketplace trust flags.
- Private contact data now lives in `privateContacts/{uid}` and is revealed only after a logged-in buyer clicks `Contact Seller`.
- Every contact reveal writes a deterministic audit record in `contactRevealEvents/{sellerId}_{viewerId}`.
- Admin access now relies on Firebase custom claims instead of user profile flags.
- Listing image uploads moved from unsigned Cloudinary uploads to Firebase Storage.

## Data model

Use this separation for privacy-sensitive profile data:

- `users/{uid}`
  - private account/profile record owned by the user
  - includes phone, email, legal name, seller declarations, and other private settings
- `publicProfiles/{uid}`
  - public marketplace profile
  - includes `displayName`, optional `primarySchool`, `publicProfile`, and seller trust flags only
- `privateContacts/{uid}`
  - private seller contact record
  - includes `contactPhone`, `email`, `contactRevealEnabled`, and `revealPhone`
- `contactRevealEvents/{sellerId}_{viewerId}`
  - audit trail for controlled reveals
  - stores the seller, viewer, and listing that triggered the reveal

## Environment variables

Set these before production deployment:

```bash
VITE_FIREBASE_STORAGE_BUCKET=vidya-share-30112.firebasestorage.app
VITE_FIREBASE_APPCHECK_SITE_KEY=your_recaptcha_v3_site_key
```

Optional local debug token for App Check:

```bash
VITE_FIREBASE_APPCHECK_DEBUG_TOKEN=your_debug_token
```

## One-time legacy data scrub

Run this before deploying the new rules if production still contains old public phone/email fields:

```bash
node scripts/sanitize-firebase-data.mjs
```

What it does:

- removes `sellerPhone` and `sellerEmail` from `notices`
- removes `requesterPhone` from `requests`
- removes `recipientPhone` from `alerts`
- removes `email`, `legalName`, contact fields, and other legacy public fields from `publicProfiles`
- removes client-controlled privilege and reputation flags from `users`
- backfills `privateContacts` from the private `users` collection
- backfills listing fields required by the new rules when older documents are incomplete

## Deploy rules

```bash
firebase deploy --only firestore:rules,storage
```

## Admin access

Do not store admin state in Firestore documents. Use a Firebase custom claim instead:

```json
{
  "admin": true
}
```

Set that claim only from trusted server-side code such as the Firebase Admin SDK or a protected Cloud Function. The client now checks `request.auth.token.admin == true`.

## API key restrictions

Firebase web API keys are identifiers, not secrets, but you should still lock them down in Google Cloud Console:

1. Open Google Cloud Console for this Firebase project.
2. Go to `APIs & Services` -> `Credentials`.
3. Open the web API key used by the app.
4. Under `Application restrictions`, choose `HTTP referrers (web sites)`.
5. Allow only your real origins, for example:
   - `https://vidya-share-30112.web.app/*`
   - `https://vidya-share-30112.firebaseapp.com/*`
   - `http://localhost:5173/*`
6. Under `API restrictions`, allow only the APIs the app actually needs:
   - `Identity Toolkit API`
   - `Token Service API`
   - `Cloud Firestore API`
   - `Firebase Storage API`
   - `Firebase App Check API`

## App Check enforcement

Bootstrap is now in the client, but you still must enable enforcement in Firebase Console:

1. Open Firebase Console -> `Build` -> `App Check`.
2. Register the web app with reCAPTCHA v3.
3. Copy the site key into `VITE_FIREBASE_APPCHECK_SITE_KEY`.
4. Turn on enforcement for:
   - Firestore
   - Storage
   - Authentication, if available in your Firebase console for this project
5. Keep debug tokens disabled outside local development.

## Abuse protection notes

- `publicProfiles` and `privateContacts` deny collection listing, which makes bulk scraping materially harder from the client.
- `privateContacts` can only be fetched by the owner or by a logged-in user after a matching `contactRevealEvents` document exists.
- `contactRevealEvents` are keyed by seller and viewer, so repeated clicks do not create unbounded reveal records.
- App Check should be enforced on Firestore, Storage, and Authentication where available before launch.

## Rollout order

1. Run `node scripts/sanitize-firebase-data.mjs`.
2. Set the required environment variables.
3. Deploy the app build.
4. Deploy Firestore and Storage rules.
5. Enable App Check enforcement in Firebase Console.
6. Restrict the API key by origin and API.
7. Set admin custom claims for trusted operators only.
