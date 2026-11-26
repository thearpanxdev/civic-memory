import React, { useState } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  ArrowRight,
  ChevronLeft,
} from 'lucide-react';

const ACTION_COLORS = {
  'COMPLAINT_ASSIGNED': 'bg-blue-100 text-blue-800 border-blue-200',
  'STATUS_UPDATED': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'PROGRESS_UPDATE_ADDED': 'bg-teal-100 text-teal-800 border-teal-200',
  'REPAIR_EVIDENCE_UPLOADED': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'OFFICIAL_CREATED': 'bg-purple-100 text-purple-800 border-purple-200',
  'OFFICIAL_DEPARTMENT_REASSIGNED': 'bg-amber-100 text-amber-800 border-amber-200',
  'USER_STATUS_TOGGLED': 'bg-rose-100 text-rose-800 border-rose-200',
};

export default function AdminAuditLogsTab({
  auditLogs,
  pagination,
  page,
  setPage,
  actionFilter,
  setActionFilter,
  entityFilter,
  setEntityFilter,
  loading,
}) {
  const [expandedLogId, setExpandedLogId] = useState(null);

  function toggleExpand(id) {
    setExpandedLogId(expandedLogId === id ? null : id);
  }

  const actionOptions = [
    { value: 'all', label: 'All Actions' },
    { value: 'COMPLAINT_ASSIGNED', label: 'COMPLAINT_ASSIGNED' },
    { value: 'STATUS_UPDATED', label: 'STATUS_UPDATED' },
    { value: 'PROGRESS_UPDATE_ADDED', label: 'PROGRESS_UPDATE_ADDED' },
    { value: 'REPAIR_EVIDENCE_UPLOADED', label: 'REPAIR_EVIDENCE_UPLOADED' },
    { value: 'OFFICIAL_CREATED', label: 'OFFICIAL_CREATED' },
    { value: 'OFFICIAL_DEPARTMENT_REASSIGNED', label: 'OFFICIAL_DEPARTMENT_REASSIGNED' },
    { value: 'USER_STATUS_TOGGLED', label: 'USER_STATUS_TOGGLED' },
  ];

  const entityOptions = [
    { value: 'all', label: 'All Entities' },
    { value: 'complaint', label: 'Complaints' },
    { value: 'user', label: 'Users / Officials' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">System Audit Trail</h3>
          <p className="text-xs text-slate-500">
            Immutable log of all administrative, departmental, and complaint lifecycle events
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-wrap gap-3">
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 font-medium focus:outline-none focus:border-purple-500"
        >
          {actionOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={entityFilter}
          onChange={(e) => {
            setEntityFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 font-medium focus:outline-none focus:border-purple-500"
        >
          {entityOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading audit logs...</div>
        ) : auditLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">No audit logs match criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-4 py-3.5">Actor</th>
                  <th className="px-4 py-3.5">Action Event</th>
                  <th className="px-4 py-3.5">Target Entity</th>
                  <th className="px-4 py-3.5">IP Address</th>
                  <th className="px-6 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  let parsedDetails = null;
                  try {
                    parsedDetails = log.details ? JSON.parse(log.details) : null;
                  } catch {
                    parsedDetails = log.details;
                  }

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-50/60 transition cursor-pointer" onClick={() => toggleExpand(log.id)}>
                        {/* Timestamp */}
                        <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                          {new Date(log.created_at).toLocaleString()}
                        </td>

                        {/* Actor */}
                        <td className="px-4 py-4">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-800">{log.user_name || 'System'}</span>
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {log.user_email || log.user_role || ''}
                            </span>
                          </div>
                        </td>

                        {/* Action Event */}
                        <td className="px-4 py-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] border ${
                              ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>

                        {/* Target Entity */}
                        <td className="px-4 py-4">
                          <span className="font-mono text-slate-700 text-[11px]">
                            {log.target_entity} {log.target_id ? `(${log.target_id.substring(0, 12)}...)` : ''}
                          </span>
                        </td>

                        {/* IP Address */}
                        <td className="px-4 py-4 text-slate-400 font-mono text-[11px]">
                          {log.ip_address || '::1'}
                        </td>

                        {/* Expand Trigger */}
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(log.id);
                            }}
                            className="p-1 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable JSON Detail Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 border-b border-slate-100">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="p-4 rounded-2xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto space-y-1">
                              <div className="text-slate-400 font-bold mb-1">Audit Record Payload ({log.id}):</div>
                              <pre>{JSON.stringify(parsedDetails, null, 2)}</pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing page <span className="font-bold text-slate-800">{page}</span> of{' '}
            <span className="font-bold text-slate-800">{pagination?.totalPages || 1}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= (pagination?.totalPages || 1)}
              onClick={() => setPage((p) => p + 1)}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
