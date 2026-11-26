import React, { useState } from 'react';
import {
  Building2,
  Users,
  FileText,
  CheckCircle2,
  AlertCircle,
  Plus,
  Edit2,
  Power,
  Shield,
  Tag,
} from 'lucide-react';
import DepartmentFormModal from './DepartmentFormModal.jsx';

export default function AdminDepartmentsTab({ departments, loading, onRefresh, showToast }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  if (loading) {
    return <div className="p-12 text-center text-slate-400 text-sm">Loading department data...</div>;
  }

  function handleOpenCreate() {
    setEditingDepartment(null);
    setModalOpen(true);
  }

  function handleOpenEdit(dept) {
    setEditingDepartment(dept);
    setModalOpen(true);
  }

  async function handleToggleStatus(dept) {
    setTogglingId(dept.id);
    try {
      const res = await fetch(`/api/admin/departments/${dept.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ is_active: dept.is_active === 1 ? 0 : 1 }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update department status.');
      }
      if (showToast) showToast(data.message);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Municipal Departments</h3>
          <p className="text-xs text-slate-500">
            Workload distribution, designated response teams, and AI routing jurisdiction rules
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Department</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept) => {
          const total = dept.total_complaints || 0;
          const resolved = dept.resolved_complaints || 0;
          const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
          const isActive = dept.is_active !== 0 && dept.is_active !== false;

          return (
            <div
              key={dept.id}
              className={`bg-white rounded-3xl border p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4 ${
                isActive ? 'border-slate-200' : 'border-slate-200/60 opacity-75 bg-slate-50/50'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                      {dept.code}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500 flex items-center space-x-1">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>{dept.official_count} Officials</span>
                  </span>
                </div>

                <div>
                  <h4 className="text-base font-bold text-slate-900">{dept.name}</h4>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mt-1">
                    {dept.description || 'Municipal civic infrastructure management and maintenance.'}
                  </p>
                </div>

                {dept.responsibilities && (
                  <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="font-semibold text-slate-700 block mb-0.5">Jurisdiction:</span>
                    <p className="line-clamp-2 text-slate-500">{dept.responsibilities}</p>
                  </div>
                )}

                {dept.routing_rules && (
                  <div className="flex items-start space-x-1.5 text-[10px] text-slate-500">
                    <Tag className="w-3 h-3 text-purple-600 shrink-0 mt-0.5" />
                    <span className="line-clamp-1 font-mono text-slate-600">{dept.routing_rules}</span>
                  </div>
                )}
              </div>

              {/* Progress & Stats */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Resolution Rate:</span>
                  <span className="font-bold text-emerald-600">{rate}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${rate}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Total</div>
                    <div className="font-bold text-slate-800 mt-0.5">{total}</div>
                  </div>
                  <div className="p-2 rounded-xl bg-amber-50/50 border border-amber-100">
                    <div className="text-[10px] text-amber-700 font-semibold uppercase">Open</div>
                    <div className="font-bold text-amber-800 mt-0.5">{dept.open_complaints || 0}</div>
                  </div>
                  <div className="p-2 rounded-xl bg-rose-50/50 border border-rose-100">
                    <div className="text-[10px] text-rose-700 font-semibold uppercase">Pending Rev</div>
                    <div className="font-bold text-rose-800 mt-0.5">{dept.pending_review_complaints || 0}</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    onClick={() => handleOpenEdit(dept)}
                    className="p-1.5 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition text-xs font-semibold flex items-center space-x-1"
                    title="Edit Department"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleToggleStatus(dept)}
                    disabled={togglingId === dept.id}
                    className={`p-1.5 rounded-lg transition text-xs font-semibold flex items-center space-x-1 ${
                      isActive
                        ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                        : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                    }`}
                    title={isActive ? 'Deactivate Department' : 'Activate Department'}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{isActive ? 'Deactivate' : 'Activate'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <DepartmentFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={(msg) => {
          if (showToast) showToast(msg);
          if (onRefresh) onRefresh();
        }}
        department={editingDepartment}
      />
    </div>
  );
}
