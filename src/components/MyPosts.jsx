import React, { useEffect, useState } from 'react';
import { collection, query, where, deleteDoc, doc, getDoc, onSnapshot, updateDoc, serverTimestamp, setDoc, increment } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Trash2, PackageOpen, Loader2, Award, ShieldCheck, Zap, Sparkles, CheckCircle2, XCircle, PencilLine, X } from 'lucide-react';

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
    const priceValue = Number(editForm.price || 0);
    const cleanPrice = Number.isNaN(priceValue) ? 0 : Math.max(0, priceValue);

    if (!trimmedTitle) {
      setEditError('Title is required.');
      return;
    }

    setIsSavingEdit(true);
    setEditError('');
    try {
      await updateDoc(doc(db, 'notices', editingItem.id), {
        title: trimmedTitle,
        category: 'Books',
        school: '',
        price: cleanPrice,
        subject: editForm.subject.trim(),
        size: '',
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
    if (status === 'reserved') return { label: 'Reserved', badgeClass: 'bg-cyan-200 text-[#082231]' };
    return { label: 'Active', badgeClass: 'bg-emerald-200/90 text-[#153421]' };
  };

  const getDealStatusMeta = (status) => {
    if (status === 'accepted') return { label: 'Accepted', className: 'bg-cyan-200 text-[#082231]' };
    if (status === 'completed') return { label: 'Completed', className: 'bg-emerald-200 text-[#153421]' };
    if (status === 'declined') return { label: 'Declined', className: 'bg-rose-300/85 text-[#4a1b25]' };
    return { label: 'Pending', className: 'bg-sky-200 text-[#17304a]' };
  };

  if (loading) {
    return (
      <div className="flex justify-center p-14">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-100" />
      </div>
    );
  }

  const karma = userProfile?.karmaPoints || 0;
  const tier =
    karma >= 100
      ? { name: 'Community Pillar', color: 'bg-cyan-200 text-[#082231]', icon: <Award className="h-4 w-4" /> }
      : karma >= 50
        ? { name: 'Trusted Senior', color: 'bg-cyan-100/90 text-[#082231]', icon: <ShieldCheck className="h-4 w-4" /> }
        : { name: 'Neighborhood Helper', color: 'bg-cyan-300/75 text-[#082231]', icon: <Zap className="h-4 w-4" /> };

  const successfulHandovers = userProfile?.successfulHandovers || myItems.filter((item) => (item.status || 'active') === 'sold').length;

  return (
    <div className="mx-auto w-full max-w-[1480px] px-3 pb-14 pt-4 sm:px-6">
      <section className="lux-panel relative mb-5 overflow-hidden p-5 sm:p-6">
        <div className="absolute right-0 top-0 p-6 opacity-20 sm:p-8">
          <Award className="h-24 w-24 text-cyan-100" />
        </div>

        <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/22 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-cyan-50 uppercase">
          <Sparkles className="h-3.5 w-3.5" />
          Member Dashboard
        </p>

        <h2 className="font-display mb-1 text-2xl font-semibold text-white">{userProfile?.displayName || 'Community Member'}</h2>
        <div className={`mb-6 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${tier.color}`}>
          {tier.icon} {tier.name}
        </div>

        <div className="grid gap-3 border-t border-cyan-300/12 pt-4 sm:grid-cols-3">
          <div className="lux-panel-soft p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-50/54">Aura Points</p>
            <p className="font-display text-3xl font-semibold text-cyan-100">{karma}</p>
          </div>
          <div className="lux-panel-soft p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-50/54">Items Shared</p>
            <p className="font-display text-3xl font-semibold text-white">{myItems.length}</p>
          </div>
          <div className="lux-panel-soft p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-50/54">Handovers</p>
            <p className="font-display text-3xl font-semibold text-emerald-200">{successfulHandovers}</p>
          </div>
        </div>
      </section>

      <section className="lux-panel mb-5 p-5 sm:p-6">
        <h3 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold text-white">
          <ShieldCheck className="h-5 w-5 text-cyan-100" />
          Pickup Requests
        </h3>

        {dealRequests.length === 0 ? (
          <p className="text-sm text-cyan-50/72">No pickup requests yet.</p>
        ) : (
          <div className="space-y-3">
            {dealRequests.map((deal) => {
              const statusMeta = getDealStatusMeta(deal.status || 'pending');
              const isBusy = dealActionId === deal.id;

              return (
                <article key={deal.id} className="lux-panel-soft rounded-2xl p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-semibold text-white">{deal.noticeTitle || 'Listing'}</h4>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusMeta.className}`}>{statusMeta.label}</span>
                  </div>

                  <p className="text-xs text-cyan-50/75">
                    Buyer: <span className="font-semibold text-white">{deal.buyerName || 'Community member'}</span>
                  </p>
                  <p className="mt-1 text-xs text-cyan-50/75">
                    Phone: <span className="font-semibold text-white">{deal.buyerPhone || 'Not shared'}</span>
                  </p>
                  {deal.preferredMeetup && (
                    <p className="mt-1 text-xs text-cyan-50/75">
                      Meetup: <span className="font-semibold text-white">{deal.preferredMeetup}</span>
                    </p>
                  )}
                  {deal.preferredTime && (
                    <p className="mt-1 text-xs text-cyan-50/75">
                      Time: <span className="font-semibold text-white">{deal.preferredTime}</span>
                    </p>
                  )}
                  {deal.note && <p className="mt-2 rounded-lg border border-cyan-300/16 bg-[#08111a]/86 px-3 py-2 text-xs text-cyan-50/82">{deal.note}</p>}
                  <p className="mt-2 text-[11px] text-cyan-50/58">{formatRelativeTime(deal.createdAt)}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(deal.status || 'pending') === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDealAction(deal, 'accept')}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 rounded-full border border-cyan-300/28 bg-cyan-300/12 px-3 py-1.5 text-xs font-bold text-cyan-50 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-55"
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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-xl font-semibold text-white">My Listings</h3>
          <p className="text-xs text-cyan-50/65">Update availability, prices, or add trust notes for buyers.</p>
        </div>
        <span className="rounded-full border border-cyan-300/18 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-50/65">
          {myItems.length} live
        </span>
      </div>

      {myItems.length === 0 ? (
        <div className="lux-panel flex flex-col items-center justify-center p-8">
          <PackageOpen className="mb-3 h-12 w-12 text-cyan-100/65" />
          <p className="text-center text-sm text-cyan-50/78">You have not posted any items yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {myItems.map((item) => {
            const status = item.status || 'active';
            const statusMeta = getStatusMeta(status);
            const isSavingThis = statusSavingId === item.id;
            const displayPrice = item.price === 0 ? 'Free' : item.price ? `Rs ${item.price}` : 'Price TBD';
            const displayCategory = 'Books';

            return (
              <article key={item.id} className="lux-panel mb-0 flex items-center justify-between rounded-2xl p-4">
                <div className="flex min-w-0 items-center gap-4">
                  <img
                    src={item.photoUrl || 'https://via.placeholder.com/50'}
                    alt="item"
                    className="h-14 w-14 rounded-xl bg-cyan-300/12 object-cover"
                  />
                  <div className="min-w-0">
                    <h3 className="line-clamp-1 font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 text-xs text-cyan-50/68">{displayCategory} | {displayPrice}</p>
                    <p className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusMeta.badgeClass}`}>
                      {statusMeta.label}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(item)}
                    className="inline-flex items-center gap-1 rounded-xl border border-cyan-300/20 bg-[#08111a]/88 px-3 py-2 text-xs font-semibold text-cyan-50 transition hover:border-cyan-300/38 hover:bg-[#0b1824]"
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
                    className="lux-select rounded-xl px-3 py-2 text-xs font-semibold text-cyan-50 disabled:opacity-60"
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
          <form onSubmit={handleEditSubmit} className="lux-panel w-full max-w-[920px] p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-cyan-100/62">Edit listing</p>
                <h3 className="font-display mt-1 text-2xl font-semibold text-white">{editingItem.title || 'Listing'}</h3>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-lg border border-cyan-300/20 bg-[#08111a]/88 p-2 text-cyan-50/80 transition hover:border-cyan-300/40 hover:text-white"
                aria-label="Close edit listing modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Listing title"
                className="lux-input sm:col-span-2"
                value={editForm.title}
                onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
              />

              <div className="lux-panel-soft flex items-center rounded-xl px-4 py-3 text-sm font-semibold text-cyan-50">
                Category: Books
              </div>

              <input
                type="number"
                min="0"
                placeholder="Price in Rs"
                className="lux-input"
                value={editForm.price}
                onChange={(event) => setEditForm((prev) => ({ ...prev, price: event.target.value }))}
              />

              <input
                type="text"
                placeholder="Subject or item detail (optional)"
                className="lux-input"
                value={editForm.subject}
                onChange={(event) => setEditForm((prev) => ({ ...prev, subject: event.target.value }))}
              />

              <input
                type="text"
                placeholder="Condition (optional)"
                className="lux-input"
                value={editForm.condition}
                onChange={(event) => setEditForm((prev) => ({ ...prev, condition: event.target.value }))}
              />

              <input
                type="text"
                placeholder="Tip for buyer (optional)"
                className="lux-input"
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
                className="rounded-xl border border-cyan-300/22 px-4 py-2.5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/10"
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
