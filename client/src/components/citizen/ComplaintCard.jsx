import React from 'react';
import {
  MapPin,
  Calendar,
  ThumbsUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  Layers,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

const STATUS_CONFIG = {
  'Submitted': { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-400' },
  'Under Review': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  'Verified': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
  'Assigned': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  'In Progress': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  'Work Completed': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' },
  'Awaiting Citizen Verification': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300', dot: 'bg-orange-500' },
  'Resolved': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  'Reopened': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
};

const SEVERITY_CONFIG = {
  low: { label: 'Low Severity', color: 'text-slate-600 bg-slate-100' },
  medium: { label: 'Medium Severity', color: 'text-blue-700 bg-blue-100' },
  high: { label: 'High Priority', color: 'text-amber-700 bg-amber-100' },
  critical: { label: 'Critical Hazard', color: 'text-rose-700 bg-rose-100' },
};

export default function ComplaintCard({
  complaint,
  isOwner = false,
  onOpenDetails,
  onSupport,
  isSupported = false,
}) {
  const statusStyle = STATUS_CONFIG[complaint.status] || STATUS_CONFIG['Submitted'];
  const severityStyle = SEVERITY_CONFIG[complaint.severity] || SEVERITY_CONFIG['medium'];

  const isVerifiable = isOwner && (
    complaint.status === 'Work Completed' ||
    complaint.status === 'Awaiting Citizen Verification'
  );

  const formattedDate = complaint.created_at
    ? new Date(complaint.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition p-5 flex flex-col justify-between space-y-4">
      {/* Top Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <span className="font-mono text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg border border-slate-200">
            {complaint.ticket_number}
          </span>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border} flex items-center space-x-1.5`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}></span>
            <span>{complaint.status}</span>
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          {complaint.is_recurring === 1 && (
            <span className="text-xs font-bold px-2 py-0.5 bg-purple-100 text-purple-700 rounded-md flex items-center space-x-1 border border-purple-200" title="Historical recurring infrastructure failure detected at this location">
              <History className="w-3 h-3 text-purple-600" />
              <span>Recurring (×{complaint.recurrence_count || 1})</span>
            </span>
          )}
          {complaint.relation_type === 'duplicate' && (
            <span className="text-xs font-bold px-2 py-0.5 bg-sky-100 text-sky-700 rounded-md flex items-center space-x-1 border border-sky-200" title="Linked duplicate report">
              <Layers className="w-3 h-3 text-sky-600" />
              <span>Duplicate</span>
            </span>
          )}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${severityStyle.color}`}>
            {severityStyle.label}
          </span>
        </div>
      </div>

      {/* Title & Description */}
      <div className="space-y-1.5">
        <h3
          onClick={() => onOpenDetails && onOpenDetails(complaint)}
          className="text-base font-bold text-slate-900 hover:text-civic-600 cursor-pointer transition line-clamp-1"
        >
          {complaint.title}
        </h3>
        <p className="text-sm text-slate-600 line-clamp-2">
          {complaint.description}
        </p>
      </div>

      {/* Location & Department Metadata */}
      <div className="space-y-1.5 text-xs text-slate-500 border-t border-slate-100 pt-3">
        <div className="flex items-center space-x-1.5 text-slate-600 font-medium">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">{complaint.address || complaint.landmark || 'Location specified'}</span>
          {complaint.ward_name && (
            <span className="text-slate-400 font-normal shrink-0">
              • {complaint.ward_name} ({complaint.ward_zone})
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-slate-400">
          <div className="flex items-center space-x-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>Reported {formattedDate}</span>
          </div>
          <span className="text-civic-700 bg-civic-50 px-2 py-0.5 rounded text-[11px] font-semibold">
            {complaint.department_name || complaint.category}
          </span>
        </div>
      </div>

      {/* Prominent Verification Callout Banner (when ready for citizen sign-off) */}
      {isVerifiable && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-amber-900 block">Repair Work Completed</span>
              <span className="text-amber-700">Citizen verification requested</span>
            </div>
          </div>
          <button
            onClick={() => onOpenDetails && onOpenDetails(complaint)}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition"
          >
            Verify Now
          </button>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="flex items-center space-x-2">
          {/* Community Upvote Button */}
          <button
            onClick={() => onSupport && onSupport(complaint.id)}
            disabled={isSupported}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
              isSupported
                ? 'bg-purple-50 text-purple-700 border border-purple-200 cursor-default'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <ThumbsUp className={`w-3.5 h-3.5 ${isSupported ? 'text-purple-600 fill-purple-600' : 'text-slate-500'}`} />
            <span>{complaint.support_count || 1} {complaint.support_count === 1 ? 'Support' : 'Supports'}</span>
          </button>
        </div>

        <button
          onClick={() => onOpenDetails && onOpenDetails(complaint)}
          className="text-xs font-bold text-civic-600 hover:text-civic-800 flex items-center space-x-1 group transition"
        >
          <span>View Details</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
        </button>
      </div>
    </div>
  );
}
