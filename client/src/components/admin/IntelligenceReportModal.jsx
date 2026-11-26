import React, { useState } from 'react';
import {
  X,
  Sparkles,
  FileText,
  Printer,
  Download,
  AlertTriangle,
  MapPin,
  TrendingUp,
  Building2,
  CheckCircle2,
  Clock,
  Layers,
  ShieldCheck,
  Calendar,
  ExternalLink,
} from 'lucide-react';

export default function IntelligenceReportModal({ report, onClose, onRefresh }) {
  const [downloading, setDownloading] = useState(false);

  if (!report) return null;

  const content = report.content || report.content_json || {};
  const {
    executive_summary = report.summary || '',
    major_civic_concerns = [],
    recurring_problems_analysis = {},
    geographic_hotspots = [],
    historical_comparisons = {},
    recommended_inspection_priorities = [],
    grounded_citations = [],
  } = content;

  function handlePrint() {
    const reportId = report.id;
    window.open(`/api/intelligence/reports/${reportId}/export?format=html`, '_blank');
  }

  async function handleDownload(format) {
    try {
      setDownloading(true);
      const res = await fetch(`/api/intelligence/reports/${report.id}/export?format=${format}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to download report');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `civic-intelligence-report-${report.id}.${format === 'json' ? 'json' : 'md'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      alert('Error downloading report: ' + err.message);
    } finally {
      setDownloading(false);
    }
  }

  const periodLabels = {
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days (Quarterly)',
    '180d': 'Last 6 Months',
    '365d': 'Last 12 Months',
    'all': 'All-Time Historical',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <Sparkles className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                AI Municipal Intelligence Dossier
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Grounded in Database
              </span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-white flex items-center space-x-2">
              <span>{report.title || 'Municipal Intelligence Report'}</span>
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 pt-1">
              <span className="flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Period: <strong>{periodLabels[report.time_period] || report.time_period}</strong></span>
              </span>
              {report.ward_id && (
                <span>Ward: <strong>{report.ward_id}</strong></span>
              )}
              {report.category && (
                <span>Category: <strong>{report.category}</strong></span>
              )}
              <span className="text-slate-400">
                Generated: {new Date(report.created_at).toLocaleString()}
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                Model: {report.model_version || 'Gemini'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              title="Print / Save as PDF"
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-700"
            >
              <Printer className="w-4 h-4 text-indigo-300" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>

            <button
              onClick={() => handleDownload('md')}
              disabled={downloading}
              title="Download Markdown"
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-700"
            >
              <Download className="w-4 h-4 text-emerald-300" />
              <span className="hidden sm:inline">Markdown</span>
            </button>

            <button
              onClick={() => handleDownload('json')}
              disabled={downloading}
              title="Download JSON"
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-700"
            >
              <Download className="w-4 h-4 text-amber-300" />
              <span className="hidden sm:inline">JSON</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-800">
          {/* Grounding Transparency Disclaimer */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 text-xs text-indigo-900 flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Strict Grounding & Data Integrity Verification</p>
              <p className="text-indigo-700 text-[11px] mt-0.5 leading-relaxed">
                All metrics, counts, location clusters, and historical comparisons in this report are strictly derived from verified SQLite database records. The Gemini intelligence layer synthesizes natural-language interpretations without fabricating incident numbers or statistics.
              </p>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Executive Summary</span>
            </h3>
            <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-line font-medium">
              {executive_summary}
            </p>
          </div>

          {/* Major Civic Concerns */}
          {major_civic_concerns.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Major Civic Concerns</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {major_civic_concerns.map((concern, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{concern.title}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          concern.severity === 'critical'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : concern.severity === 'high'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-blue-100 text-blue-800 border border-blue-300'
                        }`}
                      >
                        {concern.severity || 'Medium'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{concern.description}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>Category: <strong>{concern.category}</strong></span>
                      {concern.impacted_ward && <span>Ward: <strong>{concern.impacted_ward}</strong></span>}
                    </div>
                    {concern.supporting_ticket_numbers?.length > 0 && (
                      <div className="text-[10px] text-indigo-600 font-mono bg-indigo-50/50 px-2 py-1 rounded">
                        Tickets: {concern.supporting_ticket_numbers.slice(0, 4).join(', ')}
                        {concern.supporting_ticket_numbers.length > 4 && ` +${concern.supporting_ticket_numbers.length - 4} more`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recurring Problems Analysis */}
          {recurring_problems_analysis && Object.keys(recurring_problems_analysis).length > 0 && (
            <div className="p-5 rounded-2xl bg-rose-50/50 border border-rose-200/80 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-rose-900 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-rose-600" />
                <span>Recurring Problems & Chronic Bounce-Backs</span>
              </h3>
              {recurring_problems_analysis.summary && (
                <p className="text-xs text-rose-950 font-medium leading-relaxed">
                  {recurring_problems_analysis.summary}
                </p>
              )}
              {recurring_problems_analysis.chronic_bounce_backs && (
                <div className="p-3 bg-white rounded-xl border border-rose-200 text-xs text-slate-700">
                  <span className="font-bold text-rose-700">Chronic Bounce-Back Intelligence: </span>
                  {recurring_problems_analysis.chronic_bounce_backs}
                </div>
              )}
            </div>
          )}

          {/* Geographic Hotspots */}
          {geographic_hotspots.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>Geographic Problem Hotspots</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {geographic_hotspots.map((spot, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="line-clamp-1">{spot.cluster_name || spot.approximate_location}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {spot.complaint_count || 0} Reports
                      </span>
                    </div>
                    {spot.dominant_category && (
                      <div className="text-[11px] text-slate-500">
                        Dominant Category: <strong className="text-slate-700">{spot.dominant_category}</strong>
                      </div>
                    )}
                    <p className="text-xs text-slate-600 leading-relaxed">{spot.observations}</p>
                    {spot.recurring_infrastructure_defect && (
                      <div className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200">
                        Recurring Defect: {spot.recurring_infrastructure_defect}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historical Comparisons & Trends */}
          {historical_comparisons && Object.keys(historical_comparisons).length > 0 && (
            <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-200/80 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-blue-900 flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span>Historical Comparisons & Velocity</span>
              </h3>
              {historical_comparisons.trend_narrative && (
                <p className="text-xs text-blue-950 font-medium leading-relaxed">
                  {historical_comparisons.trend_narrative}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {historical_comparisons.accelerating_concerns?.length > 0 && (
                  <div className="p-3 bg-white rounded-xl border border-blue-200 text-xs space-y-1">
                    <span className="font-bold text-amber-700 flex items-center space-x-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Accelerating Concerns</span>
                    </span>
                    <ul className="list-disc list-inside text-slate-600 text-[11px] space-y-0.5">
                      {historical_comparisons.accelerating_concerns.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {historical_comparisons.improving_areas?.length > 0 && (
                  <div className="p-3 bg-white rounded-xl border border-blue-200 text-xs space-y-1">
                    <span className="font-bold text-emerald-700 flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Improving Areas</span>
                    </span>
                    <ul className="list-disc list-inside text-slate-600 text-[11px] space-y-0.5">
                      {historical_comparisons.improving_areas.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recommended Inspection Priorities */}
          {recommended_inspection_priorities.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-purple-600" />
                <span>Recommended Municipal Inspection Priorities</span>
              </h3>
              <div className="space-y-2">
                {recommended_inspection_priorities.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded text-[10px]">
                          P{item.priority || idx + 1}
                        </span>
                        <span className="font-bold text-slate-900">{item.action}</span>
                      </div>
                      <p className="text-slate-600 text-[11px]">{item.rationale}</p>
                    </div>
                    <div className="flex items-center space-x-2 sm:self-center shrink-0">
                      <span className="px-2 py-1 rounded bg-slate-200 text-slate-700 font-semibold text-[11px]">
                        Dept: {item.department}
                      </span>
                      <span
                        className={`px-2 py-1 rounded font-bold text-[10px] uppercase ${
                          item.urgency === 'Immediate' || item.urgency === 'High'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.urgency}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grounded Citations Box */}
          {grounded_citations.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-100/70 border border-slate-200 text-xs space-y-1">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                Underlying Complaint Records & Ticket Citations
              </span>
              <p className="text-slate-500 font-mono text-[11px] break-words">
                {grounded_citations.join(', ')}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>CivicMemory Autonomous Municipal Intelligence Engine</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
