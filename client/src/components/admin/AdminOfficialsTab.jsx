import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Building2,
  Phone,
  Mail,
  Shield,
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Power,
  Edit3,
} from 'lucide-react';

export default function AdminOfficialsTab({
  officials,
  departments,
  onOpenCreate,
  onOpenReassign,
  onToggleStatus,
  loading,
}) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');

  const filteredOfficials = officials.filter((o) => {
    const matchesSearch =
      o.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.email?.toLowerCase().includes(search.toLowerCase()) ||
      o.phone?.includes(search);
    const matchesDept = deptFilter === 'all' || o.department_id === deptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Municipal Official Accounts</h3>
          <p className="text-xs text-slate-500">
            Manage authorized departmental personnel, reassign departments, and configure account access
          </p>
        </div>

        <button
          onClick={onOpenCreate}
          className="px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-sm flex items-center space-x-2 transition self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Provision Official Account</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search officials by name, email, or phone..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500"
          />
        </div>

        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 font-medium focus:outline-none focus:border-purple-500"
        >
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Officials Data Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading officials...</div>
        ) : filteredOfficials.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">No official accounts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-3.5">Official Name & Email</th>
                  <th className="px-4 py-3.5">Department</th>
                  <th className="px-4 py-3.5">Assigned Workload</th>
                  <th className="px-4 py-3.5">Account Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOfficials.map((off) => (
                  <tr key={off.id} className="hover:bg-slate-50/60 transition group">
                    {/* Name & Email */}
                    <td className="px-6 py-4">
                      <div className="space-y-0.5">
                        <p className="font-bold text-slate-900 text-sm">{off.full_name}</p>
                        <p className="text-slate-400 text-[11px] font-mono">{off.email}</p>
                        {off.phone && <p className="text-slate-500 text-[11px]">{off.phone}</p>}
                      </div>
                    </td>

                    {/* Department */}
                    <td className="px-4 py-4">
                      <span className="font-mono text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                        {off.department_name || 'Unassigned'}
                      </span>
                    </td>

                    {/* Assigned Workload */}
                    <td className="px-4 py-4">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-slate-800">
                          {off.active_assigned || 0} Active
                        </span>
                        <span className="text-slate-400 text-[11px]"> ({off.total_assigned || 0} total)</span>
                      </div>
                    </td>

                    {/* Account Status */}
                    <td className="px-4 py-4">
                      {off.is_active ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-rose-100 text-rose-800 border border-rose-200">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>Deactivated</span>
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center space-x-2">
                        <button
                          onClick={() => onOpenReassign(off)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-purple-400 hover:bg-purple-50 text-purple-700 font-semibold text-[11px] transition flex items-center space-x-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Reassign</span>
                        </button>

                        <button
                          onClick={() => onToggleStatus(off)}
                          title={off.is_active ? 'Deactivate Account' : 'Activate Account'}
                          className={`p-1.5 rounded-lg border transition ${
                            off.is_active
                              ? 'border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-400 hover:text-rose-600'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
