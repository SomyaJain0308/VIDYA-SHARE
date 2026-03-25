import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Send, Loader2, Radar, Sparkles, Clock3, BookOpen, Wallet, Building2 } from 'lucide-react';
import { sendLocalNotification } from '../utils/notifications';
import { normalizeText, extractKeywords, isLikelyMatch } from '../utils/matching';
import { normalizeSchoolInput } from '../data/schools';

const requestCategoryOptions = ['Books'];
const urgencyOptions = ['Anytime', 'This week', 'Urgent'];

const includesToken = (sourceValue, targetValue) => {
  const source = normalizeText(sourceValue);
  const target = normalizeText(targetValue);
  if (!source || !target) return true;
  return source.includes(target) || target.includes(source);
};

const formatRequestTime = (timestamp) => {
  if (!timestamp?.toDate) return 'Just now';
  const seconds = Math.floor((Date.now() - timestamp.toDate().getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default function Requests({ userProfile, onRequireAuth }) {
  const NETWORK_CITY = 'Lucknow';
  const [requests, setRequests] = useState([]);
  const [formData, setFormData] = useState({
    text: '',
    category: 'Books',
    subject: '',
    school: '',
    budget: '',
    urgency: 'Anytime',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const requesterContactPhone = userProfile?.contactPhone || userProfile?.phone || auth.currentUser?.phoneNumber || '';
  const currentUserId = auth.currentUser?.uid || '';
  const visibleRequests = requests.slice(0, 8);

  useEffect(() => {
    const requestsQuery = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
      const nextRequests = [];
      snapshot.forEach((entry) => nextRequests.push({ id: entry.id, ...entry.data() }));
      setRequests(nextRequests);
    });
    return () => unsubscribe();
  }, []);

  const pingPotentialSellers = async ({
    requestId,
    requestText,
    requestKeywords,
    requestCategory,
    requestSchool,
    requestSubject,
    requestBudget,
  }) => {
    try {
      const noticesSnapshot = await getDocs(collection(db, 'notices'));
      let pingCount = 0;

      for (const noticeDoc of noticesSnapshot.docs) {
        const notice = noticeDoc.data();
        if (!notice?.sellerId) continue;
        if (notice.status && notice.status !== 'active') continue;
        if (requestCategory && notice.category !== requestCategory) continue;
        if (requestSubject && !includesToken(notice.subject, requestSubject)) continue;
        if (typeof requestBudget === 'number' && requestBudget > 0) {
          const noticePrice = Number(notice.price || 0);
          if (noticePrice > requestBudget) continue;
        }

        const noticeText = `${notice.title || ''} ${notice.category || ''} ${notice.school || ''} ${notice.classGrade || ''} ${notice.subject || ''}`;
        const noticeKeywords = Array.isArray(notice.keywords) ? notice.keywords : extractKeywords(noticeText);
        const matched = isLikelyMatch(requestText, noticeText, requestKeywords, noticeKeywords);
        if (!matched) continue;

        const alertId = `request_${requestId}_seller_${notice.sellerId}_${noticeDoc.id}`;
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

      return pingCount;
    } catch (error) {
      console.error('Failed to ping sellers for request', error);
      return 0;
    }
  };

  const handlePostRequest = async (event) => {
    event.preventDefault();
    const trimmedRequest = formData.text.trim();
    const cleanSubject = formData.subject.trim();
    const budgetValue = Number(formData.budget || 0);

    if (!trimmedRequest) return;
    if (!auth.currentUser) {
      if (onRequireAuth) onRequireAuth();
      alert('Please log in to post a request.');
      return;
    }
    if (!requesterContactPhone) {
      setSubmitError('Add a contact number in profile before posting requests so sellers can respond.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const requestSearchText = `${trimmedRequest} ${formData.category} ${cleanSubject}`.trim();
      const requestKeywords = extractKeywords(requestSearchText);
      const requestPayload = {
        text: trimmedRequest,
        normalizedText: normalizeText(trimmedRequest),
        keywords: requestKeywords,
        category: formData.category,
        subject: cleanSubject,
        school: '',
        budget: Number.isNaN(budgetValue) ? 0 : budgetValue,
        urgency: formData.urgency,
        requesterId: auth.currentUser.uid,
        requesterName: userProfile?.displayName || auth.currentUser.displayName || 'Community member',
        requesterPhone: requesterContactPhone,
        requesterSchool: userProfile?.primarySchool || '',
        status: 'open',
        matchedCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const requestDoc = await addDoc(collection(db, 'requests'), requestPayload);
      const matches = await pingPotentialSellers({
        requestId: requestDoc.id,
        requestText: trimmedRequest,
        requestKeywords,
        requestCategory: requestPayload.category,
        requestSchool: '',
        requestSubject: cleanSubject,
        requestBudget: requestPayload.budget,
      });

      if (matches > 0) {
        await updateDoc(doc(db, 'requests', requestDoc.id), {
          status: 'matched',
          matchedCount: matches,
          updatedAt: serverTimestamp(),
        });
        sendLocalNotification('Request Matched', `${matches} potential seller${matches > 1 ? 's' : ''} found.`);
      } else {
        sendLocalNotification('Request Posted', 'Your request is live in the neighborhood board.');
      }

      setFormData({
        text: '',
        category: formData.category,
        subject: '',
        budget: '',
        urgency: 'Anytime',
      });
    } catch (error) {
      console.error('Request post failed', error);
      setSubmitError('Could not post request right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1650px] px-1 pb-14 pt-4 sm:px-2 lg:px-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,720px)_minmax(0,1fr)] xl:items-start">
        <section className="editorial-shell mx-auto w-full max-w-[720px] p-5 sm:p-6 xl:mx-0">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="section-kicker mb-2">
                <Radar className="h-3.5 w-3.5" />
                Request engine
              </p>
              <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl">Post what you need across {NETWORK_CITY}</h2>
            </div>
            <div className="hidden rounded-xl border border-cyan-300/14 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-cyan-50 md:flex md:items-center md:gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              Intent matching
            </div>
          </div>

          <form onSubmit={handlePostRequest} className="space-y-3">
            <textarea
              rows="2"
              placeholder="e.g., Looking for RD Sharma maths book"
              className="lux-textarea min-h-[104px] font-medium"
              value={formData.text}
              onChange={(event) => setFormData((prev) => ({ ...prev, text: event.target.value }))}
              required
            />

            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={formData.category}
                onChange={(event) => setFormData((prev) => ({ ...prev, category: event.target.value }))}
                className="lux-select text-sm font-medium"
              >
                {requestCategoryOptions.map((option) => (
                  <option key={option} value={option} className="bg-[#161006]">
                    {option}
                  </option>
                ))}
              </select>
              <select
                value={formData.urgency}
                onChange={(event) => setFormData((prev) => ({ ...prev, urgency: event.target.value }))}
                className="lux-select text-sm font-medium"
              >
                {urgencyOptions.map((option) => (
                  <option key={option} value={option} className="bg-[#161006]">
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <input
              type="text"
              placeholder="Subject or item detail (optional)"
              className="lux-input text-sm font-medium"
              value={formData.subject}
              onChange={(event) => setFormData((prev) => ({ ...prev, subject: event.target.value }))}
            />

            <input
              type="number"
              min="0"
              placeholder="Budget in Rs (optional)"
              className="lux-input text-sm font-medium"
              value={formData.budget}
              onChange={(event) => setFormData((prev) => ({ ...prev, budget: event.target.value }))}
            />

            <button
              disabled={isSubmitting}
              type="submit"
              className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-55"
              aria-label="Post request"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSubmitting ? 'Posting request...' : 'Post Request'}
            </button>
            {submitError && (
              <p className="rounded-lg border border-rose-200/45 bg-rose-300/20 px-3 py-2 text-sm font-semibold text-rose-100">
                {submitError}
              </p>
            )}
          </form>
        </section>

        <section className="lux-panel p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="section-kicker">Live Request Board</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">Students asking right now</h3>
              <p className="mt-2 text-sm text-cyan-50/72">A cleaner board helps sellers scan demand instead of guessing what people need.</p>
            </div>
            <div className="rounded-full border border-cyan-300/16 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-cyan-50/78">
              {requests.length} total requests
            </div>
          </div>

          {visibleRequests.length === 0 ? (
            <div className="lux-panel-soft flex min-h-[220px] flex-col items-center justify-center p-6 text-center">
              <Radar className="h-10 w-10 text-cyan-100/58" />
              <p className="mt-4 text-lg font-semibold text-white">No requests yet</p>
              <p className="mt-2 max-w-md text-sm text-cyan-50/68">Once students start posting needs, they’ll appear here as a structured board for quick scanning.</p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {visibleRequests.map((request) => {
                const status = request.status || 'open';
                const isOwnRequest = !!(currentUserId && request.requesterId === currentUserId);
                const statusClass =
                  status === 'matched'
                    ? 'bg-emerald-200/18 text-emerald-100 border-emerald-200/30'
                    : 'bg-cyan-300/10 text-cyan-50 border-cyan-300/18';

                return (
                  <article key={request.id} className="lux-panel-soft flex h-full flex-col p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-base font-semibold text-white">{request.text}</p>
                        <p className="mt-1 text-xs text-cyan-50/60">
                          by {request.requesterName || 'Community member'}
                          {isOwnRequest ? ' • Your request' : ''}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${statusClass}`}>
                        {status}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-cyan-50/76">
                      <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/14 bg-[#07111a]/78 px-2.5 py-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        {request.category || 'Books'}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/14 bg-[#07111a]/78 px-2.5 py-1">
                        <Clock3 className="h-3.5 w-3.5" />
                        {request.urgency || 'Anytime'}
                      </span>
                      {request.subject && (
                        <span className="rounded-full border border-cyan-300/14 bg-[#07111a]/78 px-2.5 py-1">
                          {request.subject}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid gap-2 text-xs text-cyan-50/68 sm:grid-cols-2">
                      <div className="rounded-2xl border border-cyan-300/12 bg-[#07111a]/78 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-50/50">Budget</p>
                        <p className="mt-1 inline-flex items-center gap-1 font-semibold text-cyan-50/86">
                          <Wallet className="h-3.5 w-3.5" />
                          {request.budget ? `Rs ${request.budget}` : 'Flexible'}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-cyan-300/12 bg-[#07111a]/78 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-50/50">Institution</p>
                        <p className="mt-1 inline-flex items-center gap-1 font-semibold text-cyan-50/86">
                          <Building2 className="h-3.5 w-3.5" />
                          {request.school || request.requesterSchool || 'City-wide'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                      <p className="text-[11px] font-semibold text-cyan-50/52">{formatRequestTime(request.createdAt)}</p>
                      {request.matchedCount > 0 && (
                        <span className="rounded-full border border-emerald-200/30 bg-emerald-200/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100">
                          {request.matchedCount} matches
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
