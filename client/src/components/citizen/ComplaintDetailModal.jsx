import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Calendar,
  Clock,
  History,
  Layers,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Video,
  MessageSquare,
  User,
  Building2,
  Send,
  AlertCircle,
} from 'lucide-react';

export default function ComplaintDetailModal({ complaintId, onClose, onRefresh }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Verification form state
  const [isSatisfactory, setIsSatisfactory] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [verifyError, setVerifyError] = useState(null);
  const [verifySuccess, setVerifySuccess] = useState(null);

  useEffect(() => {
    if (complaintId) {
      fetchDetails();
    }
  }, [complaintId]);

  async function fetchDetails() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/complaints/${complaintId}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to load complaint details.');
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerificationSubmit(e) {
    e.preventDefault();
    setSubmittingVerification(true);
    setVerifyError(null);
    setVerifySuccess(null);

    try {
      const res = await fetch(`/api/complaints/${complaintId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
          is_satisfactory: isSatisfactory,
          feedback: feedback.trim() || undefined,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Verification submission failed.');
      }

      setVerifySuccess(resData.message);
      // Refresh local details and trigger parent refresh
      await fetchDetails();
      if (onRefresh) onRefresh();
    } catch (err) {
      setVerifyError(err.message);
    } finally {
      setSubmittingVerification(false);
    }
  }

  if (!complaintId) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <span className="font-mono text-sm font-extrabold px-3 py-1 bg-white border border-slate-200 text-slate-900 rounded-xl shadow-xs">
              {data?.complaint?.ticket_number || 'Loading...'}
            </span>
            {data?.complaint && (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-civic-100 text-civic-800">
                {data.complaint.status}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center border border-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading && (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-civic-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm text-slate-500">Loading complaint history & evidence...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {data && data.complaint && (
            <>
              {/* Title & Category Bar */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-civic-700 bg-civic-50 px-2.5 py-1 rounded-lg">
                    {data.complaint.department_name || data.complaint.category}
                  </span>
                  <span className="text-xs text-slate-400">
                    Created {new Date(data.complaint.created_at).toLocaleString()}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">{data.complaint.title}</h2>
              </div>

              {/* Historical Civic Memory Banners */}
              {data.complaint.is_recurring === 1 && (
                <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs space-y-1">
                  <div className="flex items-center space-x-2 font-bold text-purple-800 text-sm">
                    <History className="w-4 h-4 text-purple-600" />
                    <span>Civic Intelligence: Historical Recurring Infrastructure Failure</span>
                  </div>
                  <p className="text-purple-700 leading-relaxed">
                    This location has experienced recurring civic failures (Recurrence Count: {data.complaint.recurrence_count || 1}).
                    {data.root_incident && (
                      <span className="block mt-1">
                        Root historical ticket: <strong>{data.root_incident.ticket_number}</strong> ({data.root_incident.title}).
                      </span>
                    )}
                  </p>
                </div>
              )}

              {data.complaint.relation_type === 'duplicate' && data.duplicate_of && (
                <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900 text-xs space-y-1">
                  <div className="flex items-center space-x-2 font-bold text-sky-800 text-sm">
                    <Layers className="w-4 h-4 text-sky-600" />
                    <span>Linked Duplicate Complaint</span>
                  </div>
                  <p className="text-sky-700">
                    This report has been identified as a duplicate of active ticket{' '}
                    <strong>{data.duplicate_of.ticket_number}</strong>. Both are grouped into the same municipal repair cluster.
                  </p>
                </div>
              )}

              {/* Description & Multilingual Record */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Citizen Description</h4>
                  {data.complaint.detected_language && (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                      Language: {data.complaint.detected_language}
                    </span>
                  )}
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {data.complaint.original_text || data.complaint.description}
                </div>

                {/* Standardised English Translation for Municipal Action */}
                {data.complaint.english_translation && data.complaint.english_translation !== (data.complaint.original_text || data.complaint.description) && (
                  <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-purple-900 uppercase tracking-wider">
                        Standardised English Translation (Official Record)
                      </span>
                      {data.complaint.translation_confidence && (
                        <span className="text-[11px] font-semibold text-purple-700">
                          {data.complaint.translation_confidence}% confidence
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-purple-950 italic leading-relaxed">
                      &ldquo;{data.complaint.english_translation}&rdquo;
                    </p>
                  </div>
                )}
              </div>

              {/* Location Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-400 uppercase tracking-wider block">Location Address</span>
                  <p className="text-slate-800 font-medium">{data.complaint.address || 'Not provided'}</p>
                  {data.complaint.landmark && (
                    <p className="text-slate-500">Landmark: {data.complaint.landmark}</p>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-400 uppercase tracking-wider block">Ward & Coordinates</span>
                  <p className="text-slate-800 font-medium">
                    {data.complaint.ward_name ? `${data.complaint.ward_name} (${data.complaint.ward_zone})` : 'Ward not linked'}
                  </p>
                  <p className="text-slate-500 font-mono">
                    Lat: {data.complaint.latitude?.toFixed(4)}, Lng: {data.complaint.longitude?.toFixed(4)}
                  </p>
                </div>
              </div>

              {/* Evidence Media Gallery (Live Photos & Videos) */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Camera className="w-4 h-4 text-slate-400" />
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Evidence Media ({data.images?.length || 0})
                  </h4>
                </div>

                {data.images && data.images.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {data.images.map((img) => (
                      <div key={img.id} className="group relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video flex flex-col justify-end text-white shadow-sm">
                        {img.media_type === 'VIDEO' ? (
                          <video
                            src={img.image_url}
                            controls
                            preload="metadata"
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={img.image_url}
                            alt={img.caption || 'Complaint evidence'}
                            className="absolute inset-0 w-full h-full object-cover transition duration-300 group-hover:scale-105"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = '/uploads/demo/pothole_crater_feb2026.svg';
                            }}
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent pointer-events-none" />

                        {/* Top Badge */}
                        <div className="absolute top-2 left-2 z-10 flex items-center space-x-1">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shadow-sm ${img.media_type === 'VIDEO' ? 'bg-purple-600' : 'bg-blue-600'}`}>
                            {img.media_type === 'VIDEO' ? 'VIDEO' : 'PHOTO'}
                          </span>
                        </div>

                        {/* Bottom Metadata Info */}
                        <div className="relative z-10 p-2.5 text-[11px] space-y-0.5 pointer-events-none">
                          <span className="font-semibold truncate block text-slate-100">{img.caption || 'Evidence Record'}</span>
                          {img.latitude != null && (
                            <span className="text-[10px] text-emerald-300 flex items-center space-x-1 font-mono">
                              <MapPin className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">GPS: {Number(img.latitude).toFixed(4)}, {Number(img.longitude).toFixed(4)} (±{img.accuracy_meters || 0}m)</span>
                            </span>
                          )}
                          {img.device_captured_at && (
                            <span className="text-[9px] text-slate-300 block font-mono">
                              Device Captured: {new Date(img.device_captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No photographic or video evidence attached to this ticket.</p>
                )}
              </div>

              {/* Citizen Resolution Verification Section */}
              {(data.complaint.status === 'Work Completed' ||
                data.complaint.status === 'Awaiting Citizen Verification') && (
                <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-4">
                  <div className="flex items-center space-x-2.5">
                    <ShieldCheck className="w-6 h-6 text-amber-600" />
                    <div>
                      <h4 className="text-sm font-bold text-amber-950">Citizen Resolution Verification Required</h4>
                      <p className="text-xs text-amber-800">
                        Municipal authorities have completed repair work. Please inspect and confirm whether the problem has been satisfactorily solved.
                      </p>
                    </div>
                  </div>

                  {verifySuccess && (
                    <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-semibold">
                      {verifySuccess}
                    </div>
                  )}

                  {verifyError && (
                    <div className="p-3 bg-rose-100 border border-rose-300 text-rose-800 rounded-xl text-xs font-semibold">
                      {verifyError}
                    </div>
                  )}

                  <form onSubmit={handleVerificationSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setIsSatisfactory(true)}
                        className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition ${
                          isSatisfactory
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm Fixed (Resolve)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsSatisfactory(false)}
                        className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition ${
                          !isSatisfactory
                            ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <AlertTriangle className="w-4 h-4" />
                        <span>Still Broken (Reopen)</span>
                      </button>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-amber-900 block mb-1">
                        Citizen Feedback / Verification Notes
                      </label>
                      <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder={
                          isSatisfactory
                            ? 'e.g., Checked today, asphalt is smooth and road is fully restored.'
                            : 'e.g., Pothole was only filled with loose sand, already eroding.'
                        }
                        rows={3}
                        className="w-full text-xs p-3 rounded-xl border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                      ></textarea>
                    </div>

                    <button
                      type="submit"
                      disabled={submittingVerification}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center justify-center space-x-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{submittingVerification ? 'Submitting Verification...' : 'Submit Resolution Sign-off'}</span>
                    </button>
                  </form>
                </div>
              )}

              {/* Status History Audit Trail */}
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Official Audit Trail & Status Timeline
                  </h4>
                </div>

                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {data.history && data.history.map((step, idx) => (
                    <div key={step.id || idx} className="relative">
                      {/* Timeline dot */}
                      <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-civic-600 border-2 border-white shadow-xs"></div>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between text-slate-500">
                          <span className="font-bold text-slate-800">
                            {step.from_status ? `${step.from_status} → ` : ''}{step.to_status}
                          </span>
                          <span>{new Date(step.created_at).toLocaleString()}</span>
                        </div>
                        {step.notes && (
                          <p className="text-slate-600 italic">"{step.notes}"</p>
                        )}
                        <span className="text-[10px] text-slate-400 block">
                          Recorded by: {step.changed_by_name || 'System / Official'} ({step.changed_by_role || 'official'})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Multilingual Citizen Notifications */}
              {data.notifications && data.notifications.length > 0 && (
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-base">🔔</span>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Multilingual Status Updates ({data.notifications.length})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {data.notifications.map((notif) => (
                      <div key={notif.id} className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-blue-900">{notif.title}</span>
                          <span className="text-[10px] text-slate-400">{new Date(notif.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-800 font-medium">{notif.message}</p>
                        {notif.target_language !== 'English' && notif.english_message && (
                          <p className="text-[11px] text-slate-500 italic">English: {notif.english_message}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
