import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, deleteDoc, doc, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { ShieldAlert, Trash2, Sparkles, Loader2, Database, ShieldCheck, AlertTriangle } from 'lucide-react';

const demoListings = [
  { title: 'Class 9 Science Textbook', category: 'Books', classGrade: '9', subject: 'Science', price: 220, condition: 'Good' },
  { title: 'Class 10 Maths Guide', category: 'Books', classGrade: '10', subject: 'Maths', price: 180, condition: 'Like New' },
  { title: 'Class 8 English Workbook', category: 'Books', classGrade: '8', subject: 'English', price: 90, condition: 'Fair' },
  { title: 'Class 11 Physics Notes Bundle', category: 'Books', classGrade: '11', subject: 'Physics', price: 150, condition: 'Good' },
  { title: 'Class 12 Chemistry PYQ Book', category: 'Books', classGrade: '12', subject: 'Chemistry', price: 240, condition: 'Like New' },
  { title: 'School Uniform Set - Medium', category: 'Uniforms', school: 'St. Marys Academy Saharanpur', size: 'M', price: 450, condition: 'Good' },
  { title: 'Winter Blazer - Class 7', category: 'Uniforms', school: 'Pinewood School Saharanpur', size: '30', price: 600, condition: 'Good' },
  { title: 'Sports Kit Shorts + Tee', category: 'Uniforms', school: 'Asha Modern School Saharanpur', size: '32', price: 250, condition: 'Fair' },
  { title: 'Girls Uniform Pair', category: 'Uniforms', school: 'Delhi Public School Saharanpur', size: '28', price: 500, condition: 'Like New' },
  { title: 'House T-Shirt Set', category: 'Uniforms', school: 'Sophia Girls High School Saharanpur', size: 'S', price: 200, condition: 'Good' },
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
  const [notices, setNotices] = useState([]);
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

    const unsubscribeNotices = onSnapshot(collection(db, 'notices'), (snapshot) => {
      const nextNotices = [];
      snapshot.forEach((entry) => nextNotices.push({ id: entry.id, ...entry.data() }));
      setNotices(nextNotices);
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
      unsubscribeNotices();
      unsubscribeRequests();
      unsubscribeUsers();
      unsubscribeDeals();
    };
  }, [isAdmin]);

  const metrics = useMemo(() => {
    const activeListings = notices.filter((notice) => (notice.status || 'active') === 'active').length;
    const openRequests = requests.filter((request) => (request.status || 'open') !== 'fulfilled').length;
    const completedHandovers = dealRequests.filter((deal) => (deal.status || 'pending') === 'completed').length;
    return {
      users: users.length,
      listings: notices.length,
      activeListings,
      openRequests,
      completedHandovers,
    };
  }, [notices, requests, users, dealRequests]);

  const suspiciousListings = useMemo(() => {
    const normalizedCount = {};
    notices.forEach((notice) => {
      const normalized = normalizeTitle(notice.title);
      if (!normalized) return;
      normalizedCount[normalized] = (normalizedCount[normalized] || 0) + 1;
    });

    return notices.filter((notice) => {
      const normalized = normalizeTitle(notice.title);
      const duplicateByTitle = normalized && normalizedCount[normalized] > 1;
      const noisyTitle = /(.)\1{3,}/.test(String(notice.title || '').toLowerCase());
      const missingSeller = !notice.sellerId || !notice.sellerPhone;
      return duplicateByTitle || noisyTitle || missingSeller;
    });
  }, [notices]);

  const handleDismissReport = async (reportId) => {
    if (!window.confirm('Dismiss this report?')) return;
    try {
      await deleteDoc(doc(db, 'reports', reportId));
    } catch (error) {
      console.error('Error deleting report:', error);
    }
  };

  const handleRemoveListing = async (listingId) => {
    if (!window.confirm('Delete this listing from marketplace?')) return;
    try {
      await deleteDoc(doc(db, 'notices', listingId));
      const reportSnapshot = await getDocs(collection(db, 'reports'));
      const linkedReports = reportSnapshot.docs.filter((entry) => entry.data()?.reportedItemId === listingId);
      await Promise.all(linkedReports.map((entry) => deleteDoc(doc(db, 'reports', entry.id))));
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
          return addDoc(collection(db, 'notices'), {
            ...listing,
            successNote: 'Demo listing for marketplace preview.',
            colony: 'Mission Compound',
            sellerName: 'Demo Seller',
            sellerSchool: listing.school || 'Saharanpur',
            sellerId: `demo-seller-${(index % 3) + 1}`,
            sellerPhone: `98976010${String(index).padStart(2, '0')}`,
            photoUrl: imageUrl,
            keywords: normalizeTitle(`${listing.title} ${listing.subject || ''} ${listing.school || ''}`).split(' '),
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
              <p className="text-sm font-medium text-slate-100">Listing: {report.reportedItemId || 'Unknown'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => handleDismissReport(report.id)}
                  className="rounded-lg border border-amber-200/30 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-100/10"
                >
                  Dismiss
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
