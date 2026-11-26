import React, { useState, useEffect } from 'react';
import {
  LifeBuoy,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  MessageSquare,
  User,
  HardHat,
  Send,
  Eye,
  RefreshCw,
  X,
  FileText,
  Calendar,
} from 'lucide-react';

export default function AdminGrievanceSupport({ showToast }) {
  const [grievances, setGrievances] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  // Selected grievance for review modal
  const [selectedGrievanceId, setSelectedGrievanceId] = useState(null);
  const [activeGrievance, setActiveGrievance] = useState(null);
  const [activeResponses, setActiveResponses] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Response form
  const [responseText, setResponseText] = useState('');
  const [targetStatus, setTargetStatus] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);

  useEffect(() => {
    loadGrievances();
  }, [statusFilter, roleFilter, page]);

  async function loadGrievances() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
      });
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (roleFilter !== 'all') params.append('role', roleFilter);
      if (search.trim()) params.append('search', search.trim());

      const res = await fetch(`/api/admin/grievances?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setGrievances(data.grievances || []);
        setMetrics(data.metrics || null);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to load grievances:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    setPage(1);
    loadGrievances();
  }

  async function handleOpenDetail(id) {
    setSelectedGrievanceId(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/grievances/${id}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setActiveGrievance(data.grievance);
        setActiveResponses(data.responses || []);
        setTargetStatus(data.grievance.status);
      }
    } catch (err) {
      console.error('Failed to load grievance details:', err);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleSendResponse(e) {
    e.preventDefault();
    if (!responseText.trim()) return;

    setSubmittingResponse(true);
    try {
      const res = await fetch(`/api/admin/grievances/${activeGrievance.id}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
          response_text: responseText.trim(),
          status: targetStatus !== activeGrievance.status ? targetStatus : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit response.');
      }

      showToast('Grievance response recorded successfully.');
      setResponseText('');

      // Refresh detail
      handleOpenDetail(activeGrievance.id);
      loadGrievances();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubmittingResponse(false);
    }
  }

  async function handleQuickStatusChange(newStatus) {
    if (!activeGrievance) return;
    try {
      const res = await fetch(`/api/admin/grievances/${activeGrievance.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
          status: newStatus,
          admin_notes: `Status updated to ${newStatus} by Administrator.`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status.');

      showToast(`Grievance marked as ${newStatus}.`);
      handleOpenDetail(activeGrievance.id);
      loadGrievances();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'Pending':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Under Review':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Resolved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Rejected':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Metrics */}
      <div className="p-6 bg-gradient-to-r from-purple-900 to-indigo-950 text-white rounded-3xl shadow-sm border border-purple-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-800/60 text-purple-200 text-xs font-bold border border-purple-700/60">
            <LifeBuoy className="w-3.5 h-3.5 text-purple-300" />
            <span>Citizen & Engineer Grievance Support Redressal</span>
          </div>
          <h2 className="text-xl font-black tracking-tight mt-1">
            Grievance Redressal & Administrative Support
          </h2>
          <p className="text-xs text-purple-200">
            Review, investigate, respond to, and resolve escalations submitted by residents and municipal field engineers.
          </p>
        </div>

        <button
          onClick={loadGrievances}
          className="p-2 sm:px-3 sm:py-2 rounded-xl bg-purple-800/80 hover:bg-purple-700 text-purple-100 text-xs font-semibold flex items-center space-x-1.5 transition border border-purple-600/40"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* KPI Cards */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Grievances</span>
            <p className="text-xl font-black text-slate-900 mt-0.5">{metrics.total}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Pending Review</span>
            <p className="text-xl font-black text-amber-600 mt-0.5">{metrics.pending}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Under Review</span>
            <p className="text-xl font-black text-blue-600 mt-0.5">{metrics.under_review}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Resolved</span>
            <p className="text-xl font-black text-emerald-600 mt-0.5">{metrics.resolved}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">From Citizens</span>
            <p className="text-xl font-black text-indigo-700 mt-0.5">{metrics.citizen_count}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">From Engineers</span>
            <p className="text-xl font-black text-purple-700 mt-0.5">{metrics.engineer_count}</p>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tracking ID, complainant name, email, or subject..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Under Review">Under Review</option>
              <option value="Resolved">Resolved</option>
              <option value="Rejected">Rejected</option>
            </select>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Complainants</option>
              <option value="citizen">Citizens Only</option>
              <option value="official">Engineers/Officials</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition shadow-xs"
            >
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Grievance Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="px-5 py-3.5">Grievance ID</th>
                <th className="px-4 py-3.5">Complainant</th>
                <th className="px-4 py-3.5">Subject & Description</th>
                <th className="px-4 py-3.5">Related Work</th>
                <th className="px-4 py-3.5">Submitted</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                    Loading grievance queue...
                  </td>
                </tr>
              ) : grievances.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                    No grievances matching current filters.
                  </td>
                </tr>
              ) : (
                grievances.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50/60 transition group">
                    {/* Grievance Tracking ID */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-purple-800 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                        {g.tracking_number}
                      </span>
                    </td>

                    {/* Complainant Details */}
                    <td className="px-4 py-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5 font-bold text-slate-900">
                          {g.complainant_role === 'citizen' ? (
                            <User className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <HardHat className="w-3.5 h-3.5 text-amber-600" />
                          )}
                          <span>{g.complainant_name}</span>
                        </div>
                        <p className="text-[11px] text-slate-500">{g.complainant_email}</p>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                          g.complainant_role === 'citizen' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}>
                          {g.complainant_role === 'citizen' ? 'Citizen' : 'Engineer'}
                        </span>
                      </div>
                    </td>

                    {/* Subject & Description */}
                    <td className="px-4 py-4 max-w-xs sm:max-w-md">
                      <p className="font-bold text-slate-900 line-clamp-1">{g.subject}</p>
                      <p className="text-slate-500 text-[11px] line-clamp-1 mt-0.5">{g.description}</p>
                    </td>

                    {/* Related Complaint */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {g.related_ticket_number ? (
                        <span className="font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px] border border-blue-200">
                          {g.related_ticket_number}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">—</span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-4 whitespace-nowrap text-slate-500 text-[11px]">
                      {new Date(g.created_at).toLocaleDateString()}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border ${getStatusBadge(g.status)}`}>
                        {g.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleOpenDetail(g.id)}
                        className="px-3 py-1.5 rounded-xl border border-purple-200 hover:bg-purple-50 text-purple-700 font-bold text-xs flex items-center space-x-1 ml-auto transition shadow-2xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Review & Respond</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review & Respond Modal */}
      {selectedGrievanceId && activeGrievance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-purple-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                  <LifeBuoy className="w-5 h-5 text-purple-200" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-purple-200 bg-white/10 px-2 py-0.5 rounded">
                      {activeGrievance.tracking_number}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(activeGrievance.status)}`}>
                      {activeGrievance.status}
                    </span>
                  </div>
                  <h3 className="text-base font-black tracking-tight mt-1">{activeGrievance.subject}</h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedGrievanceId(null)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Scrollable */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Complainant Info Box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="grid grid-cols-2 gap-3 text-slate-700">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Complainant</span>
                    <span className="font-bold text-slate-900 text-sm">{activeGrievance.complainant_name}</span>
                    <span className="text-slate-500 block text-[11px]">{activeGrievance.complainant_email}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Role & Contact</span>
                    <span className="font-semibold text-slate-800 capitalize">
                      {activeGrievance.complainant_role === 'citizen' ? 'Registered Citizen' : 'Municipal Engineer'}
                    </span>
                    {activeGrievance.complainant_phone && (
                      <span className="text-slate-500 block text-[11px]">{activeGrievance.complainant_phone}</span>
                    )}
                  </div>
                </div>

                {activeGrievance.related_ticket_number && (
                  <div className="pt-2 border-t border-slate-200 flex items-center space-x-2">
                    <span className="text-[10px] font-bold text-slate-500">Linked Work / Complaint:</span>
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {activeGrievance.related_ticket_number}
                    </span>
                  </div>
                )}
              </div>

              {/* Full Description */}
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Grievance Description</h4>
                <div className="p-4 rounded-2xl bg-white border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
                  {activeGrievance.description}
                </div>
              </div>

              {/* Response History Timeline */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Administrative Responses & Status Updates ({activeResponses.length})
                </h4>
                {activeResponses.length === 0 ? (
                  <p className="text-slate-400 italic">No responses recorded yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {activeResponses.map((r) => (
                      <div key={r.id} className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-200/80 space-y-1">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="font-bold text-purple-950 flex items-center space-x-1">
                            <span>{r.responder_name}</span>
                            <span className="text-[10px] text-purple-600 font-normal">({r.responder_role})</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(r.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-slate-800 leading-relaxed text-xs">{r.response_text}</p>
                        {r.status_change && (
                          <div className="pt-1 text-[10px] font-bold text-indigo-700">
                            Status transition: {r.status_change}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Official Response & Status Form */}
              <form onSubmit={handleSendResponse} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <h4 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                  <MessageSquare className="w-4 h-4 text-purple-700" />
                  <span>Submit Official Response & Update Status</span>
                </h4>

                <div>
                  <textarea
                    rows={3}
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    required
                    placeholder="Enter official resolution notes, instructions, or administrative response..."
                    className="w-full p-3 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <label className="text-slate-600 font-bold text-[11px]">Set Status:</label>
                    <select
                      value={targetStatus}
                      onChange={(e) => setTargetStatus(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingResponse || !responseText.trim()}
                    className="px-5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submittingResponse ? 'Submitting...' : 'Send Response'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Modal Footer Quick Actions */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-slate-500 font-medium">Quick Status:</span>
                <button
                  type="button"
                  onClick={() => handleQuickStatusChange('Under Review')}
                  className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold border border-blue-200 transition text-[11px]"
                >
                  Under Review
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickStatusChange('Resolved')}
                  className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold border border-emerald-200 transition text-[11px]"
                >
                  Resolve
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickStatusChange('Rejected')}
                  className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold border border-rose-200 transition text-[11px]"
                >
                  Reject
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedGrievanceId(null)}
                className="px-4 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-200 font-bold text-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
