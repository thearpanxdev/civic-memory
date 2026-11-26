import React, { useState, useEffect } from 'react';
import { X, Building2, Save, Loader2, AlertCircle } from 'lucide-react';

export default function DepartmentFormModal({ isOpen, onClose, onSuccess, department }) {
  const isEditing = Boolean(department && department.id);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [routingRules, setRoutingRules] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (department) {
      setName(department.name || '');
      setCode(department.code || '');
      setDescription(department.description || '');
      setResponsibilities(department.responsibilities || '');
      setRoutingRules(department.routing_rules || '');
      setIsActive(department.is_active !== 0 && department.is_active !== false);
    } else {
      setName('');
      setCode('');
      setDescription('');
      setResponsibilities('');
      setRoutingRules('');
      setIsActive(true);
    }
    setError(null);
  }, [department, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !code.trim()) {
      setError('Department name and code are required.');
      return;
    }

    setSaving(true);
    try {
      const url = isEditing
        ? `/api/admin/departments/${department.id}`
        : '/api/admin/departments';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim(),
          responsibilities: responsibilities.trim(),
          routing_rules: routingRules.trim(),
          is_active: isActive ? 1 : 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save department.');
      }

      onSuccess(data.message || (isEditing ? 'Department updated successfully.' : 'Department created successfully.'));
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {isEditing ? 'Edit Municipal Department' : 'Create New Department'}
              </h3>
              <p className="text-xs text-slate-500">
                Configure operational jurisdiction and AI routing rules
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition"
          >
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Department Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Roads and Infrastructure"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Department Code *</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. ROADS"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">General Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief overview of department functions..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Operational Responsibilities (Used by AI Classifier)
            </label>
            <textarea
              rows={3}
              value={responsibilities}
              onChange={(e) => setResponsibilities(e.target.value)}
              placeholder="e.g. Pothole repairs, asphalt resurfacing, footpath maintenance, speed breaker installation..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Detailed responsibilities guide Gemini in understanding jurisdiction boundaries.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              AI Routing Rules & Trigger Keywords
            </label>
            <textarea
              rows={2}
              value={routingRules}
              onChange={(e) => setRoutingRules(e.target.value)}
              placeholder="e.g. pothole, road damage, crater, asphalt, pavement, sidewalk, speed breaker..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Comma-separated civic terms directly matched during automated classification.
            </p>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="is_active_checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
            />
            <label htmlFor="is_active_checkbox" className="font-semibold text-slate-700 cursor-pointer">
              Active Department (Enabled for AI routing and official assignment)
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition flex items-center space-x-2 shadow-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isEditing ? 'Save Changes' : 'Create Department'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
