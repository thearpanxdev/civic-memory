import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Building2,
  LogOut,
  PlusCircle,
  FileText,
  CheckCircle2,
  History,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  ThumbsUp,
  MapPin,
  Clock,
  ShieldCheck,
  Globe,
  User,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ComplaintCard from '../../components/citizen/ComplaintCard.jsx';
import ComplaintDetailModal from '../../components/citizen/ComplaintDetailModal.jsx';
import NewComplaintModal from '../../components/citizen/NewComplaintModal.jsx';

export default function CitizenDashboard() {
  const { user, logout } = useAuth();

  // Active Tab: 'my' or 'community'
  const [activeTab, setActiveTab] = useState('my');

  // Complaints Data
  const [myComplaints, setMyComplaints] = useState([]);
  const [communityComplaints, setCommunityComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Modals State
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);

  // Set of supported complaint IDs
  const [supportedMap, setSupportedMap] = useState({});

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchMyComplaints(), fetchCommunityComplaints()]);
    } catch (err) {
      setError('Failed to sync civic dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchMyComplaints() {
    try {
      const res = await fetch('/api/complaints?scope=my', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setMyComplaints(data.complaints || []);
      }
    } catch (err) {
      console.warn('Error fetching my complaints:', err);
    }
  }

  async function fetchCommunityComplaints() {
    try {
      const res = await fetch('/api/complaints', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setCommunityComplaints(data.complaints || []);
      }
    } catch (err) {
      console.warn('Error fetching community complaints:', err);
    }
  }

  async function handleSupport(complaintId) {
    try {
      const res = await fetch(`/api/complaints/${complaintId}/support`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ comment: 'Supported via Citizen Portal' }),
      });

      const data = await res.json();
      if (res.ok) {
        setSupportedMap((prev) => ({ ...prev, [complaintId]: true }));
        // Update local count
        setCommunityComplaints((prev) =>
          prev.map((c) => (c.id === complaintId ? { ...c, support_count: data.support_count } : c))
        );
        setMyComplaints((prev) =>
          prev.map((c) => (c.id === complaintId ? { ...c, support_count: data.support_count } : c))
        );
      } else if (res.status === 409) {
        setSupportedMap((prev) => ({ ...prev, [complaintId]: true }));
      }
    } catch (err) {
      console.error('Error supporting complaint:', err);
    }
  }

  // Derived Statistics
  const totalMySubmissions = myComplaints.length;
  const inProgressCount = myComplaints.filter((c) =>
    ['Under Review', 'Verified', 'Assigned', 'In Progress'].includes(c.status)
  ).length;
  const awaitingVerificationCount = myComplaints.filter((c) =>
    ['Work Completed', 'Awaiting Citizen Verification'].includes(c.status)
  ).length;
  const resolvedCount = myComplaints.filter((c) => c.status === 'Resolved').length;

  // Filter complaints list
  const sourceList = activeTab === 'my' ? myComplaints : communityComplaints;
  const filteredComplaints = sourceList.filter((c) => {
    const matchesSearch =
      !searchQuery.trim() ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.ticket_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.address && c.address.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchesCategory = categoryFilter === 'ALL' || c.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Portal Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link to="/" className="w-10 h-10 rounded-xl bg-civic-600 flex items-center justify-center text-white shadow-sm">
              <Building2 className="w-6 h-6" />
            </Link>
            <div>
              <span className="text-lg font-bold text-slate-900">
                Civic<span className="text-civic-600">Memory</span>
              </span>
              <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                Citizen Portal
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-bold text-slate-900">{user?.full_name}</span>
              <span className="text-xs text-slate-500">{user?.email}</span>
            </div>
            <button
              onClick={logout}
              className="p-2 sm:px-3 sm:py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition"
            >
              <LogOut className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-8">
        {/* Welcome Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-civic-600 to-indigo-700 text-white shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold uppercase tracking-wider backdrop-blur-xs">
                Civic Intelligence
              </span>
              <span className="text-xs text-civic-200">Continuous Municipal Memory</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {user?.full_name?.split(' ')[0]}!
            </h1>
            <p className="text-civic-100 text-sm leading-relaxed">
              Your reports build an immutable, auditable civic memory that uncovers recurring infrastructure breakdowns and accelerates municipal accountability.
            </p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="px-6 py-3 rounded-2xl bg-white text-civic-700 font-bold text-sm shadow-md hover:bg-civic-50 transition flex items-center space-x-2 shrink-0 group"
          >
            <PlusCircle className="w-5 h-5 text-civic-600 group-hover:rotate-90 transition duration-200" />
            <span>Report New Problem</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">My Submissions</span>
              <FileText className="w-4 h-4 text-civic-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{totalMySubmissions}</div>
            <p className="text-[11px] text-slate-400">Total reports submitted by you</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">In Progress</span>
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{inProgressCount}</div>
            <p className="text-[11px] text-slate-400">Under official review or repair</p>
          </div>

          <div className={`p-5 rounded-2xl border shadow-xs space-y-1 transition ${
            awaitingVerificationCount > 0
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-100'
              : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Needs Verification</span>
              <ShieldCheck className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-950">{awaitingVerificationCount}</div>
            <p className="text-[11px] text-amber-700">Awaiting your resolution sign-off</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Resolved</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{resolvedCount}</div>
            <p className="text-[11px] text-slate-400">Fixed and citizen-verified</p>
          </div>
        </div>

        {/* Tab Navigation & Search Toolbar */}
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            {/* Tabs */}
            <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-2xl">
              <button
                onClick={() => setActiveTab('my')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                  activeTab === 'my'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-4 h-4 text-civic-600" />
                <span>My Submissions ({myComplaints.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('community')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                  activeTab === 'community'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="w-4 h-4 text-purple-600" />
                <span>Community Issues ({communityComplaints.length})</span>
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={loadAllData}
              disabled={loading}
              className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center space-x-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Data</span>
            </button>
          </div>

          {/* Search & Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket #, title, or address..."
                className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-civic-500 bg-white"
              />
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-civic-500 text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="Submitted">Submitted</option>
                <option value="Under Review">Under Review</option>
                <option value="In Progress">In Progress</option>
                <option value="Work Completed">Work Completed</option>
                <option value="Awaiting Citizen Verification">Awaiting Citizen Verification</option>
                <option value="Resolved">Resolved</option>
                <option value="Reopened">Reopened</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-civic-500 text-slate-700"
              >
                <option value="ALL">All Categories</option>
                <option value="Roads and Infrastructure">Roads and Infrastructure</option>
                <option value="Sanitation and Waste Management">Sanitation and Waste Management</option>
                <option value="Water Supply">Water Supply</option>
                <option value="Drainage and Sewerage">Drainage and Sewerage</option>
                <option value="Street Lighting">Street Lighting</option>
              </select>
            </div>
          </div>
        </div>

        {/* Complaints Grid / Feed */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-civic-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-slate-500">Loading civic complaints...</p>
          </div>
        ) : filteredComplaints.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredComplaints.map((comp) => (
              <ComplaintCard
                key={comp.id}
                complaint={comp}
                isOwner={comp.citizen_id === user?.id}
                onOpenDetails={(c) => setSelectedComplaintId(c.id)}
                onSupport={handleSupport}
                isSupported={!!supportedMap[comp.id]}
              />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 space-y-4">
            <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <FileText className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800">
                {activeTab === 'my' ? 'No complaints submitted yet' : 'No matching community issues'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {activeTab === 'my'
                  ? 'Have you noticed a pothole, leaking pipe, or dark street? File a report to initiate municipal tracking.'
                  : 'Try clearing your search query or status filter to see other community reports.'}
              </p>
            </div>
            {activeTab === 'my' && (
              <button
                onClick={() => setShowNewModal(true)}
                className="px-5 py-2.5 rounded-xl bg-civic-600 hover:bg-civic-700 text-white font-bold text-xs shadow transition inline-flex items-center space-x-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Submit Your First Report</span>
              </button>
            )}
          </div>
        )}
      </main>

      {/* New Complaint Submission Modal */}
      {showNewModal && (
        <NewComplaintModal
          onClose={() => setShowNewModal(false)}
          onSuccess={() => {
            loadAllData();
          }}
        />
      )}

      {/* Complaint Detail & Verification Modal */}
      {selectedComplaintId && (
        <ComplaintDetailModal
          complaintId={selectedComplaintId}
          onClose={() => setSelectedComplaintId(null)}
          onRefresh={loadAllData}
        />
      )}
    </div>
  );
}
