import React, { useEffect, useState } from 'react';
import { collection, query, where, deleteDoc, doc, getDoc, onSnapshot, updateDoc, serverTimestamp, setDoc, increment } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Trash2, PackageOpen, Loader2, Award, ShieldCheck, Zap, Sparkles, CheckCircle2, XCircle, PencilLine, X } from 'lucide-react';
import SchoolSearchInput from './SchoolSearchInput';
import { SAHARANPUR_SCHOOLS, normalizeSchoolInput } from '../data/schools';

const formatRelativeTime = (timestamp) => {
  if (!timestamp?.toDate) return 'Just now';
  const seconds = Math.floor((Date.now() - timestamp.toDate().getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default function MyPosts() {
  const [myItems, setMyItems] = useState([]);
  const [dealRequests, setDealRequests] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusSavingId, setStatusSavingId] = useState('');
  const [dealActionId, setDealActionId] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    category: 'Books',
    school: '',
    price: '',
    classGrade: '',
    subject: '',
    size: '',
    condition: '',
    successNote: '',
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    let unsubscribeItems = () => {};
    let unsubscribeDeals = () => {};

    const fetchDashboardData = async () => {
      if (!auth.currentUser) {
        setMyItems([]);
        setDealRequests([]);
        setUserProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) setUserProfile(userDoc.data());

        const itemsQuery = query(collection(db, 'notices'), where('sellerId', '==', auth.currentUser.uid));
        unsubscribeItems = onSnapshot(
          itemsQuery,
          (querySnapshot) => {
            const items = [];
            querySnapshot.forEach((entry) => items.push({ id: entry.id, ...entry.data() }));
            setMyItems(items);
            setLoading(false);
          },
          (error) => {
            console.error('Error loading my items:', error);
            setLoading(false);
          }
        );

        const dealsQuery = query(collection(db, 'dealRequests'), where('sellerId', '==', auth.currentUser.uid));
        unsubscribeDeals = onSnapshot(
          dealsQuery,
          (querySnapshot) => {
            const deals = [];
            querySnapshot.forEach((entry) => deals.push({ id: entry.id, ...entry.data() }));
            deals.sort((a, b) => {
              const aTime = a.createdAt?.toMillis?.() || 0;
              const bTime = b.createdAt?.toMillis?.() || 0;
              return bTime - aTime;
            });
            setDealRequests(deals);
          },
          (error) => {
            console.error('Error loading deal requests:', error);
          }
        );
      } catch (error) {
        console.error('Error fetching dashboard:', error);
        setLoading(false);
      }
    };

    fetchDashboardData();
    return () => {
      unsubscribeItems();
      unsubscribeDeals();
    };
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this listing permanently?')) return;
    await deleteDoc(doc(db, 'notices', id));
    setMyItems((prev) => prev.filter((item) => item.id !== id));
  };

  const openEditModal = (item) => {
    if (!item) return;
    setEditError('');
    setEditingItem(item);
    setEditForm({
      title: item.title || '',
      category: item.category || 'Books',
      school: item.school || '',
      price: item.price === 0 ? '0' : String(item.price || ''),
      classGrade: item.classGrade || '',
      subject: item.subject || '',
      size: item.size || '',
      condition: item.condition || '',
      successNote: item.successNote || '',
    });
  };

  const closeEditModal = () => {
    if (isSavingEdit) return;
    setEditingItem(null);
    setEditError('');
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    if (!editingItem?.id) return;

    const trimmedTitle = editForm.title.trim();
    const isUniform = editForm.category === 'Uniforms';
    const normalizedSchool = normalizeSchoolInput(editForm.school);
    const priceValue = Number(editForm.price || 0);
    const cleanPrice = Number.isNaN(priceValue) ? 0 : Math.max(0, priceValue);

    if (!trimmedTitle) {
      setEditError('Title is required.');
      return;
    }
    if (isUniform && !normalizedSchool) {
      setEditError('School is required for uniform listings.');
      return;
    }

    setIsSavingEdit(true);
    setEditError('');
    try {
      await updateDoc(doc(db, 'notices', editingItem.id), {
        title: trimmedTitle,
        category: editForm.category,
        school: isUniform ? normalizedSchool : '',
        price: cleanPrice,
        classGrade: isUniform ? '' : editForm.classGrade.trim(),
        subject: isUniform ? '' : editForm.subject.trim(),
        size: isUniform ? editForm.size.trim() : '',
        condition: editForm.condition.trim(),
        successNote: editForm.successNote.trim(),
        updatedAt: serverTimestamp(),
      });
      setEditingItem(null);
    } catch (error) {
      console.error('Failed to update listing', error);
      setEditError('Could not save changes right now.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleStatusChange = async (id, nextStatus) => {
    try {
      setStatusSavingId(id);
      await updateDoc(doc(db, 'notices', id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating item status:', error);
      alert('Could not update status. Please try again.');
    } finally {
      setStatusSavingId('');
    }
  };

  const handleDealAction = async (deal, action) => {
    if (!deal?.id) return;
    try {
      setDealActionId(deal.id);
      const dealRef = doc(db, 'dealRequests', deal.id);
      const noticeRef = doc(db, 'notices', deal.noticeId);

      if (action === 'accept') {
        await updateDoc(dealRef, {
          status: 'accepted',
          acceptedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await updateDoc(noticeRef, {
          status: 'reserved',
          reservedForBuyerId: deal.buyerId || '',
          reservedForBuyerName: deal.buyerName || '',
          updatedAt: serverTimestamp(),
        });
      }

      if (action === 'decline') {
        await updateDoc(dealRef, {
          status: 'declined',
          declinedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (action === 'complete') {
        await updateDoc(dealRef, {
          status: 'completed',
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await updateDoc(noticeRef, {
          status: 'sold',
          soldAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await setDoc(
          doc(db, 'users', auth.currentUser.uid),
          {
            successfulHandovers: increment(1),
            karmaPoints: increment(5),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (error) {
      console.error('Deal action failed', error);
      alert('Could not update this pickup request.');
    } finally {
      setDealActionId('');
    }
  };

  const getStatusMeta = (status) => {
    if (status === 'sold') return { label: 'Sold', badgeClass: 'bg-rose-300/85 text-[#4a1b25]' };
    if (status === 'reserved') return { label: 'Reserved', badgeClass: 'bg-amber-200 text-[#3f2a02]' };
    return { label: 'Active', badgeClass: 'bg-emerald-200/90 text-[#153421]' };
  };

  const getDealStatusMeta = (status) => {
    if (status === 'accepted') return { label: 'Accepted', className: 'bg-amber-200 text-[#3f2a02]' };
    if (status === 'completed') return { label: 'Completed', className: 'bg-emerald-200 text-[#153421]' };
    if (status === 'declined') return { label: 'Declined', className: 'bg-rose-300/85 text-[#4a1b25]' };
    return { label: 'Pending', className: 'bg-sky-200 text-[#17304a]' };
  };

  if (loading) {
    return (
      <div className="flex justify-center p-14">
        <Loader2 className="h-8 w-8 animate-spin text-amber-100" />
      </div>
    );
  }

  const karma = userProfile?.karmaPoints || 0;
  const tier =
    karma >= 100
      ? { name: 'Community Pillar', color: 'bg-amber-200 text-[#3f2a02]', icon: <Award className="h-4 w-4" /> }
      : karma >= 50
        ? { name: 'Trusted Senior', color: 'bg-[#d7c9a3] text-[#2f2107]', icon: <ShieldCheck className="h-4 w-4" /> }
        : { name: 'Neighborhood Helper', color: 'bg-[#c9b37c] text-[#332206]', icon: <Zap className="h-4 w-4" /> };

  const successfulHandovers = userProfile?.successfulHandovers || myItems.filter((item) => (item.status || 'active') === 'sold').length;

  return (
    <div className="mx-auto w-full max-w-4xl px-3 pb-14 pt-4 sm:px-6">
      <section className="glass-panel relative mb-5 overflow-hidden rounded-[1.6rem] p-5 sm:p-6">
        <div className="absolute right-0 top-0 p-6 opacity-20 sm:p-8">
          <Award className="h-24 w-24 text-amber-100" />
        </div>

        <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200/25 bg-amber-200/10 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-amber-100 uppercase">
          <Sparkles className="h-3.5 w-3.5" />
          Member Dashboard
        </p>

        <h2 className="font-display mb-1 text-2xl font-semibold text-amber-50">{userProfile?.displayName || 'Community Member'}</h2>
        <div className={`mb-6 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${tier.color}`}>
          {tier.icon} {tier.name}
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-amber-200/20 pt-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-100/55">Karma Points</p>
            <p className="font-display text-3xl font-semibold text-amber-100">{karma}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-100/55">Items Shared</p>
            <p className="font-display text-3xl font-semibold text-amber-50">{myItems.length}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-100/55">Handovers</p>
            <p className="font-display text-3xl font-semibold text-emerald-200">{successfulHandovers}</p>
          </div>
        </div>
      </section>

      <section className="glass-panel mb-5 rounded-[1.6rem] p-5 sm:p-6">
        <h3 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold text-amber-50">
          <ShieldCheck className="h-5 w-5 text-amber-100" />
          Pickup Requests
        </h3>

        {dealRequests.length === 0 ? (
          <p className="text-sm text-amber-100/75">No pickup requests yet.</p>
        ) : (
          <div className="space-y-3">
            {dealRequests.map((deal) => {
              const statusMeta = getDealStatusMeta(deal.status || 'pending');
              const isBusy = dealActionId === deal.id;

              return (
                <article key={deal.id} className="rounded-2xl border border-amber-200/18 bg-[#130d05]/70 p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-semibold text-amber-50">{deal.noticeTitle || 'Listing'}</h4>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusMeta.className}`}>{statusMeta.label}</span>
                  </div>

                  <p className="text-xs text-amber-100/75">
                    Buyer: <span className="font-semibold text-amber-50">{deal.buyerName || 'Community member'}</span>
                  </p>
                  <p className="mt-1 text-xs text-amber-100/75">
                    Phone: <span className="font-semibold text-amber-50">{deal.buyerPhone || 'Not shared'}</span>
                  </p>
                  {deal.preferredMeetup && (
                    <p className="mt-1 text-xs text-amber-100/75">
                      Meetup: <span className="font-semibold text-amber-50">{deal.preferredMeetup}</span>
                    </p>
                  )}
                  {deal.preferredTime && (
                    <p className="mt-1 text-xs text-amber-100/75">
                      Time: <span className="font-semibold text-amber-50">{deal.preferredTime}</span>
                    </p>
                  )}
                  {deal.note && <p className="mt-2 rounded-lg border border-amber-200/18 bg-[#1a1207] px-3 py-2 text-xs text-amber-100/82">{deal.note}</p>}
                  <p className="mt-2 text-[11px] text-amber-100/62">{formatRelativeTime(deal.createdAt)}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(deal.status || 'pending') === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDealAction(deal, 'accept')}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 rounded-full border border-amber-200/35 bg-amber-200/12 px-3 py-1.5 text-xs font-bold text-amber-100 transition hover:bg-amber-200/20 disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDealAction(deal, 'decline')}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 rounded-full border border-rose-200/35 bg-rose-300/12 px-3 py-1.5 text-xs font-bold text-rose-100 transition hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Decline
                        </button>
                      </>
                    )}
                    {(deal.status || 'pending') === 'accepted' && (
                      <button
                        type="button"
                        onClick={() => handleDealAction(deal, 'complete')}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-200/35 bg-emerald-200/15 px-3 py-1.5 text-xs font-bold text-emerald-100 transition hover:bg-emerald-200/25 disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mark sold
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <h3 className="font-display mb-4 text-xl font-semibold text-amber-50">My Listings</h3>

      {myItems.length === 0 ? (
        <div className="glass-panel flex flex-col items-center justify-center rounded-3xl p-8">
          <PackageOpen className="mb-3 h-12 w-12 text-amber-100/65" />
          <p className="text-center text-sm text-amber-100/78">You have not posted any items yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {myItems.map((item) => {
            const status = item.status || 'active';
            const statusMeta = getStatusMeta(status);
            const isSavingThis = statusSavingId === item.id;

            return (
              <article key={item.id} className="glass-panel mb-3 flex items-center justify-between rounded-2xl p-4">
                <div className="flex items-center gap-4">
                  <img
                    src={item.photoUrl || 'https://via.placeholder.com/50'}
                    alt="item"
                    className="h-14 w-14 rounded-xl bg-amber-100/20 object-cover"
                  />
                  <div>
                    <h3 className="line-clamp-1 font-semibold text-amber-50">{item.title}</h3>
                    <p className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusMeta.badgeClass}`}>
                      {statusMeta.label}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(item)}
                    className="inline-flex items-center gap-1 rounded-xl border border-amber-200/30 bg-[#171106] px-3 py-2 text-xs font-semibold text-amber-100 transition hover:border-amber-200/50 hover:bg-[#211608]"
                    aria-label={`Edit ${item.title}`}
                    title="Edit listing"
                  >
                    <PencilLine className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <select
                    value={status}
                    onChange={(event) => handleStatusChange(item.id, event.target.value)}
                    disabled={isSavingThis}
                    className="rounded-xl border border-amber-200/30 bg-[#171106] px-3 py-2 text-xs font-semibold text-amber-100 outline-none transition focus:border-amber-200/60 disabled:opacity-60"
                    aria-label={`Update status for ${item.title}`}
                  >
                    <option className="text-slate-800" value="active">
                      Active
                    </option>
                    <option className="text-slate-800" value="reserved">
                      Reserved
                    </option>
                    <option className="text-slate-800" value="sold">
                      Sold
                    </option>
                  </select>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="rounded-xl border border-rose-200/35 bg-transparent p-2.5 text-rose-200 transition hover:bg-rose-300/20"
                    aria-label="Delete item"
                    title="Delete permanently"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/78 p-4 backdrop-blur-md">
          <form onSubmit={handleEditSubmit} className="glass-panel w-full max-w-2xl rounded-[1.6rem] p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-amber-100/62">Edit listing</p>
                <h3 className="font-display mt-1 text-2xl font-semibold text-amber-50">{editingItem.title || 'Listing'}</h3>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-lg border border-amber-200/25 bg-[#171106] p-2 text-amber-100/80 transition hover:border-amber-200/45 hover:text-amber-50"
                aria-label="Close edit listing modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Listing title"
                className="sm:col-span-2 w-full rounded-xl border border-amber-200/25 bg-[#171106] px-3.5 py-3 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
                value={editForm.title}
                onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
              />

              <select
                className="w-full rounded-xl border border-amber-200/25 bg-[#171106] px-3.5 py-3 text-sm font-medium text-amber-100 outline-none focus:border-amber-200/45"
                value={editForm.category}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    category: event.target.value,
                    school: event.target.value === 'Uniforms' ? prev.school : '',
                    classGrade: event.target.value === 'Books' ? prev.classGrade : '',
                    subject: event.target.value === 'Books' ? prev.subject : '',
                    size: event.target.value === 'Uniforms' ? prev.size : '',
                  }))
                }
              >
                <option className="text-slate-800" value="Books">
                  Books
                </option>
                <option className="text-slate-800" value="Uniforms">
                  Uniforms
                </option>
              </select>

              <input
                type="number"
                min="0"
                placeholder="Price in Rs"
                className="w-full rounded-xl border border-amber-200/25 bg-[#171106] px-3.5 py-3 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
                value={editForm.price}
                onChange={(event) => setEditForm((prev) => ({ ...prev, price: event.target.value }))}
              />

              {editForm.category === 'Uniforms' && (
                <>
                  <SchoolSearchInput
                    id="edit-uniform-school"
                    required
                    value={editForm.school}
                    onChange={(nextSchool) => setEditForm((prev) => ({ ...prev, school: nextSchool }))}
                    schools={SAHARANPUR_SCHOOLS}
                    placeholder="Search school"
                    wrapperClassName="sm:col-span-2"
                  />
                  <input
                    type="text"
                    placeholder="Size (e.g., 34, M)"
                    className="sm:col-span-2 w-full rounded-xl border border-amber-200/25 bg-[#171106] px-3.5 py-3 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
                    value={editForm.size}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, size: event.target.value }))}
                  />
                </>
              )}

              {editForm.category === 'Books' && (
                <>
                  <input
                    type="text"
                    placeholder="Class / Grade (optional)"
                    className="w-full rounded-xl border border-amber-200/25 bg-[#171106] px-3.5 py-3 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
                    value={editForm.classGrade}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, classGrade: event.target.value }))}
                  />
                  <input
                    type="text"
                    placeholder="Subject (optional)"
                    className="w-full rounded-xl border border-amber-200/25 bg-[#171106] px-3.5 py-3 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
                    value={editForm.subject}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, subject: event.target.value }))}
                  />
                </>
              )}

              <input
                type="text"
                placeholder="Condition (optional)"
                className="w-full rounded-xl border border-amber-200/25 bg-[#171106] px-3.5 py-3 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
                value={editForm.condition}
                onChange={(event) => setEditForm((prev) => ({ ...prev, condition: event.target.value }))}
              />

              <input
                type="text"
                placeholder="Tip for buyer (optional)"
                className="w-full rounded-xl border border-amber-200/25 bg-[#171106] px-3.5 py-3 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
                value={editForm.successNote}
                onChange={(event) => setEditForm((prev) => ({ ...prev, successNote: event.target.value }))}
              />
            </div>

            {editError && (
              <p className="mt-3 rounded-lg border border-rose-200/45 bg-rose-300/20 px-3 py-2 text-sm font-semibold text-rose-100">
                {editError}
              </p>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-xl border border-amber-200/30 px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-100/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <PencilLine className="h-4 w-4" />}
                {isSavingEdit ? 'Saving changes...' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
