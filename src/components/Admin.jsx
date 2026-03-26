import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ShieldAlert, Trash2, Sparkles, Loader2, Database, ShieldCheck, AlertTriangle } from 'lucide-react';
import { buildListingTrustFlags, findBlockedMarketplaceTerms } from '../utils/marketplaceCompliance';
import { deleteListingWithRelations } from '../utils/listingIntegrity';

const demoListings = [
  { title: 'Science Textbook Set', category: 'Books', subject: 'Science', price: 220, condition: 'Good' },
  { title: 'Maths Practice Guide', category: 'Books', subject: 'Maths', price: 180, condition: 'Like New' },
  { title: 'English Workbook', category: 'Books', subject: 'English', price: 90, condition: 'Fair' },
  { title: 'Physics Notes Bundle', category: 'Books', subject: 'Physics', price: 150, condition: 'Good' },
  { title: 'Chemistry PYQ Book', category: 'Books', subject: 'Chemistry', price: 240, condition: 'Like New' },
  { title: 'Campus Essentials Set - Medium', category: 'Uniforms', school: 'City Montessori School, Gomti Nagar I', size: 'M', price: 450, condition: 'Good' },
  { title: 'Winter Blazer', category: 'Uniforms', school: 'Delhi Public School, Saharanpur', size: '30', price: 600, condition: 'Good' },
  { title: 'Sports Kit Shorts + Tee', category: 'Uniforms', school: 'Delhi Public School, Shaheed Path', size: '32', price: 250, condition: 'Fair' },
  { title: 'Girls Essentials Pair', category: 'Uniforms', school: 'Seth M.R. Jaipuria School, Vineet Khand', size: '28', price: 500, condition: 'Like New' },
  { title: 'House T-Shirt Set', category: 'Uniforms', school: 'St. Agnes\' Loreto Day School', size: 'S', price: 200, condition: 'Good' },
];

const randomImagePool = [
  'https://images.unsplash.com/photo-1491841573634-28140fc7ced7?auto=format&fit=crop&w=1080&q=80',
  'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1080&q=80',
  'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=1080&q=80',
  'https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=1080&q=80',
];

