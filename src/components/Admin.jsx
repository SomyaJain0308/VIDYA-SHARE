import React, { useEffect, useState } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { ShieldAlert, Trash2 } from 'lucide-react';

export default function Admin({ isAdmin = false }) {
  const [reports, setReports] = useState([]);

  useEffect(() => {
    const fetchReports = async () => {
      if (!isAdmin) return;
      try {
        const querySnapshot = await getDocs(collection(db, 'reports'));
        const r = [];
        querySnapshot.forEach(doc => r.push({ id: doc.id, ...doc.data() }));
        setReports(r);
      } catch (error) {
        console.error('Error loading reports:', error);
      }
    };
    fetchReports();
  }, [isAdmin]);

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('Delete this report entry?')) return;
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      setReports((prev) => prev.filter((item) => item.id !== reportId));
    } catch (error) {
      console.error('Error deleting report:', error);
    }
  };

  if (!isAdmin) {
    return <div className="p-20 text-center text-sm font-semibold text-rose-200">Access denied.</div>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-5 sm:px-6">
      <div className="mb-6 flex items-center gap-4">
        <div className="rounded-2xl border border-rose-100/30 bg-rose-300/15 p-3 text-rose-100">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="font-display text-3xl font-semibold text-white">Control Room</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="glass-panel rounded-[1.8rem] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <ShieldAlert className="h-5 w-5 text-rose-200" />
            Active Reports
          </h2>
          {reports.length === 0 && <p className="text-sm text-slate-100/75">No active reports.</p>}
          {reports.map((report) => (
            <div key={report.id} className="mb-2 flex items-center justify-between rounded-xl border border-slate-200/20 bg-slate-900/35 p-3">
              <p className="text-sm font-medium text-slate-100">Item: {report.reportedItemId}</p>
              <button
                onClick={() => handleDeleteReport(report.id)}
                className="rounded-lg bg-rose-300/85 p-2 text-[#4a1b25] transition hover:bg-rose-200"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
