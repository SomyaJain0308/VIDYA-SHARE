import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Send, Loader2, Radar, Sparkles } from 'lucide-react';
import RequestBoard from './RequestBoard';
import { sendLocalNotification } from '../utils/notifications';
import { normalizeText, extractKeywords, isLikelyMatch } from '../utils/matching';

export default function Requests({ userProfile, onRequireAuth }) {
  const [requests, setRequests] = useState([]);
  const [newRequest, setNewRequest] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [recencyFilter, setRecencyFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requesterContactPhone = userProfile?.contactPhone || userProfile?.phone || auth.currentUser?.phoneNumber || '';

  const getRecencyCutoffMs = (value) => {
    const now = Date.now();
    if (value === '24h') return now - 24 * 60 * 60 * 1000;
    if (value === '7d') return now - 7 * 24 * 60 * 60 * 1000;
    if (value === '30d') return now - 30 * 24 * 60 * 60 * 1000;
    return null;
  };

  useEffect(() => {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reqs = [];
      snapshot.forEach((entry) => reqs.push({ id: entry.id, ...entry.data() }));
      setRequests(reqs);
    });
    return () => unsubscribe();
  }, []);

  const pingPotentialSellers = async ({ requestId, requestText, requestKeywords }) => {
    try {
      const noticesSnapshot = await getDocs(collection(db, 'notices'));
      let pingCount = 0;

      for (const noticeDoc of noticesSnapshot.docs) {
        const notice = noticeDoc.data();
        if (!notice?.sellerId) continue;
        if (notice.status && notice.status !== 'active') continue;

        const noticeText = `${notice.title || ''} ${notice.category || ''} ${notice.school || ''}`;
        const noticeKeywords = Array.isArray(notice.keywords) ? notice.keywords : extractKeywords(noticeText);
        const matched = isLikelyMatch(requestText, noticeText, requestKeywords, noticeKeywords);
        if (!matched) continue;

        const alertId = `request_${requestId}_seller_${notice.sellerId}`;
        await setDoc(doc(db, 'alerts', alertId), {
          type: 'request_match',
          recipientId: notice.sellerId,
          recipientPhone: notice.sellerPhone || '',
          requestId,
          noticeId: noticeDoc.id,
          title: 'Wishlist Match',
          body: `Someone requested: "${requestText}". You may have a match.`,
          read: false,
          createdAt: serverTimestamp(),
        });
        pingCount += 1;
      }

      if (pingCount > 0) {
        sendLocalNotification('Request Posted', `We pinged ${pingCount} potential seller${pingCount > 1 ? 's' : ''}.`);
      }
    } catch (error) {
      console.error('Failed to ping sellers for request', error);
    }
  };

  const handlePostRequest = async (e) => {
    e.preventDefault();
    if (!newRequest.trim()) return;
    if (!auth.currentUser) {
      if (onRequireAuth) onRequireAuth();
      alert('Please log in to post a request.');
      return;
    }
    setIsSubmitting(true);
    try {
      const trimmedRequest = newRequest.trim();
      const requestKeywords = extractKeywords(trimmedRequest);
      const requestDoc = await addDoc(collection(db, 'requests'), {
        text: trimmedRequest,
        normalizedText: normalizeText(trimmedRequest),
        keywords: requestKeywords,
        requesterId: auth.currentUser.uid,
        requesterPhone: requesterContactPhone,
        createdAt: serverTimestamp(),
      });
      await pingPotentialSellers({
        requestId: requestDoc.id,
        requestText: trimmedRequest,
        requestKeywords,
      });
      setNewRequest('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const recencyCutoffMs = getRecencyCutoffMs(recencyFilter);

  const filteredRequests = requests.filter((request) => {
    if (normalizedSearch && !(request.text || '').toLowerCase().includes(normalizedSearch)) {
      return false;
    }
    if (!recencyCutoffMs) return true;
    const createdMs = request.createdAt?.toMillis?.() || request.createdAt?.toDate?.()?.getTime?.() || 0;
    return createdMs >= recencyCutoffMs;
  });

  return (
    <div className="mx-auto w-full max-w-[1380px] px-3 pb-14 pt-4 sm:px-6 lg:px-8">
      <div className="grid gap-4 xl:grid-cols-[minmax(360px,490px)_minmax(0,1fr)] 2xl:grid-cols-[500px_minmax(0,1fr)]">
        <section className="glass-panel h-fit rounded-[1.6rem] p-5 sm:p-6 xl:sticky xl:top-24">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200/25 bg-amber-200/10 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-amber-100 uppercase">
                <Radar className="h-3.5 w-3.5" />
                Live Requests
              </p>
              <h2 className="font-display text-2xl font-semibold text-amber-50">Find or Request</h2>
              <p className="mt-1 text-sm text-amber-100/75">Need a specific item? Post once and nearby sellers get notified.</p>
            </div>
            <div className="hidden rounded-xl border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-xs font-semibold text-amber-100 md:flex md:items-center md:gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              Intent matching
            </div>
          </div>

          <form onSubmit={handlePostRequest} className="relative">
            <input
              type="text"
              placeholder="e.g., Looking for Class 10 RD Sharma"
              className="w-full rounded-2xl border border-amber-200/20 bg-[#161006] p-4 pr-14 font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
              value={newRequest}
              onChange={(e) => setNewRequest(e.target.value)}
              required
            />
            <button
              disabled={isSubmitting}
              type="submit"
              className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-xl bg-amber-200 p-2.5 text-[#342406] transition hover:brightness-105 active:scale-95"
              aria-label="Post request"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </section>

        <div className="min-w-0">
          <div className="glass-panel mb-3 rounded-2xl p-4 sm:p-5">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search requests"
                className="w-full rounded-xl border border-amber-200/20 bg-[#161006] px-4 py-2.5 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
              />
              <select
                value={recencyFilter}
                onChange={(e) => setRecencyFilter(e.target.value)}
                className="rounded-xl border border-amber-200/20 bg-[#161006] px-3 py-2.5 text-sm font-medium text-amber-100 outline-none focus:border-amber-200/45"
              >
                <option value="all" className="bg-[#161006]">All</option>
                <option value="24h" className="bg-[#161006]">24h</option>
                <option value="7d" className="bg-[#161006]">7d</option>
                <option value="30d" className="bg-[#161006]">30d</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setRecencyFilter('all');
                }}
                className="rounded-xl border border-amber-200/25 bg-[#161006] px-4 py-2.5 text-sm font-semibold text-amber-100/85 transition hover:bg-[#211608]"
              >
                Clear filters
              </button>
            </div>
          </div>
          <RequestBoard requests={filteredRequests} />
        </div>
      </div>
    </div>
  );
}
