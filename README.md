# Vidya Share

A hyperlocal marketplace for students and parents to buy and sell used school books. Built for Saharanpur, designed to scale to any city.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white) ![Firebase](https://img.shields.io/badge/Firebase-10-FFCA28?logo=firebase&logoColor=black) ![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-4-646CFF?logo=vite&logoColor=white)

---

## What it does

Vidya Share connects families within a city who want to sell old textbooks with those who need them — reducing waste and saving money. The entire flow is peer-to-peer; no payments go through the app.

**Core features:**

- **Listings feed** — Browse active book listings with filters by school, subject, grade, and condition
- **Post a listing** — Sell books with up to 2 photos, condition rating, and price
- **Request board** — Post a "looking for" request; get notified when a matching listing appears
- **In-app chat** — Message sellers directly without sharing your phone number upfront
- **Deal requests** — Formally express intent to buy; seller can accept/reject
- **Saved offers** — Bookmark listings to revisit later
- **Seller profiles** — Public profiles with verification status and response speed
- **Admin panel** — Moderate listings, manage reports, and action flagged content
- **Report system** — Flag inappropriate listings with severity levels

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Framer Motion |
| Styling | Tailwind CSS |
| Backend / DB | Firebase Firestore |
| Auth | Firebase Authentication |
| Image storage | Cloudinary (unsigned upload preset) |
| Hosting | Firebase Hosting |
| Build | Vite |

---

## Project structure

```
src/
├── components/       # UI components (Feed, Chats, PostFlow, Admin, etc.)
├── utils/            # Business logic (listings, matching, chat, reporting)
├── hooks/            # Custom React hooks
├── data/             # Static data (schools list)
├── config/           # Compliance and app config
├── content/          # Legal documents
└── firebase.js       # Firebase init and analytics
```

---

## Local setup

### Prerequisites

- Node.js 18+
- A Firebase project with Firestore, Auth, and Hosting enabled
- A Cloudinary account with an unsigned upload preset

### 1. Clone and install

```bash
git clone https://github.com/SomyaJain0308/VIDYA-SHARE.git
cd VIDYA-SHARE
npm install
```

### 2. Configure environment

Create a `.env.local` file in the project root:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_FIREBASE_APPCHECK_SITE_KEY=your_recaptcha_v3_site_key

VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_upload_preset
VITE_CLOUDINARY_UPLOAD_FOLDER=vidyashare/listings
```

### 3. Deploy Firestore rules and indexes

```bash
npm install -g firebase-tools
firebase login
firebase use your_project_id
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### 4. Run locally

```bash
npm run dev
```

---

## Deployment

```bash
npm run build
firebase deploy
```

---

## Security model

Security is enforced entirely at the Firestore and Cloud Storage rules layer — there is no separate backend server.

- Users can only read/write their own private data
- Listing mutations are validated field-by-field in Firestore rules
- Rate limiting on deal requests and book requests is enforced server-side via `actionRateLimits` collection
- Admin privileges are granted via custom Firebase Auth claims (`admin: true`) — never from the client
- Storage uploads are restricted to authenticated owners, image MIME types only, and 5MB max

---

## License

MIT
