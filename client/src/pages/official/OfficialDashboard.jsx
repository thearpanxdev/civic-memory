import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Building2,
  Shield,
  LogOut,
  RefreshCw,
  Search,
  Filter,
  CheckSquare,
  Clock,
  AlertTriangle,
  History,
  Layers,
  UserCheck,
  Activity,
  FileEdit,
  Camera,
  ChevronLeft,
  ChevronRight,
  User,
  MapPin,
  Eye,
  Plus,
  ArrowRightLeft,
  CheckCheck,
  Sparkles,
  Bot,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import OfficialAssignModal from '../../components/official/OfficialAssignModal.jsx';
import OfficialStatusModal from '../../components/official/OfficialStatusModal.jsx';
import OfficialProgressModal from '../../components/official/OfficialProgressModal.jsx';
import OfficialEvidenceModal from '../../components/official/OfficialEvidenceModal.jsx';
import OfficialDetailModal from '../../components/official/OfficialDetailModal.jsx';
import ReassignDepartmentModal from '../../components/official/ReassignDepartmentModal.jsx';
import AdminAnalyticsTab from '../../components/admin/AdminAnalyticsTab.jsx';

export default function OfficialDashboard() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Active Tab
  const [activeTab, setActiveTab] = useState('queue'); // 'queue', 'intelligence'

  // Dashboard Data State
  const [metrics, setMetrics] = useState(null);
  const [department, setDepartment] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [officials, setOfficials] = useState([]);
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination & Filters State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalComplaints, setTotalComplaints] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [wardFilter, setWardFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [routingFilter, setRoutingFilter] = useState('all');
  const [officialFilter, setOfficialFilter] = useState('all');
  const [relationFilter, setRelationFilter] = useState('all');
  const [departments, setDepartments] = useState([]);

  // Active Modals State
  const [detailModalId, setDetailModalId] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [reassignTarget, setReassignTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [progressTarget, setProgressTarget] = useState(null);
  const [evidenceTarget, setEvidenceTarget] = useState(null);

  // Toast / Banner alert
  const [toastMessage, setToastMessage] = useState(null);

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  }

  // Load initial meta and dashboard
  useEffect(() => {
    loadMetadata();
    loadDashboardMetrics();
  }, []);

  // Reload complaints when page or filters change
  useEffect(() => {
    loadComplaints();
  }, [page, statusFilter, wardFilter, severityFilter, priorityFilter, routingFilter, officialFilter, relationFilter]);

  async function loadMetadata() {
    try {
      const [wardsRes, officialsRes, deptsRes] = await Promise.all([
        fetch('/api/complaints/meta/wards'),
        fetch('/api/official/officials', { credentials: 'include' }),
        fetch('/api/complaints/meta/departments'),
      ]);
      const wardsData = await wardsRes.json();
      const officialsData = await officialsRes.json();
      const deptsData = await deptsRes.json();

      if (wardsData.wards) setWards(wardsData.wards);
      if (officialsData.officials) setOfficials(officialsData.officials);
      if (deptsData.departments) setDepartments(deptsData.departments);
    } catch (err) {
      console.error('Failed to load metadata:', err);
    }
  }

  async function loadDashboardMetrics() {
    try {
      const res = await fetch('/api/official/dashboard', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setMetrics(data.metrics);
        setDepartment(data.department);
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    }
  }

  async function loadComplaints() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
      });

      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (wardFilter !== 'all') params.append('ward_id', wardFilter);
      if (severityFilter !== 'all') params.append('severity', severityFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (routingFilter !== 'all') {
        if (routingFilter === 'manual_review') {
          params.append('requires_manual_review', '1');
        } else {
          params.append('routing_status', routingFilter);
        }
      }
      if (officialFilter !== 'all') params.append('assigned_official_id', officialFilter);
      if (relationFilter !== 'all') params.append('relation_type', relationFilter);
      if (search.trim()) params.append('search', search.trim());

      const res = await fetch(`/api/official/complaints?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch complaints.');
      }

      setComplaints(data.complaints || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalComplaints(data.pagination?.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptComplaint(complaintId) {
    try {
      const res = await fetch(`/api/official/complaints/${complaintId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to accept complaint.');
      showToast('Complaint formally accepted by department.');
      loadComplaints();
      loadDashboardMetrics();
    } catch (err) {
      showToast(err.message);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    setPage(1);
    loadComplaints();
  }

  function handleResetFilters() {
    setSearch('');
    setStatusFilter('all');
    setWardFilter('all');
    setSeverityFilter('all');
    setPriorityFilter('all');
    setRoutingFilter('all');
    setOfficialFilter('all');
    setRelationFilter('all');
    setPage(1);
  }

  const severityBadge = (sev) => {
    switch (sev) {
      case 'critical':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'high':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'medium':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const statusBadge = (st) => {
    switch (st) {
      case 'Resolved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Work Completed':
      case 'Awaiting Citizen Verification':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Assigned':
        return 'bg-cyan-100 text-cyan-800 border-cyan-300';
      case 'Reopened':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-300';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center space-x-3 text-sm animate-in slide-in-from-bottom duration-300">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Official Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-20 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link to="/" className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm hover:bg-blue-500 transition">
              <Building2 className="w-6 h-6" />
            </Link>
            <div>
              <span className="text-lg font-bold text-white tracking-tight">
                Civic<span className="text-blue-400">Memory</span>
              </span>
              <span className="ml-2 px-2.5 py-0.5 text-xs font-semibold bg-blue-500/20 text-blue-300 rounded-full border border-blue-400/30">
                Official Portal
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                loadDashboardMetrics();
                loadComplaints();
                showToast('Department feed refreshed.');
              }}
              title="Refresh Queue"
              className="p-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {isAdmin && (
              <Link
                to="/admin"
                title="Go to Municipal Administration Console"
                className="hidden sm:flex px-3 py-1.5 rounded-xl border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-semibold items-center space-x-1.5 transition"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Admin Console</span>
              </Link>
            )}

            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-bold text-slate-100">{user?.full_name}</span>
              <span className="text-xs text-blue-300 font-medium">
                {department?.name || user?.department_name || 'Municipal Official'}
              </span>
            </div>

            <button
              onClick={logout}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-rose-300 text-xs font-semibold flex items-center space-x-1.5 transition"
            >
              <LogOut className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-8 w-full">
        {/* Welcome & Department Banner */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
              <Shield className="w-3.5 h-3.5" />
              <span>Department: {department?.name || user?.department_name}</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
              Departmental Operations Console
            </h1>
            <p className="text-slate-600 text-sm">
              Review assigned civic complaints, update work progression, assign officials, and review recurring infrastructure failures.
            </p>
          </div>
        </div>

        {/* Overview KPI Cards */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Complaints</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{metrics.total}</div>
              <p className="text-xs text-slate-500 mt-1">{metrics.submitted} new submitted</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending AI Review</div>
              <div className="text-2xl font-black text-amber-600 mt-1">{metrics.pending_routing_review || 0}</div>
              <p className="text-xs text-amber-700 mt-1 font-medium">Confidence &lt; 75%</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">In Progress</div>
              <div className="text-2xl font-black text-blue-600 mt-1">{metrics.in_progress}</div>
              <p className="text-xs text-blue-700 mt-1 font-medium">{metrics.high_or_critical} high/critical</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Avg Resolution</div>
              <div className="text-2xl font-black text-emerald-600 mt-1">{metrics.average_resolution_time_hours || 0}h</div>
              <p className="text-xs text-emerald-700 mt-1 font-medium">Department turnaround</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Recurring Clusters</div>
              <div className="text-2xl font-black text-rose-600 mt-1">{metrics.recurring_count}</div>
              <p className="text-xs text-rose-600 mt-1 font-medium">Chronic failure alert</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unassigned Queue</div>
              <div className="text-2xl font-black text-amber-600 mt-1">{metrics.unassigned_count}</div>
              <p className="text-xs text-amber-700 mt-1 font-medium">Requires assignment</p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 space-x-1 sm:space-x-4">
          <button
            onClick={() => setActiveTab('queue')}
            className={`pb-3 px-3 sm:px-4 text-sm font-bold border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'queue'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Operations Queue ({metrics?.total || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('intelligence')}
            className={`pb-3 px-3 sm:px-4 text-sm font-bold border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'intelligence'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Civic Intelligence & Hotspots</span>
          </button>
        </div>

        {activeTab === 'queue' && (
          <>
            {/* Filter & Search Bar */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ticket #, title, description, or street address..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm transition"
            >
              Search
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium transition"
            >
              Reset
            </button>
          </form>

          {/* Filter Dropdowns Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-100 text-xs">
            {/* Status Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="Submitted">Submitted</option>
                <option value="Under Review">Under Review</option>
                <option value="Verified">Verified</option>
                <option value="Assigned">Assigned</option>
                <option value="In Progress">In Progress</option>
                <option value="awaiting_verification">Work Completed (Awaiting Verification)</option>
                <option value="Resolved">Resolved</option>
                <option value="Reopened">Reopened</option>
              </select>
            </div>

            {/* Ward Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ward</label>
              <select
                value={wardFilter}
                onChange={(e) => {
                  setWardFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Wards</option>
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.ward_number} - {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Severity Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Severity</label>
              <select
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Priority</label>
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Priorities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            {/* AI Routing Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">AI Routing</label>
              <select
                value={routingFilter}
                onChange={(e) => {
                  setRoutingFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Routing</option>
                <option value="manual_review">Needs Human Review</option>
                <option value="auto_routed">AI Auto-Routed</option>
                <option value="manually_assigned">Reassigned</option>
                <option value="accepted">Accepted</option>
              </select>
            </div>

            {/* Assigned Official Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned To</label>
              <select
                value={officialFilter}
                onChange={(e) => {
                  setOfficialFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Officials</option>
                <option value="unassigned">Unassigned Only</option>
                {officials.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.full_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Relation / Recurrence Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Civic Memory</label>
              <select
                value={relationFilter}
                onChange={(e) => {
                  setRelationFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Incidents</option>
                <option value="recurring">Recurring Failures Only</option>
                <option value="duplicate">Duplicates Only</option>
                <option value="standalone">Standalone Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Complaints Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Department Complaints Queue{' '}
              <span className="text-xs font-semibold text-slate-400 ml-1.5">({totalComplaints} total)</span>
            </h3>
            {loading && <div className="text-xs font-semibold text-blue-600 animate-pulse">Refreshing queue...</div>}
          </div>

          {complaints.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <CheckSquare className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-800">No complaints matching filter criteria</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try resetting search queries or adjusting status and ward filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-3.5">Ticket & Incident</th>
                    <th className="px-4 py-3.5">Ward & Location</th>
                    <th className="px-4 py-3.5">Priority</th>
                    <th className="px-4 py-3.5">Routing & Status</th>
                    <th className="px-4 py-3.5">Assigned Official</th>
                    <th className="px-6 py-3.5 text-right">Action Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {complaints.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition group">
                      {/* Ticket & Incident */}
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px] border border-blue-200">
                              {c.ticket_number}
                            </span>
                            {c.detected_language && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200" title={`Language: ${c.detected_language}`}>
                                {c.detected_language}
                              </span>
                            )}
                            {c.relation_type === 'recurring' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center space-x-1">
                                <History className="w-3 h-3" />
                                <span>Recurring #{c.recurrence_count}</span>
                              </span>
                            )}
                          </div>
                          <p className="font-bold text-slate-900 text-sm line-clamp-1">{c.title}</p>
                          <p className="text-slate-400 text-[11px] font-mono">
                            {new Date(c.created_at).toLocaleDateString()} by {c.citizen_name}
                          </p>
                        </div>
                      </td>

                      {/* Ward & Location */}
                      <td className="px-4 py-4">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-800">{c.ward_name || 'Ward'}</p>
                          <p className="text-slate-500 text-[11px] line-clamp-1">{c.address}</p>
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] border ${
                            c.priority === 'Critical' ? 'bg-rose-600 text-white border-rose-700' :
                            c.priority === 'High' ? 'bg-amber-500 text-white border-amber-600' :
                            c.priority === 'Medium' ? 'bg-blue-500 text-white border-blue-600' :
                            'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {c.priority || 'Medium'}
                          </span>
                          <span className={`block px-2 py-0.5 rounded-full font-bold uppercase text-[9px] border ${severityBadge(c.severity)}`}>
                            {c.severity}
                          </span>
                        </div>
                      </td>

                      {/* Routing & Status */}
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] border ${statusBadge(c.status)}`}>
                              {c.status}
                            </span>
                          </div>
                          {c.requires_manual_review === 1 ? (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold border border-amber-200">
                              Review Needed
                            </span>
                          ) : c.routing_status === 'auto_routed' ? (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[9px] font-bold border border-purple-200">
                              AI Routed ({c.routing_confidence}%)
                            </span>
                          ) : null}
                          <div>
                            {c.accepted_by_user_id ? (
                              <span className="inline-flex items-center space-x-1 text-[10px] text-emerald-700 font-semibold">
                                <CheckCheck className="w-3 h-3 text-emerald-600" />
                                <span>Accepted</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAcceptComplaint(c.id)}
                                className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition shadow-xs"
                              >
                                Accept
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Assigned Official */}
                      <td className="px-4 py-4">
                        {c.assigned_official_name ? (
                          <div className="flex items-center space-x-1.5 text-slate-800">
                            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                            <span className="font-semibold">{c.assigned_official_name}</span>
                          </div>
                        ) : (
                          <span className="text-amber-600 font-bold text-[11px] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            onClick={() => setDetailModalId(c.id)}
                            title="Inspect Details"
                            className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-100 text-slate-600 transition"
                          >
                            <Eye className="w-4 h-4 text-slate-700" />
                          </button>
                          <button
                            onClick={() => setReassignTarget(c)}
                            title="Reassign Department"
                            className="p-1.5 rounded-lg border border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-amber-600 transition"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => setAssignTarget(c)}
                              title={c.assigned_official_id ? "Reassign Official" : "Assign Official"}
                              className="p-1.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-blue-600 transition"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setStatusTarget(c)}
                            title="Update Status"
                            className="p-1.5 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-indigo-600 transition"
                          >
                            <Activity className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setProgressTarget(c)}
                            title="Add Progress Note"
                            className="p-1.5 rounded-lg border border-slate-200 hover:border-teal-400 hover:bg-teal-50 text-teal-600 transition"
                          >
                            <FileEdit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEvidenceTarget(c)}
                            title="Upload Repair Photo"
                            className="p-1.5 rounded-lg border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 text-emerald-600 transition"
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing page <span className="font-bold text-slate-800">{page}</span> of{' '}
              <span className="font-bold text-slate-800">{totalPages}</span>
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
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
          </>
        )}

        {activeTab === 'intelligence' && (
          <AdminAnalyticsTab />
        )}
      </main>

      {/* Modals Mounting */}
      {detailModalId && (
        <OfficialDetailModal
          complaintId={detailModalId}
          onClose={() => setDetailModalId(null)}
          onOpenAssign={isAdmin ? (c) => {
            setDetailModalId(null);
            setAssignTarget(c);
          } : undefined}
          onOpenReassign={(c) => {
            setDetailModalId(null);
            setReassignTarget(c);
          }}
          onOpenStatus={(c) => {
            setDetailModalId(null);
            setStatusTarget(c);
          }}
          onOpenProgress={(c) => {
            setDetailModalId(null);
            setProgressTarget(c);
          }}
          onOpenEvidence={(c) => {
            setDetailModalId(null);
            setEvidenceTarget(c);
          }}
          onComplaintUpdated={(msg) => {
            showToast(msg);
            loadComplaints();
            loadDashboardMetrics();
          }}
        />
      )}

      {reassignTarget && (
        <ReassignDepartmentModal
          isOpen={Boolean(reassignTarget)}
          complaint={reassignTarget}
          departments={departments}
          onClose={() => setReassignTarget(null)}
          onSuccess={(msg) => {
            showToast(msg);
            loadComplaints();
            loadDashboardMetrics();
          }}
        />
      )}

      {isAdmin && assignTarget && (
        <OfficialAssignModal
          complaint={assignTarget}
          officials={officials.filter((off) => !assignTarget.department_id || off.department_id === assignTarget.department_id)}
          onClose={() => setAssignTarget(null)}
          onSuccess={(res) => {
            showToast(res.message || 'Task assigned successfully.');
            loadComplaints();
            loadDashboardMetrics();
          }}
        />
      )}

      {statusTarget && (
        <OfficialStatusModal
          complaint={statusTarget}
          onClose={() => setStatusTarget(null)}
          onSuccess={(res) => {
            showToast(res.message);
            loadComplaints();
            loadDashboardMetrics();
          }}
        />
      )}

      {progressTarget && (
        <OfficialProgressModal
          complaint={progressTarget}
          onClose={() => setProgressTarget(null)}
          onSuccess={(res) => {
            showToast(res.message);
            loadComplaints();
          }}
        />
      )}

      {evidenceTarget && (
        <OfficialEvidenceModal
          complaint={evidenceTarget}
          onClose={() => setEvidenceTarget(null)}
          onSuccess={(res) => {
            showToast(res.message);
            loadComplaints();
          }}
        />
      )}
    </div>
  );
}
