import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  AlertCircle,
  X,
  CheckCircle2,
  Trash2,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';

export default function SetDeadlineModal({ complaint, onClose, onSuccess, showToast }) {
  const existingDeadline = complaint.deadline_at
    ? new Date(complaint.deadline_at).toISOString().slice(0, 16)
    : '';

  const [deadlineAt, setDeadlineAt] = useState(existingDeadline);
  const [consultationNotes, setConsultationNotes] = useState(complaint.deadline_consultation_notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Compute minimum datetime (now)
  const nowIso = new Date().toISOString().slice(0, 16);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!deadlineAt) {
      setError('Please select a due date and time.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/complaints/${complaint.id}/deadline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
          deadline_at: new Date(deadlineAt).toISOString(),
          consultation_notes: consultationNotes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to set task deadline.');
      }

      if (showToast) showToast(data.message || 'Task deadline set successfully.');
      if (onSuccess) onSuccess(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveDeadline() {
    if (!window.confirm('Are you sure you want to remove the deadline for this task?')) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/complaints/${complaint.id}/deadline`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove task deadline.');
      }

      if (showToast) showToast('Task deadline removed.');
      if (onSuccess) onSuccess(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-purple-900 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <Clock className="w-5 h-5 text-purple-200" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">
                {existingDeadline ? 'Modify Task Deadline' : 'Set Task Deadline'}
              </h3>
              <p className="text-xs text-purple-200 font-medium">
                Admin-Only Task Execution Authority
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Task Context Card */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {complaint.ticket_number}
            </span>
            <span className="text-slate-500 font-semibold">
              Assigned: {complaint.assigned_official_name || 'Unassigned'}
            </span>
          </div>
          <p className="font-bold text-slate-900 text-sm">{complaint.title}</p>
          <p className="text-slate-500 line-clamp-1">{complaint.address}</p>

          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold mt-1">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            <span>Consult the assigned engineer prior to committing this operational deadline.</span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Due Date & Time Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Due Date & Time <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="datetime-local"
                value={deadlineAt}
                min={nowIso}
                onChange={(e) => setDeadlineAt(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-300 bg-white text-sm text-slate-900 font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              Engineers will see this deadline prominently on their operational task queue.
            </p>
          </div>

          {/* Consultation Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Consultation Notes / Instructions for Engineer
            </label>
            <div className="relative">
              <textarea
                value={consultationNotes}
                onChange={(e) => setConsultationNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Consulted with Eng. Ramesh; procurement of bitumen confirmed for Friday. Completion target locked."
                className="w-full p-3.5 rounded-2xl border border-slate-300 bg-white text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Recorded in the system audit log and delivered to the assigned engineer.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            {existingDeadline ? (
              <button
                type="button"
                onClick={handleRemoveDeadline}
                disabled={submitting}
                className="px-4 py-2 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-bold flex items-center space-x-1.5 transition disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Deadline</span>
              </button>
            ) : <div />}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{submitting ? 'Saving...' : 'Lock & Save Deadline'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
