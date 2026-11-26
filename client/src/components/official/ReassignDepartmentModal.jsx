import React, { useState } from 'react';
import { X, ArrowRightLeft, AlertCircle, Loader2 } from 'lucide-react';

export default function ReassignDepartmentModal({ isOpen, complaint, departments, onClose, onSuccess }) {
  const [targetDeptId, setTargetDeptId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !complaint) return null;

  // Filter out current department and inactive departments
  const availableDepts = (departments || []).filter(
    (d) => d.id !== complaint.department_id && (d.is_active === undefined || d.is_active === 1 || d.is_active === true)
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!targetDeptId) {
      setError('Please select a target department.');
      return;
    }

    if (!reason.trim() || reason.trim().length < 5) {
      setError('Please provide a detailed reason for reassignment (at least 5 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/official/complaints/${complaint.id}/reassign-department`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
          target_department_id: targetDeptId,
          reassignment_reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reassign department.');
      }

      onSuccess(data.message || 'Department reassigned successfully.');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Reassign Department</h3>
              <p className="text-xs text-slate-500 font-mono">Ticket: {complaint.ticket_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-500 mb-1">Current Department</label>
            <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium">
              {complaint.department_name || 'Unassigned'}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Target Department *</label>
            <select
              value={targetDeptId}
              onChange={(e) => setTargetDeptId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              required
            >
              <option value="">-- Select Destination Department --</option>
              {availableDepts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Operational Reassignment Reason *
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this complaint falls under the target department's jurisdiction..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Logged permanently in the routing audit trail. Preserves original AI recommendation.
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition flex items-center space-x-2 shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Reassigning...</span>
                </>
              ) : (
                <span>Confirm Reassignment</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
