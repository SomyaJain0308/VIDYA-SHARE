import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Send, Loader2, Radar, Sparkles, CheckCircle2 } from 'lucide-react';
import RequestBoard from './RequestBoard';
import { sendLocalNotification } from '../utils/notifications';
import { normalizeText, extractKeywords, isLikelyMatch } from '../utils/matching';
import SchoolSearchInput from './SchoolSearchInput';
import { SAHARANPUR_SCHOOLS, normalizeSchoolInput } from '../data/schools';

const requestCategoryOptions = ['Books', 'Uniforms'];
const urgencyOptions = ['Anytime', 'This week', 'Urgent'];

const includesToken = (sourceValue, targetValue) => {
  const source = normalizeText(sourceValue);
  const target = normalizeText(targetValue);
  if (!source || !target) return true;
  return source.includes(target) || target.includes(source);
};

export default function Requests({ userProfile, onRequireAuth }) {
  const [requests, setRequests] = useState([]);
  const [formData, setFormData] = useState({
    text: '',
    category: 'Books',
    classGrade: '',
    subject: '',
    school: '',
    budget: '',
    urgency: 'Anytime',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [recencyFilter, setRecencyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [fulfillingRequestId, setFulfillingRequestId] = useState('');

  const requesterContactPhone = userProfile?.contactPhone || userProfile?.phone || auth.currentUser?.phoneNumber || '';
  const currentUserId = auth.currentUser?.uid || '';

  const getRecencyCutoffMs = (value) => {
    const now = Date.now();
    if (value === '24h') return now - 24 * 60 * 60 * 1000;
    if (value === '7d') return now - 7 * 24 * 60 * 60 * 1000;
    if (value === '30d') return now - 30 * 24 * 60 * 60 * 1000;
    return null;
  };

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
    requestClass,
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
        if (requestCategory === 'Uniforms' && requestSchool) {
          const noticeSchool = normalizeSchoolInput(notice.school);
          if (noticeSchool !== requestSchool) continue;
        }
        if (requestClass && !includesToken(notice.classGrade, requestClass)) continue;
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
    const normalizedSchool = normalizeSchoolInput(formData.school);
    const cleanClass = formData.classGrade.trim();
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
    if (formData.category === 'Uniforms' && !normalizedSchool) {
      setSubmitError('School is required for uniform requests.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const requestSearchText = `${trimmedRequest} ${formData.category} ${cleanClass} ${cleanSubject} ${normalizedSchool}`.trim();
      const requestKeywords = extractKeywords(requestSearchText);
      const requestPayload = {
        text: trimmedRequest,
        normalizedText: normalizeText(trimmedRequest),
        keywords: requestKeywords,
        category: formData.category,
        classGrade: cleanClass,
        subject: cleanSubject,
        school: formData.category === 'Uniforms' ? normalizedSchool : '',
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
        requestSchool: requestPayload.school,
        requestClass: cleanClass,
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
        classGrade: '',
        subject: '',
        school: '',
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

  const handleMarkFulfilled = async (request) => {
    if (!request?.id) return;
    if (request.requesterId !== currentUserId) return;
    try {
      setFulfillingRequestId(request.id);
      await updateDoc(doc(db, 'requests', request.id), {
        status: 'fulfilled',
        fulfilledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to mark request fulfilled', error);
      alert('Could not mark this request as fulfilled.');
    } finally {
      setFulfillingRequestId('');
    }
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const recencyCutoffMs = getRecencyCutoffMs(recencyFilter);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      if (categoryFilter !== 'all' && request.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && (request.status || 'open') !== statusFilter) return false;

      if (normalizedSearch) {
        const haystack = `${request.text || ''} ${request.classGrade || ''} ${request.subject || ''} ${request.school || ''}`.toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }

      if (!recencyCutoffMs) return true;
      const createdMs = request.createdAt?.toMillis?.() || request.createdAt?.toDate?.()?.getTime?.() || 0;
      return createdMs >= recencyCutoffMs;
    });
  }, [requests, categoryFilter, statusFilter, normalizedSearch, recencyCutoffMs]);

  return (
    <div className="mx-auto w-full max-w-[1650px] px-1 pb-14 pt-4 sm:px-2 lg:px-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(360px,510px)_minmax(0,1fr)] 2xl:grid-cols-[520px_minmax(0,1fr)]">
        <section className="glass-panel h-fit rounded-[1.6rem] p-5 sm:p-6 xl:sticky xl:top-24">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200/25 bg-amber-200/10 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-amber-100 uppercase">
                <Radar className="h-3.5 w-3.5" />
                Request Engine V2
              </p>
              <h2 className="font-display text-2xl font-semibold text-amber-50">Find or Request</h2>
              <p className="mt-1 text-sm text-amber-100/75">
                Structured requests match faster by category, school, class, subject, and budget.
              </p>
            </div>
            <div className="hidden rounded-xl border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-xs font-semibold text-amber-100 md:flex md:items-center md:gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              Intent matching
            </div>
          </div>

          <form onSubmit={handlePostRequest} className="space-y-3">
            <textarea
              rows="2"
              placeholder="e.g., Looking for Class 10 RD Sharma"
              className="w-full resize-none rounded-2xl border border-amber-200/20 bg-[#161006] p-4 font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
              value={formData.text}
              onChange={(event) => setFormData((prev) => ({ ...prev, text: event.target.value }))}
              required
            />

            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={formData.category}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    category: event.target.value,
                    school: event.target.value === 'Uniforms' ? prev.school : '',
                  }))
                }
                className="rounded-xl border border-amber-200/20 bg-[#161006] px-3 py-2.5 text-sm font-medium text-amber-100 outline-none focus:border-amber-200/45"
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
                className="rounded-xl border border-amber-200/20 bg-[#161006] px-3 py-2.5 text-sm font-medium text-amber-100 outline-none focus:border-amber-200/45"
              >
                {urgencyOptions.map((option) => (
                  <option key={option} value={option} className="bg-[#161006]">
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Class / Grade (optional)"
                className="rounded-xl border border-amber-200/20 bg-[#161006] px-3 py-2.5 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
                value={formData.classGrade}
                onChange={(event) => setFormData((prev) => ({ ...prev, classGrade: event.target.value }))}
              />
              <input
                type="text"
                placeholder="Subject (optional)"
                className="rounded-xl border border-amber-200/20 bg-[#161006] px-3 py-2.5 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
                value={formData.subject}
                onChange={(event) => setFormData((prev) => ({ ...prev, subject: event.target.value }))}
              />
            </div>

            {formData.category === 'Uniforms' && (
              <SchoolSearchInput
                id="request-school"
                required
                value={formData.school}
                onChange={(nextSchool) => setFormData((prev) => ({ ...prev, school: nextSchool }))}
                schools={SAHARANPUR_SCHOOLS}
                placeholder="Search school for uniform request"
              />
            )}

            <input
              type="number"
              min="0"
              placeholder="Budget in Rs (optional)"
              className="w-full rounded-xl border border-amber-200/20 bg-[#161006] px-3 py-2.5 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
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

        <div className="min-w-0">
          <div className="glass-panel mb-3 rounded-2xl p-4 sm:p-5">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_130px_120px_auto]">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search requests"
                className="w-full rounded-xl border border-amber-200/20 bg-[#161006] px-4 py-2.5 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
              />
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="rounded-xl border border-amber-200/20 bg-[#161006] px-3 py-2.5 text-sm font-medium text-amber-100 outline-none focus:border-amber-200/45"
              >
                <option value="all" className="bg-[#161006]">All types</option>
                <option value="Books" className="bg-[#161006]">Books</option>
                <option value="Uniforms" className="bg-[#161006]">Uniforms</option>
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-amber-200/20 bg-[#161006] px-3 py-2.5 text-sm font-medium text-amber-100 outline-none focus:border-amber-200/45"
              >
                <option value="all" className="bg-[#161006]">All status</option>
                <option value="open" className="bg-[#161006]">Open</option>
                <option value="matched" className="bg-[#161006]">Matched</option>
                <option value="fulfilled" className="bg-[#161006]">Fulfilled</option>
              </select>
              <select
                value={recencyFilter}
                onChange={(event) => setRecencyFilter(event.target.value)}
                className="rounded-xl border border-amber-200/20 bg-[#161006] px-3 py-2.5 text-sm font-medium text-amber-100 outline-none focus:border-amber-200/45"
              >
                <option value="all" className="bg-[#161006]">All time</option>
                <option value="24h" className="bg-[#161006]">24h</option>
                <option value="7d" className="bg-[#161006]">7d</option>
                <option value="30d" className="bg-[#161006]">30d</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setRecencyFilter('all');
                  setStatusFilter('all');
                  setCategoryFilter('all');
                }}
                className="rounded-xl border border-amber-200/25 bg-[#161006] px-4 py-2.5 text-sm font-semibold text-amber-100/85 transition hover:bg-[#211608]"
              >
                Clear
              </button>
            </div>
          </div>

          <RequestBoard
            requests={filteredRequests}
            currentUserId={currentUserId}
            onMarkFulfilled={handleMarkFulfilled}
            fulfillingRequestId={fulfillingRequestId}
          />

          {filteredRequests.length > 0 && (
            <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-emerald-200/35 bg-emerald-200/15 px-3 py-1 text-xs font-semibold text-emerald-100">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Requests can now be completed and tracked
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
