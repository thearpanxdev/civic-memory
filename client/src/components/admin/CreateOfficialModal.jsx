import React, { useState } from 'react';
import { UserPlus, X, AlertCircle, Loader2 } from 'lucide-react';

export default function CreateOfficialModal({ departments, onClose, onSuccess }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!departmentId) {
      setError('Please assign a municipal department.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/officials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone: phone.trim() || undefined,
          department_id: departmentId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to provision official account.');
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
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Provision Official Account</h3>
              <p className="text-xs text-slate-500">Authorized Municipal Personnel Registration</p>
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
              Full Official Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Officer Anita Sharma"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. anita.sharma@civicmemory.local"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Contact Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Initial Password <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Assigned Municipal Department <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
            >
              <option value="">-- Select department --</option>
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
                  <span>Provisioning Account...</span>
                </>
              ) : (
                <span>Create Official</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
