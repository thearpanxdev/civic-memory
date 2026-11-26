import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  X,
  Building2,
  MapPin,
  Clock,
  User,
  Phone,
  Mail,
  Shield,
  AlertTriangle,
  History,
  CheckCircle2,
  FileText,
  UserCheck,
  Activity,
  FileEdit,
  Camera,
  Video,
  Layers,
  ArrowRight,
  ArrowRightLeft,
  Loader2,
  Bot,
  Sparkles,
  CheckCheck,
} from 'lucide-react';

export default function OfficialDetailModal({
  complaintId,
  onClose,
  onOpenAssign,
  onOpenStatus,
  onOpenProgress,
  onOpenEvidence,
  onOpenReassign,
  onComplaintUpdated,
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'photos', 'timeline'
  const [accepting, setAccepting] = useState(false);

  // Translation revision states
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [revisedText, setRevisedText] = useState('');
  const [reviseNotes, setReviseNotes] = useState('');
  const [reviseAction, setReviseAction] = useState('manual_edit'); // 'manual_edit' | 'regenerate'
  const [revising, setRevising] = useState(false);

  useEffect(() => {
    fetchDetail();
  }, [complaintId]);

  useEffect(() => {
    if (data?.complaint) {
      setRevisedText(data.complaint.english_translation || data.complaint.description || '');
      setReviseNotes(data.complaint.translation_notes || '');
    }
  }, [data]);

  async function handleReviseTranslation(e) {
    if (e) e.preventDefault();
    setRevising(true);
    try {
      const res = await fetch(`/api/official/complaints/${complaintId}/revise-translation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: reviseAction,
          english_translation: reviseAction === 'manual_edit' ? revisedText.trim() : undefined,
          translation_notes: reviseNotes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to revise translation.');
      }
      setShowReviseModal(false);
      await fetchDetail();
      if (onComplaintUpdated) onComplaintUpdated('Complaint translation successfully revised.');
    } catch (err) {
      alert(err.message);
    } finally {
      setRevising(false);
    }
  }

  async function fetchDetail() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/official/complaints/${complaintId}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load complaint details.');
      }
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept() {
    setAccepting(true);
    try {
      const res = await fetch(`/api/official/complaints/${complaintId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to accept complaint.');
      }
      await fetchDetail();
      if (onComplaintUpdated) onComplaintUpdated('Complaint formally accepted by department.');
    } catch (err) {
      alert(err.message);
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center space-y-3 shadow-2xl">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Loading complaint audit record...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Unable to load details</h3>
          <p className="text-sm text-slate-600">{error || 'Record could not be retrieved.'}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const {
    complaint,
    images = [],
    assignments = [],
    progressUpdates = [],
    statusHistory = [],
    verifications = [],
    rootIncident,
    recurrenceChain = [],
    routing_history = [],
  } = data;

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

  const priorityBadge = (pri) => {
    switch (pri) {
      case 'Critical':
        return 'bg-rose-600 text-white border-rose-700';
      case 'High':
        return 'bg-amber-500 text-white border-amber-600';
      case 'Medium':
        return 'bg-blue-500 text-white border-blue-600';
      default:
        return 'bg-slate-500 text-white border-slate-600';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center space-x-3">
            <span className="font-mono text-sm font-bold bg-blue-600 px-2.5 py-1 rounded-lg text-white">
              {complaint.ticket_number}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusBadge(complaint.status)}`}>
              {complaint.status}
            </span>
            {complaint.priority && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${priorityBadge(complaint.priority)}`}>
                {complaint.priority} Priority
              </span>
            )}
            {complaint.relation_type === 'recurring' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-400/30 flex items-center space-x-1">
                <History className="w-3 h-3" />
                <span>Recurring ({complaint.recurrence_count}x)</span>
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-6 py-3 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
          <div className="flex flex-wrap items-center gap-2">
            {!complaint.accepted_by_user_id && (
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center space-x-1.5 shadow-sm transition font-bold"
              >
                {accepting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
                <span>Accept Complaint</span>
              </button>
            )}
            {isAdmin && onOpenAssign && (
              <button
                onClick={() => onOpenAssign(complaint)}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-blue-500 text-slate-700 hover:text-blue-600 flex items-center space-x-1.5 shadow-sm transition"
              >
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>{complaint.assigned_official_id ? 'Reassign Official' : 'Assign Official'}</span>
              </button>
            )}
            <button
              onClick={() => onOpenReassign && onOpenReassign(complaint)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-amber-500 text-slate-700 hover:text-amber-600 flex items-center space-x-1.5 shadow-sm transition"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
              <span>Reassign Dept</span>
            </button>
            <button
              onClick={() => onOpenStatus && onOpenStatus(complaint)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-indigo-500 text-slate-700 hover:text-indigo-600 flex items-center space-x-1.5 shadow-sm transition"
            >
              <Activity className="w-3.5 h-3.5 text-indigo-600" />
              <span>Update Status</span>
            </button>
            <button
              onClick={() => onOpenProgress && onOpenProgress(complaint)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-teal-500 text-slate-700 hover:text-teal-600 flex items-center space-x-1.5 shadow-sm transition"
            >
              <FileEdit className="w-3.5 h-3.5 text-teal-600" />
              <span>Progress Note</span>
            </button>
            <button
              onClick={() => onOpenEvidence && onOpenEvidence(complaint)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-emerald-500 text-slate-700 hover:text-emerald-600 flex items-center space-x-1.5 shadow-sm transition"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-600" />
              <span>Photos</span>
            </button>
          </div>

          <div className="flex items-center space-x-1 bg-slate-200/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1 rounded-lg transition ${
                activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('photos')}
              className={`px-3 py-1 rounded-lg transition ${
                activeTab === 'photos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Photos ({images.length})
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-3 py-1 rounded-lg transition ${
                activeTab === 'timeline' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Audit Trail ({assignments.length + progressUpdates.length + statusHistory.length + routing_history.length})
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Title & Category Header */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {complaint.category}
                  </span>
                  <span>•</span>
                  <span className={`px-2 py-0.5 rounded border ${severityBadge(complaint.severity)} uppercase text-[10px] font-bold`}>
                    {complaint.severity} Severity
                  </span>
                  <span>•</span>
                  <span>Reported {new Date(complaint.created_at).toLocaleString()}</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">{complaint.title}</h2>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{complaint.description}</p>
              </div>

              {/* Multilingual Citizen Report & Standardised Translation Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-white border border-blue-200 space-y-3.5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">🌐</span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                        <span>Multilingual Processing &amp; Standardised Translation</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">Citizen input preserved verbatim; standardized for municipal engineering and dispatch</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      Language: {complaint.detected_language || 'English'}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {complaint.translation_confidence || 100}% Confidence
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Original Complaint */}
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Original Citizen Submission (Verbatim)
                    </span>
                    <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {complaint.original_text || complaint.description}
                    </p>
                  </div>

                  {/* Standardised English Translation */}
                  <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wider block">
                        Standardised English Translation
                      </span>
                      {complaint.translation_revised_at && (
                        <span className="text-[10px] text-purple-700 font-semibold bg-purple-100 px-1.5 py-0.5 rounded">
                          Revised
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-purple-950 italic leading-relaxed">
                      &ldquo;{complaint.english_translation || complaint.description}&rdquo;
                    </p>
                    {complaint.translation_notes && (
                      <p className="text-[11px] text-slate-500 mt-1">
                        <strong>Official Note:</strong> {complaint.translation_notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Revise Translation Action */}
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    {complaint.translation_revised_at ? `Revised on ${new Date(complaint.translation_revised_at).toLocaleString()}` : 'AI Generated Standardised Translation'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowReviseModal(true)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition flex items-center space-x-1.5"
                  >
                    <span>Revise Translation</span>
                  </button>
                </div>
              </div>

              {/* AI Department Routing Intelligence Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50 via-indigo-50/50 to-white border border-purple-200 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-sm">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                        <span>Multimodal AI Department Routing</span>
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      </h4>
                      <p className="text-[11px] text-slate-500">Dynamically matched to active municipal department responsibilities</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                        complaint.routing_confidence >= 75
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}
                    >
                      {complaint.routing_confidence || 0}% Confidence
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${priorityBadge(complaint.priority)}`}>
                      {complaint.priority || 'Medium'} Priority
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2">
                  <div className="bg-white/90 p-3 rounded-xl border border-purple-100 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Recommended Department</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {complaint.recommended_department_name || complaint.department_name || 'Unassigned'}
                    </span>
                    {complaint.secondary_department_name && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Secondary: <span className="font-semibold text-purple-700">{complaint.secondary_department_name}</span>
                      </p>
                    )}
                  </div>
                  <div className="bg-white/90 p-3 rounded-xl border border-purple-100 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Routing Jurisdiction Rationale</span>
                    <p className="text-slate-700 text-xs leading-relaxed">
                      {complaint.routing_reason || 'Department selected based on civic issue category and infrastructure jurisdiction.'}
                    </p>
                  </div>
                </div>

                {complaint.requires_manual_review === 1 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center space-x-2 text-amber-800 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>
                      <strong>Manual Routing Review Required:</strong> Confidence score fell below threshold (75%) or multiple jurisdictions overlap. Please verify or reassign.
                    </span>
                  </div>
                )}
              </div>

              {/* Department Acceptance Status Card */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Formal Department Acceptance</div>
                  {complaint.accepted_by_user_id ? (
                    <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-800">
                      <CheckCheck className="w-4 h-4 text-emerald-600" />
                      <span>
                        Acknowledged & accepted by <strong>{complaint.accepted_by_official_name || 'Department Official'}</strong> on{' '}
                        {new Date(complaint.accepted_at).toLocaleString()}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-xs font-semibold text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Pending Department Acknowledgment — not yet accepted by an official</span>
                    </div>
                  )}
                </div>
                {!complaint.accepted_by_user_id && (
                  <button
                    onClick={handleAccept}
                    disabled={accepting}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm shrink-0"
                  >
                    {accepting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
                    <span>Accept Now</span>
                  </button>
                )}
              </div>

              {/* Civic Memory Recurrence Callout */}
              {complaint.relation_type === 'recurring' && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
                  <div className="flex items-center space-x-2 font-bold text-sm">
                    <History className="w-4 h-4 text-rose-600" />
                    <span>CivicMemory Chronic Failure Warning: Recurring Incident #{complaint.recurrence_count}</span>
                  </div>
                  <p className="text-xs text-rose-800 leading-relaxed">
                    This location has experienced repeat structural failures across multiple maintenance cycles. Root Incident:{' '}
                    <strong>{rootIncident?.ticket_number || 'Primary Incident'}</strong>. Municipal engineers recommend sub-base inspection rather than surface patching.
                  </p>
                  {recurrenceChain.length > 0 && (
                    <div className="pt-2 border-t border-rose-200/60 flex flex-wrap gap-2 text-xs">
                      <span className="font-semibold text-rose-700">Cluster Incidents:</span>
                      {recurrenceChain.map((rc) => (
                        <span key={rc.id} className="px-2 py-0.5 rounded bg-white/80 border border-rose-200 text-rose-800 font-mono text-[11px]">
                          {rc.ticket_number} ({rc.status})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Grid: Location & Citizen Contact */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Location Info */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    <span>Geographic Location</span>
                  </h4>
                  <p className="text-sm font-semibold text-slate-900">{complaint.address}</p>
                  {complaint.landmark && (
                    <p className="text-xs text-slate-600">Landmark: {complaint.landmark}</p>
                  )}
                  <p className="text-xs text-slate-500">
                    {complaint.ward_name || 'Ward'} ({complaint.ward_number || 'Zone'}) • Coordinates: {complaint.latitude?.toFixed(5)}, {complaint.longitude?.toFixed(5)}
                  </p>
                </div>

                {/* Assigned Official & Citizen Reporter */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Assignment & Reporter</span>
                  </h4>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Current Department:</span>
                      <span className="font-bold text-slate-900">{complaint.department_name || 'Unassigned'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Assigned Official:</span>
                      <span className="font-bold text-slate-800">
                        {complaint.assigned_official_name || 'Unassigned'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Reporting Citizen:</span>
                      <span className="font-semibold text-slate-800">{complaint.citizen_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Citizen Phone:</span>
                      <span className="font-mono text-slate-700">{complaint.citizen_phone || 'Not provided'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Citizen Email:</span>
                      <span className="font-mono text-slate-700">{complaint.citizen_email}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Citizen Verification Result (If any) */}
              {verifications.length > 0 && (
                <div className="p-4 rounded-2xl border border-slate-200 bg-purple-50/50 space-y-2">
                  <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-purple-600" />
                    <span>Citizen Verification Outcome</span>
                  </h4>
                  {verifications.map((v) => (
                    <div key={v.id} className="p-3 rounded-xl bg-white border border-purple-100 text-xs space-y-1 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${v.is_satisfactory ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {v.is_satisfactory ? 'Citizen Confirmed Resolution' : 'Citizen Rejected Fix (Reopened)'}
                        </span>
                        <span className="text-slate-400 font-mono text-[11px]">
                          {new Date(v.created_at).toLocaleString()}
                        </span>
                      </div>
                      {v.feedback && <p className="text-slate-700 italic">"{v.feedback}"</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'photos' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Live Geo-Tagged Evidence & Media</h3>
                <span className="text-xs text-slate-500 font-mono">{images.length} item(s)</span>
              </div>
              {images.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
                  No photographic or video evidence uploaded yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {images.map((img) => (
                    <div key={img.id} className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-slate-50 flex flex-col">
                      <div className="aspect-video relative bg-slate-900 overflow-hidden flex items-center justify-center text-white">
                        {img.media_type === 'VIDEO' ? (
                          <video
                            src={img.image_url}
                            controls
                            preload="metadata"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={img.image_url}
                            alt={img.caption || 'Evidence'}
                            className="w-full h-full object-cover hover:scale-105 transition duration-300"
                          />
                        )}
                        <div className="absolute top-2 left-2 flex items-center space-x-1 z-10 pointer-events-none">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase shadow-sm ${
                              img.media_type === 'VIDEO'
                                ? 'bg-purple-600 text-white'
                                : img.image_type === 'after_repair'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-blue-600 text-white'
                            }`}
                          >
                            {img.media_type === 'VIDEO' ? 'VIDEO' : 'PHOTO'}
                          </span>
                          {img.evidence_purpose && (
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-semibold bg-slate-950/80 text-slate-200 uppercase tracking-wider">
                              {img.evidence_purpose.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="p-3 text-xs space-y-1.5 bg-white flex-1">
                        <p className="font-semibold text-slate-800 line-clamp-1">{img.caption || 'Field Evidence'}</p>
                        
                        {img.latitude != null && (
                          <div className="flex items-center space-x-1 text-[11px] text-emerald-700 font-mono">
                            <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="truncate">
                              {Number(img.latitude).toFixed(4)}, {Number(img.longitude).toFixed(4)} (±{img.accuracy_meters || 0}m)
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100">
                          <span>{img.device_captured_at ? new Date(img.device_captured_at).toLocaleTimeString() : new Date(img.created_at).toLocaleTimeString()}</span>
                          {img.sha256_hash && (
                            <span title={`SHA-256: ${img.sha256_hash}`}>
                              SHA: {img.sha256_hash.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-6">
              {/* Department Routing & Reassignment Audit Trail */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-purple-600" />
                  <span>Department Routing & Reassignment Audit History</span>
                </h4>
                {routing_history.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No department routing audit history recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {routing_history.map((rh) => (
                      <div key={rh.id} className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800">
                            Assigned to: <strong>{rh.assigned_department_name || 'Unassigned'}</strong> (via{' '}
                            {rh.assigned_by_type === 'system_ai' ? 'Automated AI Dispatch' : `${rh.assigned_by_type} ${rh.assigned_by_name || ''}`})
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {new Date(rh.created_at).toLocaleString()}
                          </span>
                        </div>
                        {rh.recommended_department_name && (
                          <div className="text-[11px] text-slate-600">
                            Original AI Recommendation:{' '}
                            <span className="font-semibold text-purple-700">{rh.recommended_department_name}</span>{' '}
                            ({rh.confidence_score}% confidence)
                          </div>
                        )}
                        {rh.routing_reason && (
                          <p className="text-[11px] text-slate-600 italic">Routing Basis: "{rh.routing_reason}"</p>
                        )}
                        {rh.reassignment_reason && (
                          <p className="text-[11px] text-amber-800 font-medium bg-amber-50 p-2 rounded-lg border border-amber-200">
                            Reassignment Reason: "{rh.reassignment_reason}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Progress Updates */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                  <FileEdit className="w-3.5 h-3.5 text-teal-600" />
                  <span>Field Progress Logs & Notes</span>
                </h4>
                {progressUpdates.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No field progress logs recorded yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {progressUpdates.map((p) => (
                      <div key={p.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                            <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-[10px] font-bold uppercase">
                              {p.update_type}
                            </span>
                            <span>{p.official_name}</span>
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {new Date(p.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-slate-700 whitespace-pre-wrap">{p.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assignment Trail */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Official Assignment History</span>
                </h4>
                {assignments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No formal assignment history recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {assignments.map((a) => (
                      <div key={a.id} className="p-3 rounded-xl bg-blue-50/50 border border-blue-100 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-blue-900">
                            Assigned to: <strong>{a.assigned_official_name}</strong> by {a.assigned_by_name} ({a.assigned_by_role})
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {new Date(a.created_at).toLocaleString()}
                          </span>
                        </div>
                        {a.notes && <p className="text-slate-600 italic">Directive: "{a.notes}"</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lifecycle Status History */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Status Transition Trail</span>
                </h4>
                <div className="space-y-2">
                  {statusHistory.map((h) => (
                    <div key={h.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-1.5 font-semibold text-slate-800">
                          <span>{h.from_status || 'Initial'}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="font-bold text-indigo-600">{h.to_status}</span>
                        </div>
                        {h.notes && <p className="text-slate-600 mt-1 italic">"{h.notes}"</p>}
                        <p className="text-[11px] text-slate-400 mt-0.5">Changed by {h.changed_by_name || 'System'}</p>
                      </div>
                      <span className="text-slate-400 font-mono text-[11px] shrink-0">
                        {new Date(h.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Revise Translation Modal */}
      {showReviseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="text-lg">🌐</span>
                <h3 className="font-bold text-slate-900 text-sm">Revise Complaint Translation</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReviseModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Original Citizen Text ({complaint.detected_language || 'Original'}):
                </span>
                <p className="text-slate-800 italic">{complaint.original_text || complaint.description}</p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Revision Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviseAction('manual_edit')}
                    className={`p-2.5 rounded-xl border text-center font-semibold transition ${
                      reviseAction === 'manual_edit'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Manual Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviseAction('regenerate')}
                    className={`p-2.5 rounded-xl border text-center font-semibold transition ${
                      reviseAction === 'regenerate'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Regenerate with Gemini
                  </button>
                </div>
              </div>

              {reviseAction === 'manual_edit' && (
                <div className="space-y-1">
                  <label htmlFor="revised-text" className="font-bold text-slate-700 block">
                    Corrected English Translation *
                  </label>
                  <textarea
                    id="revised-text"
                    rows={4}
                    value={revisedText}
                    onChange={(e) => setRevisedText(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                    placeholder="Enter revised official English translation..."
                  ></textarea>
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="revise-notes" className="font-bold text-slate-700 block">
                  Official Notes / Justification (Optional)
                </label>
                <input
                  id="revise-notes"
                  type="text"
                  value={reviseNotes}
                  onChange={(e) => setReviseNotes(e.target.value)}
                  placeholder="e.g. Corrected colloquial street terminology, verified with ward supervisor"
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowReviseModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReviseTranslation}
                disabled={revising || (reviseAction === 'manual_edit' && !revisedText.trim())}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {revising ? 'Saving Revision...' : reviseAction === 'regenerate' ? 'Regenerate Translation' : 'Save Translation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
