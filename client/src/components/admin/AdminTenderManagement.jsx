import React, { useState, useEffect } from 'react';
import {
  FileText,
  Building2,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Award,
  XCircle,
  Send,
  Layers,
  ArrowRight,
  ShieldCheck,
  User,
  X,
  FileCheck,
  MapPin,
  IndianRupee,
} from 'lucide-react';

export default function AdminTenderManagement({ showToast }) {
  const [tenders, setTenders] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [portalFilter, setPortalFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [eligibleComplaints, setEligibleComplaints] = useState([]);
  const [publishTargetTender, setPublishTargetTender] = useState(null);
  const [statusTargetTender, setStatusTargetTender] = useState(null);
  const [traceTargetTenderId, setTraceTargetTenderId] = useState(null);
  const [activeTraceData, setActiveTraceData] = useState(null);
  const [traceLoading, setTraceLoading] = useState(false);

  // Create Tender Form State
  const [selectedComplaintId, setSelectedComplaintId] = useState('');
  const [tenderTitle, setTenderTitle] = useState('');
  const [tenderDesc, setTenderDesc] = useState('');
  const [tenderLocation, setTenderLocation] = useState('');
  const [tenderPinCode, setTenderPinCode] = useState('');
  const [tenderEstCost, setTenderEstCost] = useState('');
  const [tenderSpecs, setTenderSpecs] = useState('');
  const [tenderDeadline, setTenderDeadline] = useState('');
  const [tenderTerms, setTenderTerms] = useState('');
  const [portalType, setPortalType] = useState('state'); // 'state' or 'central'
  const [portalName, setPortalName] = useState('Karnataka Public Procurement Portal (KPPP)');
  const [portalUrl, setPortalUrl] = useState('https://kppp.karnataka.gov.in');
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Publish Form State
  const [officialRef, setOfficialRef] = useState('');
  const [externalTrackId, setExternalTrackId] = useState('');
  const [publishNotes, setPublishNotes] = useState('');
  const [submittingPublish, setSubmittingPublish] = useState(false);
  const [publishError, setPublishError] = useState(null);

  // Status Update Form State
  const [newStatus, setNewStatus] = useState('');
  const [awardedContractor, setAwardedContractor] = useState('');
  const [awardedLicense, setAwardedLicense] = useState('');
  const [awardedBidAmount, setAwardedBidAmount] = useState('');
  const [contractorContact, setContractorContact] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [submittingStatus, setSubmittingStatus] = useState(false);

  useEffect(() => {
    loadTenders();
  }, [portalFilter, statusFilter, page]);

  async function loadTenders() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
      });
      if (portalFilter !== 'all') params.append('portal_type', portalFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (search.trim()) params.append('search', search.trim());

      const res = await fetch(`/api/admin/tenders?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setTenders(data.tenders || []);
        setMetrics(data.metrics || null);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to load tenders:', err);
    } finally {
      setLoading(false);
    }
  }

  async function openCreateModal() {
    setShowCreateModal(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/admin/tenders/eligible-complaints', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setEligibleComplaints(data.complaints || []);
      }
    } catch (err) {
      console.error('Failed to load eligible complaints:', err);
    }
  }

  function handleComplaintSelect(complaintId) {
    setSelectedComplaintId(complaintId);
    const selected = eligibleComplaints.find((c) => c.id === complaintId);
    if (selected) {
      setTenderTitle(`Repair & Infrastructure Restoration: ${selected.title}`);
      setTenderDesc(
        `Execution of municipal civil restoration work for complaint ticket ${selected.ticket_number}. Description: ${selected.description}`
      );
      setTenderLocation(selected.address || 'Municipal Ward Area');
      setTenderSpecs(
        `1. Site inspection & surface preparation.\n2. Supply and compaction of graded aggregates and bitumen mix conforming to IRC specifications.\n3. Restoration of road pavement and drainage clearance.\n4. Quality certification by municipal executive engineer.`
      );
      setTenderTerms(
        `1. Eligible contractors must hold a valid Class I/II/III Government Contractor License.\n2. Standard EMD and performance guarantee apply.\n3. Bid submission and tender fee via official procurement portal.\n4. Defect liability period: 12 months post completion.`
      );
      // Default 14 days deadline
      const defaultDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
      setTenderDeadline(defaultDate);
    }
  }

  function handlePortalTypeChange(type) {
    setPortalType(type);
    if (type === 'central') {
      setPortalName('Government of India — Central Public Procurement Portal (CPPP)');
      setPortalUrl('https://eprocure.gov.in/eprocure/app');
    } else {
      setPortalName('Karnataka Public Procurement Portal (KPPP)');
      setPortalUrl('https://kppp.karnataka.gov.in');
    }
  }

  async function handleCreateTenderSubmit(e) {
    e.preventDefault();
    if (!selectedComplaintId) {
      setCreateError('Please select a municipal complaint/work order.');
      return;
    }

    setSubmittingCreate(true);
    setCreateError(null);

    try {
      const res = await fetch('/api/admin/tenders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
          complaint_id: selectedComplaintId,
          title: tenderTitle.trim(),
          description: tenderDesc.trim(),
          location: tenderLocation.trim(),
          pin_code: tenderPinCode.trim() || null,
          estimated_cost: tenderEstCost ? parseFloat(tenderEstCost) : null,
          work_specifications: tenderSpecs.trim(),
          submission_deadline: new Date(tenderDeadline).toISOString(),
          terms_and_conditions: tenderTerms.trim() || null,
          portal_type: portalType,
          portal_name: portalName.trim(),
          portal_url: portalUrl.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to prepare tender.');

      showToast(`Tender ${data.tender.tender_number} successfully prepared in Draft status.`);
      setShowCreateModal(false);
      resetCreateForm();
      loadTenders();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setSubmittingCreate(false);
    }
  }

  function resetCreateForm() {
    setSelectedComplaintId('');
    setTenderTitle('');
    setTenderDesc('');
    setTenderLocation('');
    setTenderPinCode('');
    setTenderEstCost('');
    setTenderSpecs('');
    setTenderDeadline('');
    setTenderTerms('');
  }

  async function handleConfirmPublication(e) {
    e.preventDefault();
    if (!officialRef.trim()) {
      setPublishError('Official tender reference number is required.');
      return;
    }

    setSubmittingPublish(true);
    setPublishError(null);

    try {
      const res = await fetch(`/api/admin/tenders/${publishTargetTender.id}/publish`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
          official_tender_ref: officialRef.trim(),
          external_tracking_id: externalTrackId.trim() || null,
          notes: publishNotes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to confirm publication.');

      showToast(`Tender confirmed published on ${publishTargetTender.portal_name}.`);
      setPublishTargetTender(null);
      setOfficialRef('');
      setExternalTrackId('');
      setPublishNotes('');
      loadTenders();
    } catch (err) {
      setPublishError(err.message);
    } finally {
      setSubmittingPublish(false);
    }
  }

  async function handleUpdateStatusSubmit(e) {
    e.preventDefault();
    if (!newStatus) return;

    setSubmittingStatus(true);
    try {
      const res = await fetch(`/api/admin/tenders/${statusTargetTender.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
          status: newStatus,
          awarded_contractor_name: awardedContractor.trim() || null,
          awarded_contractor_license: awardedLicense.trim() || null,
          awarded_bid_amount: awardedBidAmount ? parseFloat(awardedBidAmount) : null,
          contractor_contact: contractorContact.trim() || null,
          notes: statusNotes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update tender status.');

      showToast(`Tender status updated to ${newStatus}.`);
      setStatusTargetTender(null);
      loadTenders();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubmittingStatus(false);
    }
  }

  async function openTraceabilityModal(tenderId) {
    setTraceTargetTenderId(tenderId);
    setTraceLoading(true);
    try {
      const res = await fetch(`/api/admin/tenders/${tenderId}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setActiveTraceData(data);
      }
    } catch (err) {
      console.error('Failed to load traceability details:', err);
    } finally {
      setTraceLoading(false);
    }
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'Draft':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'Ready for Publication':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Published':
      case 'Bidding Open':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Bidding Closed':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Under Evaluation':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Awarded':
        return 'bg-teal-100 text-teal-800 border-teal-300';
      case 'Cancelled':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="p-6 bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 text-white rounded-3xl shadow-sm border border-purple-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-800/60 text-purple-200 text-xs font-bold border border-purple-700/60">
            <Building2 className="w-3.5 h-3.5 text-purple-300" />
            <span>State & Central Public Procurement Management</span>
          </div>
          <h2 className="text-xl font-black tracking-tight mt-1">
            Government Tender & Procurement Management
          </h2>
          <p className="text-xs text-purple-200 max-w-2xl">
            Prepare municipal work packages, coordinate assisted publication on official State & Central portals (CPPP / State eProc),
            and enable registered contractors to review specifications and apply for bids.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center space-x-1.5 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Prepare New Tender</span>
          </button>
          <button
            onClick={loadTenders}
            className="p-2 rounded-xl bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700/60 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Tenders</span>
            <p className="text-xl font-black text-slate-900 mt-0.5">{metrics.total}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Drafts</span>
            <p className="text-xl font-black text-slate-700 mt-0.5">{metrics.draft}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Open for Bidding</span>
            <p className="text-xl font-black text-emerald-600 mt-0.5">
              {(metrics.published || 0) + (metrics.bidding_open || 0)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Under Evaluation</span>
            <p className="text-xl font-black text-blue-600 mt-0.5">
              {(metrics.bidding_closed || 0) + (metrics.under_evaluation || 0)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Awarded Works</span>
            <p className="text-xl font-black text-teal-600 mt-0.5">{metrics.awarded}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Portal Split</span>
            <p className="text-xs font-bold text-slate-800 mt-1">
              State: {metrics.state_count} | Central: {metrics.central_count}
            </p>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tender ID, official ref #, project title, or ticket #..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto text-xs">
          {/* Portal Filter */}
          <select
            value={portalFilter}
            onChange={(e) => {
              setPortalFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Portals</option>
            <option value="state">State Procurement Portals</option>
            <option value="central">Central Portal (CPPP)</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Ready for Publication">Ready for Publication</option>
            <option value="Published">Published / Bidding Open</option>
            <option value="Bidding Closed">Bidding Closed</option>
            <option value="Under Evaluation">Under Evaluation</option>
            <option value="Awarded">Awarded</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <button
            onClick={() => {
              setPage(1);
              loadTenders();
            }}
            className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold transition shadow-xs"
          >
            Filter
          </button>
        </div>
      </div>

      {/* Tender Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="px-5 py-3.5">Internal Tender ID</th>
                <th className="px-4 py-3.5">Work / Grievance ID</th>
                <th className="px-4 py-3.5">Project Name & Location</th>
                <th className="px-4 py-3.5">Assigned Engineer</th>
                <th className="px-4 py-3.5">Government Portal</th>
                <th className="px-4 py-3.5">Official Tender Ref #</th>
                <th className="px-4 py-3.5">Bid Deadline</th>
                <th className="px-4 py-3.5">Tender Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-medium">
                    Loading government tender registry...
                  </td>
                </tr>
              ) : tenders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-medium">
                    No government tenders found matching current filters.
                  </td>
                </tr>
              ) : (
                tenders.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition group">
                    {/* Internal Tender ID */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-purple-800 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                        {t.tender_number}
                      </span>
                    </td>

                    {/* Complaint Reference */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[11px]">
                        {t.complaint_ticket_number}
                      </span>
                    </td>

                    {/* Project Name & Location */}
                    <td className="px-4 py-4 max-w-xs">
                      <p className="font-bold text-slate-900 line-clamp-1">{t.title}</p>
                      <p className="text-slate-500 text-[11px] line-clamp-1 flex items-center space-x-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{t.location}</span>
                      </p>
                      {t.estimated_cost && (
                        <p className="text-emerald-700 font-bold text-[11px] mt-0.5">
                          Est. Cost: ₹{t.estimated_cost.toLocaleString('en-IN')}
                        </p>
                      )}
                    </td>

                    {/* Assigned Engineer */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">
                        {t.assigned_official_name || 'Unassigned'}
                      </div>
                      <div className="text-[10px] text-slate-400">{t.assigned_official_email}</div>
                    </td>

                    {/* Government Portal */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          t.portal_type === 'central' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {t.portal_type === 'central' ? 'CPPP Central' : 'State eProc'}
                        </span>
                      </div>
                      <a
                        href={t.portal_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-purple-700 hover:underline flex items-center space-x-0.5 mt-0.5 font-medium"
                      >
                        <span className="truncate max-w-[130px]">{t.portal_name}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </td>

                    {/* Official Tender Reference */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {t.official_tender_ref ? (
                        <div className="space-y-0.5">
                          <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                            {t.official_tender_ref}
                          </span>
                          <p className="text-[10px] text-slate-400">
                            Pub: {new Date(t.published_at).toLocaleDateString()}
                          </p>
                        </div>
                      ) : (
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-200">
                          Pending Publication
                        </span>
                      )}
                    </td>

                    {/* Submission Deadline */}
                    <td className="px-4 py-4 whitespace-nowrap text-slate-600 font-medium">
                      {new Date(t.submission_deadline).toLocaleDateString()}{' '}
                      <span className="text-[10px] text-slate-400">
                        {new Date(t.submission_deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border ${getStatusBadge(t.status)}`}>
                        {t.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center space-x-1.5">
                        {/* Traceability Modal */}
                        <button
                          onClick={() => openTraceabilityModal(t.id)}
                          title="View Traceability Chain"
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
                        >
                          <Layers className="w-3.5 h-3.5" />
                        </button>

                        {/* Assisted Publication Button (if Draft or Ready) */}
                        {(!t.official_tender_ref || t.status === 'Draft' || t.status === 'Ready for Publication') && (
                          <button
                            onClick={() => {
                              setPublishTargetTender(t);
                              setOfficialRef('');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center space-x-1 transition shadow-2xs"
                          >
                            <Send className="w-3 h-3" />
                            <span>Confirm Pub</span>
                          </button>
                        )}

                        {/* Update Status (Awarded, Closed, etc.) */}
                        <button
                          onClick={() => {
                            setStatusTargetTender(t);
                            setNewStatus(t.status);
                            setAwardedContractor(t.awarded_contractor_name || '');
                            setAwardedLicense(t.awarded_contractor_license || '');
                            setAwardedBidAmount(t.awarded_bid_amount || '');
                          }}
                          title="Update Tender Lifecycle Status"
                          className="px-2.5 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-50 text-purple-700 font-bold text-[11px] transition"
                        >
                          Status
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE TENDER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl max-h-[92vh] rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-purple-950 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                  <FileText className="w-5 h-5 text-purple-200" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Prepare Government Tender Package</h3>
                  <p className="text-xs text-purple-200">Prepare municipal work task for official procurement bidding</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateTenderSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {createError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Select Eligible Complaint / Work Order */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Work Order / Complaint <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedComplaintId}
                  onChange={(e) => handleComplaintSelect(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                >
                  <option value="">-- Choose an assigned municipal work task --</option>
                  {eligibleComplaints.map((c) => (
                    <option key={c.id} value={c.id} disabled={!!c.existing_tender_id}>
                      {c.ticket_number} — {c.title} ({c.status}) {c.existing_tender_id ? '[Tender Active]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Government Portal Selection (State vs Central) */}
              <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200 space-y-3">
                <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wider block">
                  Procurement Portal Destination
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center space-x-2.5 ${
                      portalType === 'state'
                        ? 'bg-white border-purple-600 shadow-xs ring-1 ring-purple-600/20'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="portal_type"
                      checked={portalType === 'state'}
                      onChange={() => handlePortalTypeChange('state')}
                      className="text-purple-600"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">State Portal (State-wise)</span>
                      <span className="text-[10px] text-slate-500">e-Procurement portal (KPPP, MahaTenders, etc.)</span>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center space-x-2.5 ${
                      portalType === 'central'
                        ? 'bg-white border-purple-600 shadow-xs ring-1 ring-purple-600/20'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="portal_type"
                      checked={portalType === 'central'}
                      onChange={() => handlePortalTypeChange('central')}
                      className="text-purple-600"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">Central Government (CPPP)</span>
                      <span className="text-[10px] text-slate-500">Government of India procurement portal</span>
                    </div>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div>
                    <label className="text-slate-600 font-medium">Portal Name:</label>
                    <input
                      type="text"
                      value={portalName}
                      onChange={(e) => setPortalName(e.target.value)}
                      required
                      className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 font-medium">Portal URL:</label>
                    <input
                      type="url"
                      value={portalUrl}
                      onChange={(e) => setPortalUrl(e.target.value)}
                      required
                      className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Title & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Project / Work Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={tenderTitle}
                    onChange={(e) => setTenderTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Work Location <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={tenderLocation}
                    onChange={(e) => setTenderLocation(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Location PIN Code
                  </label>
                  <input
                    type="text"
                    value={tenderPinCode}
                    onChange={(e) => setTenderPinCode(e.target.value)}
                    placeholder="e.g. 560038"
                    maxLength={6}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Estimated Cost (INR ₹)
                  </label>
                  <input
                    type="number"
                    value={tenderEstCost}
                    onChange={(e) => setTenderEstCost(e.target.value)}
                    placeholder="e.g. 450000"
                    min="1"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Bid Submission Deadline <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={tenderDeadline}
                    onChange={(e) => setTenderDeadline(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              </div>

              {/* Work Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Detailed Work Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={tenderDesc}
                  onChange={(e) => setTenderDesc(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              {/* Work Specifications & Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Work Specifications & Requirements <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={tenderSpecs}
                    onChange={(e) => setTenderSpecs(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Terms & Conditions / Eligibility
                  </label>
                  <textarea
                    rows={4}
                    value={tenderTerms}
                    onChange={(e) => setTenderTerms(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate}
                  className="px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold transition flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>{submittingCreate ? 'Preparing...' : 'Create Draft Tender'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSISTED PUBLICATION CONFIRMATION MODAL */}
      {publishTargetTender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-5 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                  <Send className="w-5 h-5 text-emerald-200" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Assisted Tender Publication</h3>
                  <p className="text-xs text-emerald-200">{publishTargetTender.tender_number}</p>
                </div>
              </div>
              <button
                onClick={() => setPublishTargetTender(null)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPublication} className="p-6 space-y-4 text-xs">
              {publishError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{publishError}</span>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                <div className="font-bold text-xs flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>Official Government Portal Integration Workflow</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Official procurement portals (CPPP / State eProc) require digital signatures (Class-3 DSC) and authorized departmental nodal officer authentication.
                </p>
                <div className="pt-2">
                  <a
                    href={publishTargetTender.portal_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition shadow-2xs"
                  >
                    <span>Open {publishTargetTender.portal_name}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Official Tender Reference Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={officialRef}
                  onChange={(e) => setOfficialRef(e.target.value)}
                  required
                  placeholder="e.g. CPPP/2026/PWD/89124 or KP/2026/W/4412"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Obtained after uploading and digitally signing the tender on the official government portal.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  External Tracking / Tender ID (Optional)
                </label>
                <input
                  type="text"
                  value={externalTrackId}
                  onChange={(e) => setExternalTrackId(e.target.value)}
                  placeholder="e.g. 2026_PWD_781901_1"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Publication Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={publishNotes}
                  onChange={(e) => setPublishNotes(e.target.value)}
                  placeholder="e.g. Published under NIT Notice #14. Hardcopy files archived in PWD Room 3."
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setPublishTargetTender(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPublish || !officialRef.trim()}
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{submittingPublish ? 'Confirming...' : 'Confirm Official Publication'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPDATE STATUS MODAL (Awarded, Closed, etc.) */}
      {statusTargetTender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-5 bg-gradient-to-r from-purple-950 to-indigo-950 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-black tracking-tight">Update Tender Status</h3>
                <p className="text-xs text-purple-200 font-mono">{statusTargetTender.tender_number}</p>
              </div>
              <button
                onClick={() => setStatusTargetTender(null)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStatusSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Tender Lifecycle Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 text-xs"
                >
                  <option value="Draft">Draft</option>
                  <option value="Ready for Publication">Ready for Publication</option>
                  <option value="Published">Published</option>
                  <option value="Bidding Open">Bidding Open</option>
                  <option value="Bidding Closed">Bidding Closed</option>
                  <option value="Under Evaluation">Under Evaluation</option>
                  <option value="Awarded">Awarded (Contractor Selected)</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {/* Awarded Contractor Details */}
              {newStatus === 'Awarded' && (
                <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 space-y-3">
                  <div className="font-bold text-teal-900 text-xs flex items-center space-x-1.5">
                    <Award className="w-4 h-4 text-teal-700" />
                    <span>Contractor & Bid Award Information</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-teal-900 mb-1">
                      Awarded Contractor Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={awardedContractor}
                      onChange={(e) => setAwardedContractor(e.target.value)}
                      required
                      placeholder="e.g. Apex Infrastructure Projects Pvt Ltd"
                      className="w-full px-3 py-1.5 rounded-lg border border-teal-300 bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-teal-900 mb-1">License Number</label>
                      <input
                        type="text"
                        value={awardedLicense}
                        onChange={(e) => setAwardedLicense(e.target.value)}
                        placeholder="e.g. PWD-CL1-2024-89"
                        className="w-full px-3 py-1.5 rounded-lg border border-teal-300 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-teal-900 mb-1">Bid Amount (₹)</label>
                      <input
                        type="number"
                        value={awardedBidAmount}
                        onChange={(e) => setAwardedBidAmount(e.target.value)}
                        placeholder="e.g. 420000"
                        className="w-full px-3 py-1.5 rounded-lg border border-teal-300 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Status Transition Notes
                </label>
                <textarea
                  rows={2}
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="e.g. Technical evaluation completed; financial bid opened on portal."
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setStatusTargetTender(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingStatus}
                  className="px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold transition disabled:opacity-50"
                >
                  {submittingStatus ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRACEABILITY MODAL */}
      {traceTargetTenderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-3xl max-h-[92vh] rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-5 bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                  <Layers className="w-5 h-5 text-purple-200" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">End-to-End Project Traceability</h3>
                  <p className="text-xs text-purple-200">Grievance → Work Order → Engineer → Tender → Contractor</p>
                </div>
              </div>
              <button
                onClick={() => setTraceTargetTenderId(null)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {traceLoading || !activeTraceData ? (
                <div className="py-12 text-center text-slate-400">Loading project traceability chain...</div>
              ) : (
                <>
                  {/* Visual Trace Flow Cards */}
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Traceability Chain & Governance Provenance
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
                      {/* Step 1: Citizen Grievance */}
                      <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 space-y-1">
                        <span className="text-[10px] font-bold text-blue-700 uppercase">1. Citizen Grievance</span>
                        <p className="font-mono font-bold text-slate-900 text-xs">
                          {activeTraceData.traceability.citizen_grievance.ticket_number}
                        </p>
                        <p className="text-slate-600 line-clamp-1">{activeTraceData.traceability.citizen_grievance.title}</p>
                        <span className="text-[10px] text-slate-500 block">
                          By: {activeTraceData.traceability.citizen_grievance.complainant_name}
                        </span>
                      </div>

                      {/* Step 2: Work Order */}
                      <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 space-y-1">
                        <span className="text-[10px] font-bold text-purple-700 uppercase">2. Work Order</span>
                        <p className="font-mono font-bold text-slate-900 text-xs">
                          {activeTraceData.traceability.work_order.assignment_id}
                        </p>
                        <p className="text-slate-600 line-clamp-1">{activeTraceData.traceability.work_order.notes}</p>
                        {activeTraceData.traceability.work_order.deadline_at && (
                          <span className="text-[10px] text-purple-700 font-bold block">
                            Due: {new Date(activeTraceData.traceability.work_order.deadline_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {/* Step 3: Assigned Engineer */}
                      <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-1">
                        <span className="text-[10px] font-bold text-amber-700 uppercase">3. Assigned Engineer</span>
                        <p className="font-bold text-slate-900 text-xs line-clamp-1">
                          {activeTraceData.traceability.assigned_engineer.full_name}
                        </p>
                        <p className="text-slate-600 text-[10px] line-clamp-1">
                          {activeTraceData.traceability.assigned_engineer.department_name}
                        </p>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {activeTraceData.traceability.assigned_engineer.email}
                        </span>
                      </div>

                      {/* Step 4: Government Tender */}
                      <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-1">
                        <span className="text-[10px] font-bold text-indigo-700 uppercase">4. Internal Tender</span>
                        <p className="font-mono font-bold text-slate-900 text-xs">
                          {activeTraceData.traceability.internal_tender.tender_number}
                        </p>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${getStatusBadge(activeTraceData.traceability.internal_tender.status)}`}>
                          {activeTraceData.traceability.internal_tender.status}
                        </span>
                      </div>

                      {/* Step 5: Official Reference / Contractor */}
                      <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase">5. Official Portal & Award</span>
                        <p className="font-mono font-bold text-emerald-900 text-xs truncate">
                          {activeTraceData.traceability.official_government_portal.official_tender_ref || 'Awaiting Pub'}
                        </p>
                        {activeTraceData.traceability.contractor_bid ? (
                          <span className="text-[10px] text-teal-800 font-bold block truncate">
                            Awarded: {activeTraceData.traceability.contractor_bid.contractor_name}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 block">Pending Contractor Award</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Official Portal Redirection Link */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Official Portal</span>
                      <p className="font-bold text-slate-900 text-sm">{activeTraceData.tender.portal_name}</p>
                      <p className="text-slate-500 text-[11px]">
                        Official Ref #: {activeTraceData.tender.official_tender_ref || 'Not yet published'}
                      </p>
                    </div>

                    <a
                      href={activeTraceData.tender.portal_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs flex items-center space-x-1.5 transition shadow-2xs"
                    >
                      <span>View on Official Portal</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* Audit Trail Timeline */}
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Tender Lifecycle Audit Trail ({activeTraceData.auditLogs.length})
                    </h4>
                    <div className="space-y-2">
                      {activeTraceData.auditLogs.map((log) => (
                        <div key={log.id} className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-900">{log.action}: </span>
                            <span className="text-slate-600">{log.details}</span>
                            <span className="text-[10px] text-purple-700 block font-medium">By: {log.admin_name}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setTraceTargetTenderId(null)}
                className="px-4 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-200 font-bold text-slate-700"
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
