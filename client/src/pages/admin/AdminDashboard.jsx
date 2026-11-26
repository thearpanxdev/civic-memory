import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Building2,
  ShieldAlert,
  LogOut,
  RefreshCw,
  BarChart2,
  Users,
  Layers,
  FileText,
  Activity,
  History,
  CheckCircle2,
  Clock,
  AlertTriangle,
  LifeBuoy,
  Briefcase,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminAnalyticsTab from '../../components/admin/AdminAnalyticsTab.jsx';
import AdminDepartmentsTab from '../../components/admin/AdminDepartmentsTab.jsx';
import AdminOfficialsTab from '../../components/admin/AdminOfficialsTab.jsx';
import AdminAuditLogsTab from '../../components/admin/AdminAuditLogsTab.jsx';
import AdminGrievanceSupport from '../../components/admin/AdminGrievanceSupport.jsx';
import AdminTenderManagement from '../../components/admin/AdminTenderManagement.jsx';
import CreateOfficialModal from '../../components/admin/CreateOfficialModal.jsx';
import ReassignDepartmentModal from '../../components/admin/ReassignDepartmentModal.jsx';

export default function AdminDashboard() {
  const { user, logout } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics', 'departments', 'officials', 'audit_logs'

  // Data State
  const [dashboardData, setDashboardData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [officials, setOfficials] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPagination, setAuditPagination] = useState(null);

  // Audit Logs Filter State
  const [auditPage, setAuditPage] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditEntityFilter, setAuditEntityFilter] = useState('all');

  // Loading & Toast State
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  // Modals State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [reassignTarget, setReassignTarget] = useState(null);

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  }

  useEffect(() => {
    loadAllAdminData();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit_logs') {
      loadAuditLogs();
    }
  }, [auditPage, auditActionFilter, auditEntityFilter]);

  async function loadAllAdminData() {
    setLoading(true);
    try {
      await Promise.all([
        fetchDashboardMetrics(),
        fetchDepartments(),
        fetchOfficials(),
        fetchAnalytics(),
        fetchAuditLogs(),
      ]);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDashboardMetrics() {
    const res = await fetch('/api/admin/dashboard', { credentials: 'include' });
    const data = await res.json();
    if (res.ok) setDashboardData(data);
  }

  async function fetchDepartments() {
    const res = await fetch('/api/admin/departments', { credentials: 'include' });
    const data = await res.json();
    if (res.ok) setDepartments(data.departments || []);
  }

  async function fetchOfficials() {
    const res = await fetch('/api/admin/officials', { credentials: 'include' });
    const data = await res.json();
    if (res.ok) setOfficials(data.officials || []);
  }

  async function fetchAnalytics() {
    const res = await fetch('/api/admin/analytics', { credentials: 'include' });
    const data = await res.json();
    if (res.ok) setAnalytics(data);
  }

  async function loadAuditLogs() {
    try {
      const params = new URLSearchParams({
        page: auditPage.toString(),
        limit: '20',
      });
      if (auditActionFilter !== 'all') params.append('action', auditActionFilter);
      if (auditEntityFilter !== 'all') params.append('target_entity', auditEntityFilter);

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setAuditLogs(data.logs || []);
        setAuditPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  }

  async function handleToggleStatus(targetOfficial) {
    const actionName = targetOfficial.is_active ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${actionName} account for ${targetOfficial.full_name}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/officials/${targetOfficial.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
          is_active: !targetOfficial.is_active,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update official status.');
      }

      showToast(data.message);
      fetchOfficials();
      fetchDashboardMetrics();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  }

  const metrics = dashboardData?.metrics;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center space-x-3 text-sm animate-in slide-in-from-bottom duration-300">
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Admin Header */}
      <header className="bg-purple-950 text-white sticky top-0 z-20 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link to="/" className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-sm hover:bg-purple-500 transition">
              <Building2 className="w-6 h-6" />
            </Link>
            <div>
              <span className="text-lg font-bold text-white tracking-tight">
                Civic<span className="text-purple-400">Memory</span>
              </span>
              <span className="ml-2 px-2.5 py-0.5 text-xs font-semibold bg-purple-500/20 text-purple-300 rounded-full border border-purple-400/30">
                Administration Console
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                loadAllAdminData();
                showToast('Municipal console refreshed.');
              }}
              title="Refresh Platform Data"
              className="p-2 rounded-xl border border-purple-800 hover:bg-purple-900 text-purple-300 hover:text-white transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <Link
              to="/official"
              title="Go to Operations & Task Assignment Console"
              className="px-3 py-1.5 rounded-xl border border-purple-700 bg-purple-900/60 hover:bg-purple-800 text-purple-200 text-xs font-semibold flex items-center space-x-1.5 transition"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Operations & Tasks</span>
            </Link>

            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-bold text-slate-100">{user?.full_name}</span>
              <span className="text-xs text-purple-300 font-medium">Municipal Administrator</span>
            </div>

            <button
              onClick={logout}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-purple-800 hover:bg-purple-900 text-slate-300 hover:text-rose-300 text-xs font-semibold flex items-center space-x-1.5 transition"
            >
              <LogOut className="w-4 h-4 text-purple-300" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-8 w-full">
        {/* Banner */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold border border-purple-200">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Full System Oversight & Audit Authority</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
              Municipal Platform Overview
            </h1>
            <p className="text-slate-600 text-sm">
              Cross-departmental performance metrics, official personnel management, and immutable audit logs.
            </p>
          </div>
        </div>

        {/* System KPIs Grid */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Complaints</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{metrics.totalComplaints}</div>
              <p className="text-xs text-slate-500 mt-1">{metrics.submitted} new submitted</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unique Civic Issues</div>
              <div className="text-2xl font-black text-blue-600 mt-1">{metrics.totalUniqueIssues ?? metrics.totalComplaints}</div>
              <p className="text-xs text-slate-500 mt-1">Distinct defect incidents</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Supporting Reports</div>
              <div className="text-2xl font-black text-emerald-600 mt-1">{metrics.totalSupportingReports ?? 0}</div>
              <p className="text-xs text-slate-500 mt-1">Duplicates & citizen upvotes</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Chronic Clusters</div>
              <div className="text-2xl font-black text-rose-600 mt-1">{metrics.chronicClustersCount}</div>
              <p className="text-xs text-rose-600 mt-1 font-medium">Civic memory hotspots</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Officials</div>
              <div className="text-2xl font-black text-purple-600 mt-1">{metrics.totalOfficials}</div>
              <p className="text-xs text-slate-500 mt-1">Across 5 departments</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unassigned Backlog</div>
              <div className="text-2xl font-black text-amber-600 mt-1">{metrics.unassignedCount}</div>
              <p className="text-xs text-amber-700 mt-1 font-medium">Pending assignment</p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 space-x-1 sm:space-x-4">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`pb-3 px-3 sm:px-4 text-sm font-bold border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'analytics'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>Analytics & Intelligence</span>
          </button>

          <button
            onClick={() => setActiveTab('departments')}
            className={`pb-3 px-3 sm:px-4 text-sm font-bold border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'departments'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Departments ({departments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('officials')}
            className={`pb-3 px-3 sm:px-4 text-sm font-bold border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'officials'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Official Accounts ({officials.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit_logs')}
            className={`pb-3 px-3 sm:px-4 text-sm font-bold border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'audit_logs'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Audit Trail</span>
          </button>
        </div>

        {/* Tab Panes */}
        <div>
          {activeTab === 'analytics' && <AdminAnalyticsTab analytics={analytics} dashboardData={dashboardData} loading={loading} />}

          {activeTab === 'departments' && (
            <AdminDepartmentsTab
              departments={departments}
              loading={loading}
              onRefresh={fetchDepartments}
              showToast={showToast}
            />
          )}

          {activeTab === 'officials' && (
            <AdminOfficialsTab
              officials={officials}
              departments={departments}
              onOpenCreate={() => setShowCreateModal(true)}
              onOpenReassign={(off) => setReassignTarget(off)}
              onToggleStatus={handleToggleStatus}
              loading={loading}
            />
          )}

          {activeTab === 'audit_logs' && (
            <AdminAuditLogsTab
              auditLogs={auditLogs}
              pagination={auditPagination}
              page={auditPage}
              setPage={setAuditPage}
              actionFilter={auditActionFilter}
              setActionFilter={setAuditActionFilter}
              entityFilter={auditEntityFilter}
              setEntityFilter={setAuditEntityFilter}
              loading={loading}
            />
          )}
        </div>
      </main>

      {/* Modals Mounting */}
      {showCreateModal && (
        <CreateOfficialModal
          departments={departments}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(res) => {
            showToast(res.message);
            fetchOfficials();
            fetchDashboardMetrics();
          }}
        />
      )}

      {reassignTarget && (
        <ReassignDepartmentModal
          official={reassignTarget}
          departments={departments}
          onClose={() => setReassignTarget(null)}
          onSuccess={(res) => {
            showToast(res.message);
            fetchOfficials();
            fetchDepartments();
          }}
        />
      )}
    </div>
  );
}
