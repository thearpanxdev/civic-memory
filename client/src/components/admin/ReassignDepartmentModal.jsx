import React, { useState } from 'react';
import { Building2, X, AlertCircle, Loader2 } from 'lucide-react';

export default function ReassignDepartmentModal({ official, departments, onClose, onSuccess }) {
  const [selectedDeptId, setSelectedDeptId] = useState(official.department_id || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedDeptId || selectedDeptId === official.department_id) {
      setError('Please select a different department to reassign.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/officials/${official.id}/department`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
          department_id: selectedDeptId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reassign department.');
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
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Reassign Department</h3>
              <p className="text-xs text-slate-500">{official.full_name}</p>
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

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Current Department
            </label>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
              {official.department_name || 'Unassigned'}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              New Department Assignment <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
              required
            >
              <option value="">-- Choose department --</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
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
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow-sm flex items-center space-x-2 transition disabled:opacity-50"
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
