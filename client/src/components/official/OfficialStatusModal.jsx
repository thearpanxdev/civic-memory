import React, { useState } from 'react';
import { Activity, X, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

export default function OfficialStatusModal({ complaint, onClose, onSuccess }) {
  const [status, setStatus] = useState(
    complaint.status === 'Submitted' || complaint.status === 'Under Review' ? 'In Progress' : complaint.status
  );
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const statusOptions = [
    { value: 'Under Review', label: 'Under Review (Initial departmental assessment)' },
    { value: 'Verified', label: 'Verified (Site verified by field personnel)' },
    { value: 'Assigned', label: 'Assigned (Assigned to response team)' },
    { value: 'In Progress', label: 'In Progress (Active repairs / field crew deployed)' },
    { value: 'Work Completed', label: 'Work Completed (Awaiting Citizen Sign-off)' },
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/official/complaints/${complaint.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
          status,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update status.');
      }

      onSuccess(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Update Complaint Status</h3>
              <p className="text-xs text-slate-500 font-mono">{complaint.ticket_number} • Current: {complaint.status}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Citizen Verification Notice */}
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs space-y-1">
            <div className="font-bold flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-700" />
              <span>Citizen Verification Requirement</span>
            </div>
            <p className="text-amber-800 leading-relaxed">
              Officials cannot unilaterally mark complaints as <strong>Resolved</strong>. When physical repairs are finished, transition to <strong>Work Completed</strong>. The platform will then request verification from the reporting citizen.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              New Lifecycle Status <span className="text-rose-500">*</span>
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              required
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Status Transition Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe actions taken or reason for transition (e.g. Patching complete, bitumen cured)..."
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm flex items-center space-x-2 transition disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <span>Update Status</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
