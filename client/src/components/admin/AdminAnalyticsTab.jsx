import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Activity,
  History,
  Building2,
  MapPin,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Repeat,
  Layers,
  ThumbsUp,
  Sparkles,
  FileText,
  Calendar,
  Filter,
  RefreshCw,
  Clock,
  ShieldCheck,
  ChevronDown,
  ExternalLink,
  Info,
} from 'lucide-react';
import IntelligenceReportModal from './IntelligenceReportModal.jsx';
import IntelligenceReportListModal from './IntelligenceReportListModal.jsx';

const STATUS_COLORS = {
  'Submitted': '#f59e0b',
  'Under Review': '#6366f1',
  'Verified': '#3b82f6',
  'Assigned': '#06b6d4',
  'In Progress': '#2563eb',
  'Work Completed': '#9333ea',
  'Awaiting Citizen Verification': '#a855f7',
  'Resolved': '#10b981',
  'Reopened': '#ef4444',
};

const PIE_PALETTE = ['#2563eb', '#10b981', '#f59e0b', '#9333ea', '#ef4444', '#06b6d4', '#6366f1'];

export default function AdminAnalyticsTab({ analytics: initialAnalytics, dashboardData, loading: initialLoading }) {
  // Period and Filter State
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedWard, setSelectedWard] = useState('all');

  // Live Intelligence Data State
  const [intelData, setIntelData] = useState(null);
  const [loadingIntel, setLoadingIntel] = useState(false);
  const [intelError, setIntelError] = useState(null);

  // Active Recurring Tab Filter
  const [activeRecurringCategory, setActiveRecurringCategory] = useState('bounce_backs');

  // Report Generation State
  const [generatingReport, setGeneratingReport] = useState(false);
  const [currentReport, setCurrentReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  // Load intelligence overview on mount and when filters change
  useEffect(() => {
    fetchIntelligenceOverview();
  }, [selectedPeriod, selectedCategory, selectedWard]);

  async function fetchIntelligenceOverview() {
    setLoadingIntel(true);
    setIntelError(null);
    try {
      const params = new URLSearchParams({
        period: selectedPeriod,
      });
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedWard !== 'all') params.append('ward_id', selectedWard);

      const res = await fetch(`/api/intelligence/overview?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch intelligence overview');
      setIntelData(data);
    } catch (err) {
      console.error('Error fetching intelligence:', err);
      setIntelError(err.message);
    } finally {
      setLoadingIntel(false);
    }
  }

  async function handleGenerateReport() {
    setGeneratingReport(true);
    try {
      const res = await fetch('/api/intelligence/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          time_period: selectedPeriod,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          ward_id: selectedWard !== 'all' ? selectedWard : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Report generation failed');

      setCurrentReport(data.report);
      setShowReportModal(true);
    } catch (err) {
      console.error('Report generation error:', err);
      alert('Failed to generate report: ' + err.message);
    } finally {
      setGeneratingReport(false);
    }
  }

  // Fallbacks if intelligence data is not yet loaded
  const overallMetrics = intelData?.overall_metrics || {};
  const recurringAnalysis = intelData?.recurring_analysis || {};
  const hotspotAnalysis = intelData?.hotspot_analysis || {};
  const historicalTrends = intelData?.historical_trends || {};

  // Preserve legacy structures if needed
  const statusDistribution = initialAnalytics?.statusDistribution || [];
  const departmentWorkload = initialAnalytics?.departmentWorkload || [];
  const wardDistribution = initialAnalytics?.wardDistribution || [];
  const chronicClusters = recurringAnalysis?.chronic_bounce_backs || initialAnalytics?.chronicClusters || [];
  const mostFrequentlyReported = initialAnalytics?.mostFrequentlyReported || dashboardData?.mostFrequentlyReported || [];
  const repeatedLocations = hotspotAnalysis?.spatial_clusters || initialAnalytics?.repeatedComplaintLocations || [];

  // Pie chart data
  const pieData = statusDistribution.map((item) => ({
    name: item.status,
    value: item.count,
    color: STATUS_COLORS[item.status] || '#64748b',
  }));

  // Department workload data formatted for Recharts
  const deptData = departmentWorkload.map((d) => ({
    name: d.code || d.name,
    total: d.total_complaints || 0,
    resolved: d.resolved_count || 0,
    open: d.open_count || 0,
    recurring: d.recurring_count || 0,
  }));

  // Trend Chart Data
  const trendPoints = (historicalTrends?.trend_points || []).map((pt) => ({
    label: pt.label,
    submitted: pt.submitted || 0,
    resolved: pt.resolved || 0,
    recurring: pt.recurring || 0,
  }));

  const periods = [
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: 'Quarter (90d)' },
    { key: '180d', label: '6 Months' },
    { key: '365d', label: '12 Months' },
    { key: 'all', label: 'All-Time' },
  ];

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'Roads & Footpaths', label: 'Roads & Footpaths' },
    { value: 'Drainage & Sewage', label: 'Drainage & Sewage' },
    { value: 'Garbage & Sanitation', label: 'Garbage & Sanitation' },
    { value: 'Street Lighting', label: 'Street Lighting' },
    { value: 'Water Supply', label: 'Water Supply' },
  ];

  const recurringCategories = [
    { key: 'bounce_backs', label: 'Chronic Bounce-Backs', count: recurringAnalysis?.bounce_backs_count || 0, color: 'rose' },
    { key: 'road_damage', label: 'Road Damage', count: recurringAnalysis?.road_damage?.length || 0, color: 'amber' },
    { key: 'waterlogging', label: 'Waterlogging', count: recurringAnalysis?.waterlogging?.length || 0, color: 'blue' },
    { key: 'drainage_sewage', label: 'Drainage & Sewage', count: recurringAnalysis?.drainage_sewage?.length || 0, color: 'purple' },
    { key: 'garbage', label: 'Garbage Accumulation', count: recurringAnalysis?.garbage_accumulation?.length || 0, color: 'emerald' },
    { key: 'streetlights', label: 'Streetlight Failures', count: recurringAnalysis?.streetlight_failures?.length || 0, color: 'indigo' },
  ];

  function getActiveRecurringList() {
    if (!recurringAnalysis) return [];
    if (activeRecurringCategory === 'bounce_backs') return recurringAnalysis.chronic_bounce_backs || [];
    if (activeRecurringCategory === 'road_damage') return recurringAnalysis.road_damage || [];
    if (activeRecurringCategory === 'waterlogging') return recurringAnalysis.waterlogging || [];
    if (activeRecurringCategory === 'drainage_sewage') return recurringAnalysis.drainage_sewage || [];
    if (activeRecurringCategory === 'garbage') return recurringAnalysis.garbage_accumulation || [];
    if (activeRecurringCategory === 'streetlights') return recurringAnalysis.streetlight_failures || [];
    return [];
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Historical Intelligence Action Header & Period Selector */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-lg border border-slate-800 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <Sparkles className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                Autonomous Municipal Intelligence Engine
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Google Gemini + SQLite
              </span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-white">
              Civic Memory Historical Trends & Hotspot Diagnostics
            </h2>
            <p className="text-slate-400 text-xs max-w-2xl leading-relaxed">
              Detect recurring infrastructure defects, spatial complaint clusters, and evaluate period-over-period resolution velocity grounded strictly in authoritative database records.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowArchiveModal(true)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-700"
            >
              <FileText className="w-4 h-4 text-slate-400" />
              <span>Dossier Archive</span>
            </button>

            <button
              onClick={handleGenerateReport}
              disabled={generatingReport}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold flex items-center space-x-2 shadow-md transition disabled:opacity-50"
            >
              {generatingReport ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Synthesizing Dossier...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-200" />
                  <span>Generate AI Executive Report</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Time Period Selector Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-800/80">
          <div className="flex items-center space-x-1 bg-slate-800/80 p-1 rounded-2xl border border-slate-700/60 overflow-x-auto">
            {periods.map((p) => (
              <button
                key={p.key}
                onClick={() => setSelectedPeriod(p.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                  selectedPeriod === p.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-1.5 text-slate-400">
              <Filter className="w-3.5 h-3.5" />
              <span>Category:</span>
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-800 text-slate-200 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 6 Core Municipal Intelligence KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Reported Issues */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Reported</span>
            {overallMetrics.percent_change_total !== null && overallMetrics.percent_change_total !== undefined && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center space-x-0.5 ${
                  overallMetrics.trend_direction === 'increasing'
                    ? 'bg-rose-50 text-rose-700'
                    : overallMetrics.trend_direction === 'decreasing'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {overallMetrics.trend_direction === 'increasing' ? (
                  <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                ) : overallMetrics.trend_direction === 'decreasing' ? (
                  <TrendingDown className="w-2.5 h-2.5 mr-0.5" />
                ) : null}
                <span>{overallMetrics.percent_change_total > 0 ? `+${overallMetrics.percent_change_total}%` : `${overallMetrics.percent_change_total}%`}</span>
              </span>
            )}
          </div>
          <div className="text-2xl font-black text-slate-900">
            {overallMetrics.total_reported ?? initialAnalytics?.totalComplaints ?? 0}
          </div>
          <p className="text-[11px] text-slate-500">
            {overallMetrics.prior_period_total !== undefined ? `vs ${overallMetrics.prior_period_total} in prior window` : 'Selected period'}
          </p>
        </div>

        {/* Unique Issues */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unique Issues</span>
          <div className="text-2xl font-black text-blue-600">
            {overallMetrics.total_unique_issues ?? 0}
          </div>
          <p className="text-[11px] text-slate-500">
            {overallMetrics.duplicate_complaints ?? 0} linked duplicates
          </p>
        </div>

        {/* Recurring Issues */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Recurring Issues</span>
          <div className="text-2xl font-black text-rose-600">
            {overallMetrics.recurring_issues ?? 0}
          </div>
          <p className="text-[11px] text-rose-700 font-semibold">
            {overallMetrics.recurrence_rate_percent ?? 0}% recurrence rate
          </p>
        </div>

        {/* Unresolved Complaints */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unresolved Backlog</span>
          <div className="text-2xl font-black text-amber-600">
            {overallMetrics.unresolved_complaints ?? 0}
          </div>
          <p className="text-[11px] text-amber-700 font-semibold">
            {overallMetrics.unresolved_percent ?? 0}% of reported
          </p>
        </div>

        {/* Average Resolution Time */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Avg Resolution</span>
          <div className="text-2xl font-black text-purple-600">
            {overallMetrics.avg_resolution_time_days ? `${overallMetrics.avg_resolution_time_days}d` : `${overallMetrics.avg_resolution_time_hours || 0}h`}
          </div>
          <p className="text-[11px] text-slate-500">
            {overallMetrics.resolved_complaints ?? 0} tickets resolved
          </p>
        </div>

        {/* Citizen Satisfaction Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Satisfaction Rate</span>
          <div className="text-2xl font-black text-emerald-600">
            {overallMetrics.citizen_satisfaction_rate_percent ?? 0}%
          </div>
          <p className="text-[11px] text-slate-500">
            Resolved without reopen
          </p>
        </div>
      </div>

      {/* Historical Trend Timeline (Recharts Area / Bar) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <span>Complaint Trajectory Over Time</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Historical progression of incoming tickets, successful resolutions, and recurring infrastructure breakdowns
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <span className="inline-block w-3 h-3 rounded-full bg-indigo-500"></span>
            <span>Submitted</span>
            <span className="inline-block w-3 h-3 rounded-full bg-emerald-500 ml-2"></span>
            <span>Resolved</span>
            <span className="inline-block w-3 h-3 rounded-full bg-rose-500 ml-2"></span>
            <span>Recurring</span>
          </div>
        </div>

        {trendPoints.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs italic">
            No historical trend data points recorded for the selected window.
          </div>
        ) : (
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendPoints} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <defs>
                  <linearGradient id="colorSubmitted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRecurring" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px', border: 'none' }}
                />
                <Area type="monotone" dataKey="submitted" name="Submitted" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorSubmitted)" />
                <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorResolved)" />
                <Area type="monotone" dataKey="recurring" name="Recurring" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorRecurring)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Geographic Hotspots & Spatial Clustering Section */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              <span>Geographic Problem Hotspots (Haversine 150m Spatial Clusters)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Identified spatial complaint clusters grouped strictly by verifiable GPS coordinates
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
            {hotspotAnalysis.total_clusters_detected || 0} Clusters Detected
          </span>
        </div>

        {/* Unmapped Reports Strict Exclusion Warning */}
        {Number(hotspotAnalysis.unmapped_reports_count) > 0 && (
          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 flex items-start space-x-2.5">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Strict Geographic Integrity Notice: </span>
              <span>
                {hotspotAnalysis.unmapped_reports_count} complaints without reliable GPS coordinates were isolated and excluded from spatial clustering to prevent inaccurate geographic attribution.
              </span>
            </div>
          </div>
        )}

        {/* Hotspot Cluster Grid */}
        {(!hotspotAnalysis.spatial_clusters || hotspotAnalysis.spatial_clusters.length === 0) ? (
          <div className="p-8 text-center text-slate-400 text-xs italic">
            No dense spatial clusters (2 or more complaints within 150m) detected in the selected time window.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hotspotAnalysis.spatial_clusters.map((cluster) => (
              <div
                key={cluster.cluster_id}
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md transition space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="line-clamp-1">{cluster.approximate_address}</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    {cluster.report_count} Reports
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between text-slate-600 text-[11px]">
                    <span>Dominant Category:</span>
                    <strong className="text-slate-900">{cluster.dominant_category}</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 text-[11px]">
                    <span>Unresolved Backlog:</span>
                    <strong className={cluster.unresolved_count > 0 ? 'text-amber-700' : 'text-emerald-700'}>
                      {cluster.unresolved_count} pending
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 font-mono text-[10px]">
                    <span>GPS Centroid:</span>
                    <span>{cluster.centroid_lat.toFixed(4)}, {cluster.centroid_lng.toFixed(4)}</span>
                  </div>
                </div>

                {cluster.is_chronic_recurrence && (
                  <div className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200 flex items-center space-x-1">
                    <History className="w-3 h-3 text-rose-600" />
                    <span>Chronic Recurrence Hotspot</span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                  <span className="font-semibold text-slate-700">Associated Tickets: </span>
                  {cluster.complaint_tickets?.slice(0, 3).join(', ')}
                  {cluster.complaint_tickets?.length > 3 && ` +${cluster.complaint_tickets.length - 3} more`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recurring Infrastructure Defect Intelligence */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Repeat className="w-5 h-5 text-rose-600" />
                <span>Recurring Defect Intelligence (Civic Memory Engine)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Chronic infrastructure vulnerabilities categorized across municipal failure modes
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 self-start sm:self-auto">
              {recurringAnalysis.bounce_backs_count || 0} Chronic Bounce-Backs
            </span>
          </div>

          {/* Recurring Defect Category Tabs */}
          <div className="flex items-center space-x-1 mt-4 overflow-x-auto pb-1 border-b border-slate-100">
            {recurringCategories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveRecurringCategory(cat.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shrink-0 ${
                  activeRecurringCategory === cat.key
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeRecurringCategory === cat.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {cat.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Recurring Items List */}
        {getActiveRecurringList().length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs italic">
            No recurring incidents detected under {recurringCategories.find(c => c.key === activeRecurringCategory)?.label} for the selected window.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
            {getActiveRecurringList().map((item, idx) => (
              <div
                key={item.root_incident_id || item.complaint_id || idx}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-1.5 hover:bg-slate-100/60 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px]">
                    Ticket: {item.root_ticket || item.ticket_number || 'Incident'}
                  </span>
                  {item.recurrence_count && (
                    <span className="px-2 py-0.5 rounded-full font-bold bg-rose-600 text-white text-[10px]">
                      {item.recurrence_count} Repeat Incidents
                    </span>
                  )}
                  {item.reopen_count && (
                    <span className="px-2 py-0.5 rounded-full font-bold bg-rose-600 text-white text-[10px]">
                      Reopened {item.reopen_count}x
                    </span>
                  )}
                </div>
                <p className="font-bold text-slate-900 line-clamp-1">{item.root_title || item.title}</p>
                <p className="text-slate-600 line-clamp-1 text-[11px]">{item.root_address || item.address}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/50">
                  <span>Category: {item.category || item.department_name}</span>
                  {item.latest_incident && (
                    <span>Last: {new Date(item.latest_incident).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Visual Analytics Charts Grid (Preserved Departmental & Status Analytics) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Workload Bar Chart */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-purple-600" />
                <span>Departmental Workload & Resolution</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Total tickets reported vs successfully resolved</p>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px', border: 'none' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: '10px' }} />
                <Bar dataKey="total" name="Total Filed" fill="#6366f1" radius={[6, 6, 0, 0]} />
                <Bar dataKey="resolved" name="Resolved" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Complaint Status Distribution Donut Chart */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                <span>Complaint Status Breakdown</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Distribution across the resolution lifecycle</p>
            </div>
          </div>

          <div className="h-72 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || PIE_PALETTE[index % PIE_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px', border: 'none' }}
                />
                <Legend
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Semantic Duplicate & High-Support Intelligence Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Frequently Reported Recurring & High-Support Problems */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <ThumbsUp className="w-5 h-5 text-indigo-600" />
                <span>Most Frequently Reported Civic Issues</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Top civic problems ranked by citizen reports and linked duplicates</p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {mostFrequentlyReported.length} Key Issues
            </span>
          </div>

          {mostFrequentlyReported.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs italic">
              No frequently reported duplicate civic issues recorded yet.
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-72 pr-1">
              {mostFrequentlyReported.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-indigo-50/40 border border-indigo-100 text-xs space-y-1.5 hover:bg-indigo-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-indigo-800 bg-white px-2 py-0.5 rounded border border-indigo-200">
                      {item.ticket_number}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded-full font-bold bg-indigo-600 text-white text-[10px] flex items-center space-x-1">
                        <ThumbsUp className="w-2.5 h-2.5" />
                        <span>{item.support_count || 1} Support</span>
                      </span>
                      {Number(item.duplicate_count) > 0 && (
                        <span className="px-2 py-0.5 rounded-full font-bold bg-purple-600 text-white text-[10px] flex items-center space-x-1">
                          <Layers className="w-2.5 h-2.5" />
                          <span>{item.duplicate_count} Duplicates</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="font-bold text-slate-900 line-clamp-1">{item.title}</p>
                  <p className="text-slate-600 line-clamp-1 text-[11px]">{item.address}</p>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-indigo-100">
                    <span>{item.department_name || item.category}</span>
                    <span className="font-semibold text-slate-700">{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Locations with Repeated Complaints */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Repeat className="w-5 h-5 text-emerald-600" />
                <span>Locations with Repeated Complaints</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Geographic locations with multiple civic problem reports</p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {repeatedLocations.length} Locations
            </span>
          </div>

          {repeatedLocations.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs italic">
              No repeated complaint locations recorded yet.
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-72 pr-1">
              {repeatedLocations.map((loc, idx) => (
                <div
                  key={`${loc.address || loc.approximate_address}-${idx}`}
                  className="p-3.5 rounded-2xl bg-emerald-50/40 border border-emerald-100 text-xs space-y-1.5 hover:bg-emerald-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 line-clamp-1 flex items-center space-x-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{loc.address || loc.approximate_address}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-600 text-white text-[10px]">
                      {loc.total_reports || loc.report_count} Total Reports
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 text-[11px] text-slate-600 pt-1">
                    <span>Ward: <strong>{loc.ward_name || loc.ward_id || 'All'}</strong></span>
                    {loc.unique_issues !== undefined && <span>Unique: <strong>{loc.unique_issues}</strong></span>}
                    {Number(loc.duplicate_reports) > 0 && (
                      <span className="text-purple-700">Duplicates: <strong>{loc.duplicate_reports}</strong></span>
                    )}
                    {Number(loc.recurring_reports) > 0 && (
                      <span className="text-rose-700">Recurring: <strong>{loc.recurring_reports}</strong></span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Intelligence Modals */}
      {showReportModal && currentReport && (
        <IntelligenceReportModal
          report={currentReport}
          onClose={() => setShowReportModal(false)}
          onRefresh={fetchIntelligenceOverview}
        />
      )}

      {showArchiveModal && (
        <IntelligenceReportListModal
          onClose={() => setShowArchiveModal(false)}
          onSelectReport={(rep) => {
            setCurrentReport(rep);
            setShowArchiveModal(false);
            setShowReportModal(true);
          }}
        />
      )}
    </div>
  );
}
