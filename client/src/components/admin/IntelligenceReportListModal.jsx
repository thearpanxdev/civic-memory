import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Calendar,
  ExternalLink,
  Printer,
  Sparkles,
  Download,
  Trash2,
} from 'lucide-react';

export default function IntelligenceReportListModal({ onClose, onSelectReport }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/intelligence/reports', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch reports');
      setReports(data.reports || []);
    } catch (err) {
      console.error('Error fetching reports:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const periodLabels = {
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days',
    '180d': 'Last 6 Months',
    '365d': 'Last 12 Months',
    'all': 'All-Time',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-black text-white">Historical Intelligence Reports Archive</h2>
              <p className="text-xs text-slate-400">View and export previously generated AI municipal reports</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              Loading intelligence reports archive...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-rose-500 text-sm">
              {error}
            </div>
          ) : reports.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm italic">
              No historical reports generated yet. Click "Generate AI Executive Report" to synthesize your first intelligence dossier.
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 text-sm">{report.title}</span>
                      <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {periodLabels[report.time_period] || report.time_period}
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] line-clamp-2">
                      {report.summary}
                    </p>
                    <div className="flex items-center space-x-3 text-[11px] text-slate-400 pt-1">
                      <span>By: {report.author_name || 'System'}</span>
                      <span>Date: {new Date(report.created_at).toLocaleString()}</span>
                      {report.ward_id && <span>Ward: {report.ward_id}</span>}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => onSelectReport(report)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center space-x-1 transition shadow-sm"
                    >
                      <span>Open Dossier</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={`/api/intelligence/reports/${report.id}/export?format=html`}
                      target="_blank"
                      rel="noreferrer"
                      title="Print / Save PDF"
                      className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
                    >
                      <Printer className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