const normalizeTitle = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export default function Admin({ isAdmin = false }) {
  const [reports, setReports] = useState([]);
  const [listings, setListings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [dealRequests, setDealRequests] = useState([]);
  const [seedLoading, setSeedLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) return undefined;

    const unsubscribeReports = onSnapshot(collection(db, 'reports'), (snapshot) => {
      const nextReports = [];
      snapshot.forEach((entry) => nextReports.push({ id: entry.id, ...entry.data() }));
      setReports(nextReports);
    });

    const unsubscribeListings = onSnapshot(collection(db, 'publicListings'), (snapshot) => {
      const nextListings = [];
      snapshot.forEach((entry) => nextListings.push({ id: entry.id, ...entry.data() }));
      setListings(nextListings);
    });

    const unsubscribeRequests = onSnapshot(collection(db, 'requests'), (snapshot) => {
      const nextRequests = [];
      snapshot.forEach((entry) => nextRequests.push({ id: entry.id, ...entry.data() }));
      setRequests(nextRequests);
    });

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const nextUsers = [];
      snapshot.forEach((entry) => nextUsers.push({ id: entry.id, ...entry.data() }));
      setUsers(nextUsers);
    });

    const unsubscribeDeals = onSnapshot(collection(db, 'dealRequests'), (snapshot) => {
      const nextDeals = [];
      snapshot.forEach((entry) => nextDeals.push({ id: entry.id, ...entry.data() }));
      setDealRequests(nextDeals);
    });

    return () => {
      unsubscribeReports();
      unsubscribeListings();
      unsubscribeRequests();
      unsubscribeUsers();
      unsubscribeDeals();
    };
  }, [isAdmin]);

  const metrics = useMemo(() => {
    const activeListings = listings.filter((listing) => (listing.status || 'active') === 'active').length;
    const openRequests = requests.filter((request) => (request.status || 'open') !== 'fulfilled').length;
    const completedHandovers = dealRequests.filter((deal) => (deal.status || 'pending') === 'completed').length;
    const openReports = reports.filter((report) => (report.status || 'open') !== 'resolved').length;
    return {
      users: users.length,
      listings: listings.length,
      activeListings,
      openRequests,
      completedHandovers,
      openReports,
    };
  }, [listings, requests, users, dealRequests, reports]);

  const suspiciousListings = useMemo(() => {
    const normalizedCount = {};
    listings.forEach((listing) => {
      const normalized = normalizeTitle(listing.title);
      if (!normalized) return;
      normalizedCount[normalized] = (normalizedCount[normalized] || 0) + 1;
    });

    return listings.filter((listing) => {
      const normalized = normalizeTitle(listing.title);
      const duplicateByTitle = normalized && normalizedCount[normalized] > 1;
      const trustFlags = buildListingTrustFlags(listing);
      const blockedTerms = findBlockedMarketplaceTerms(`${listing.title || ''} ${listing.description || ''} ${listing.subject || ''} ${listing.successNote || ''}`);
      return duplicateByTitle || trustFlags.length > 0 || blockedTerms.length > 0;
    });
  }, [listings]);

  const suspiciousSellerSummaries = useMemo(() => {
    const reportCountBySeller = reports.reduce((acc, report) => {
      const sellerId = report.sellerId || '';
      if (!sellerId) return acc;
      acc[sellerId] = (acc[sellerId] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(reportCountBySeller)
      .map(([sellerId, reportCount]) => {
        const sellerListings = listings.filter((listing) => listing.sellerId === sellerId);
        const suspiciousCount = sellerListings.filter((listing) => buildListingTrustFlags(listing).length > 0).length;
        const sellerName = sellerListings[0]?.sellerName || sellerId;
        return {
          sellerId,
          sellerName,
          reportCount,
          suspiciousCount,
        };
      })
      .filter((entry) => entry.reportCount > 0 || entry.suspiciousCount > 0)
      .sort((a, b) => (b.reportCount + b.suspiciousCount) - (a.reportCount + a.suspiciousCount))
      .slice(0, 8);
  }, [listings, reports]);

  const handleUpdateReportStatus = async (reportId, nextStatus) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status: nextStatus,
        resolvedAt: nextStatus === 'resolved' ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating report:', error);
    }
  };

  const handleRemoveListing = async (listingId) => {
    if (!window.confirm('Delete this listing from marketplace?')) return;
    try {
      await deleteListingWithRelations({ db, listingId });
    } catch (error) {
      console.error('Error deleting listing:', error);
    }
  };

  const seedDemoListings = async () => {
    if (seedLoading) return;
    if (!window.confirm('Create 10 demo listings for preview?')) return;
    setSeedLoading(true);
    try {
      await Promise.all(
        demoListings.map((listing, index) => {
          const imageUrl = randomImagePool[index % randomImagePool.length];
          return addDoc(collection(db, 'publicListings'), {
            ...listing,
            description: 'Demo listing for marketplace preview only. Replace with a real description before launch.',
            successNote: 'Demo listing for marketplace preview.',
            colony: 'Gomti Nagar',
            sellerName: 'Demo Seller',
            sellerSchool: listing.school || 'Saharanpur',
            sellerId: `demo-seller-${(index % 3) + 1}`,
            sellerRole: 'Parent',
            sellerContactConsent: false,
            photoUrl: imageUrl,
            photoUrls: [imageUrl],
            imageCount: 1,
            sellerVerificationStatus: 'pending',
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            isDemo: true,
          });
        })
      );
      alert('Demo listings added.');
    } catch (error) {
      console.error('Failed to seed demo listings', error);
      alert('Could not seed demo listings right now.');
    } finally {
      setSeedLoading(false);
    }
  };

  if (!isAdmin) {
    return <div className="p-20 text-center text-sm font-semibold text-rose-200">Access denied.</div>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-5 sm:px-6">
      <div className="mb-6 flex items-center gap-4">
        <div className="rounded-2xl border border-rose-100/30 bg-rose-300/15 p-3 text-rose-100">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="font-display text-3xl font-semibold text-white">Control Room</h1>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-amber-100/62">Users</p>
          <p className="font-display mt-1 text-3xl font-semibold text-amber-50">{metrics.users}</p>
        </div>
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-amber-100/62">Listings</p>
          <p className="font-display mt-1 text-3xl font-semibold text-amber-50">{metrics.listings}</p>
        </div>
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-amber-100/62">Active</p>
          <p className="font-display mt-1 text-3xl font-semibold text-amber-50">{metrics.activeListings}</p>
        </div>
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-amber-100/62">Open Requests</p>
          <p className="font-display mt-1 text-3xl font-semibold text-amber-50">{metrics.openRequests}</p>
        </div>
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-amber-100/62">Handovers</p>
          <p className="font-display mt-1 text-3xl font-semibold text-emerald-200">{metrics.completedHandovers}</p>
        </div>
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-amber-100/62">Open Reports</p>
          <p className="font-display mt-1 text-3xl font-semibold text-rose-100">{metrics.openReports}</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={seedDemoListings}
          disabled={seedLoading}
          className="btn-primary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {seedLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          Seed 10 Demo Listings
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-panel rounded-[1.8rem] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <ShieldAlert className="h-5 w-5 text-rose-200" />
            Active Reports ({reports.length})
          </h2>
          {reports.length === 0 && <p className="text-sm text-slate-100/75">No active reports.</p>}
          {reports.map((report) => (
            <div key={report.id} className="mb-2 rounded-xl border border-slate-200/20 bg-slate-900/35 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-100">{report.noticeTitle || report.reportedItemId || 'Unknown listing'}</p>
                  <p className="mt-1 text-xs text-slate-100/70">Seller: {report.sellerName || report.sellerId || 'Unknown'}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                  <span className="rounded-full border border-slate-200/20 bg-white/5 px-2.5 py-1 text-slate-100/82">
                    {report.status || 'open'}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 ${
                    report.severity === 'high'
                      ? 'bg-rose-300/85 text-[#4a1b25]'
                      : report.severity === 'low'
                        ? 'bg-amber-200/85 text-[#3a2608]'
                        : 'bg-cyan-200 text-[#082231]'
                  }`}>
                    {report.severity || 'medium'}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-100/70">Reporter: {report.reporterName || report.reporterId || 'Unknown'}</p>
              <p className="mt-1 text-xs text-slate-100/70">Reason: {report.reason || 'Not provided'}</p>
              {report.details ? (
                <p className="mt-2 rounded-lg border border-slate-200/12 bg-[#08111a]/88 p-2 text-xs leading-relaxed text-slate-100/78">
                  {report.details}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => handleUpdateReportStatus(report.id, 'reviewing')}
                  className="rounded-lg border border-amber-200/30 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-100/10"
                >
                  Mark reviewing
                </button>
                <button
                  onClick={() => handleUpdateReportStatus(report.id, 'resolved')}
                  className="rounded-lg border border-emerald-200/30 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-100/10"
                >
                  Resolve
                </button>
                {report.reportedItemId && (
                  <button
                    onClick={() => handleRemoveListing(report.reportedItemId)}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-300/85 px-3 py-1.5 text-xs font-semibold text-[#4a1b25] transition hover:bg-rose-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove listing
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="glass-panel rounded-[1.8rem] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <AlertTriangle className="h-5 w-5 text-amber-200" />
            Quality Flags ({suspiciousListings.length})
          </h2>
          {suspiciousListings.length === 0 && (
            <p className="inline-flex items-center gap-2 text-sm text-emerald-100">
              <ShieldCheck className="h-4 w-4" />
              No suspicious listings found right now.
            </p>
          )}
          {suspiciousListings.map((listing) => (
            <div key={listing.id} className="mb-2 rounded-xl border border-amber-200/20 bg-[#191208]/70 p-3">
              <p className="text-sm font-semibold text-amber-50">{listing.title || 'Untitled listing'}</p>
              <p className="mt-1 text-xs text-amber-100/70">Seller: {listing.sellerName || listing.sellerId || 'Unknown'}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                {buildListingTrustFlags(listing).map((flag) => (
                  <span
                    key={`${listing.id}-${flag}`}
                    className="rounded-full border border-amber-200/20 bg-amber-200/10 px-2.5 py-1 text-amber-50/90"
                  >
                    {flag}
                  </span>
                ))}
              </div>
              <button
                onClick={() => handleRemoveListing(listing.id)}
                className="mt-2 inline-flex items-center gap-1 rounded-lg bg-rose-300/85 px-3 py-1.5 text-xs font-semibold text-[#4a1b25] transition hover:bg-rose-200"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove listing
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel mt-6 rounded-[1.8rem] p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <AlertTriangle className="h-5 w-5 text-amber-200" />
          Seller Watchlist
        </h2>
        {suspiciousSellerSummaries.length === 0 ? (
          <p className="text-sm text-slate-100/75">No repeat-risk sellers are standing out right now.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {suspiciousSellerSummaries.map((seller) => (
              <div key={seller.sellerId} className="rounded-xl border border-slate-200/20 bg-slate-900/35 p-3">
                <p className="text-sm font-semibold text-white">{seller.sellerName}</p>
                <p className="mt-1 text-xs text-slate-100/70">Seller ID: {seller.sellerId}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                  <span className="rounded-full border border-rose-200/24 bg-rose-300/10 px-2.5 py-1 text-rose-100">
                    {seller.reportCount} report{seller.reportCount === 1 ? '' : 's'}
                  </span>
                  <span className="rounded-full border border-amber-200/24 bg-amber-200/10 px-2.5 py-1 text-amber-50">
                    {seller.suspiciousCount} flagged listing{seller.suspiciousCount === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel mt-6 rounded-[1.8rem] p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <Sparkles className="h-5 w-5 text-amber-200" />
          Ops Snapshot
        </h2>
        <p className="text-sm text-amber-100/85">
          Live moderation and growth metrics are now active: reports, listing quality flags, request volume, handover completion, and demo seeding for preview environments.
        </p>
      </div>
    </div>
  );
}
