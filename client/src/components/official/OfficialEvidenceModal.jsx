import React, { useState } from 'react';
import { Camera, X, AlertCircle, Loader2, CheckCircle2, Shield, Info } from 'lucide-react';
import LiveCameraEvidence from '../common/LiveCameraEvidence.jsx';

export default function OfficialEvidenceModal({ complaint, onClose, onSuccess }) {
  const [evidencePurpose, setEvidencePurpose] = useState('initial_inspection');
  const [caption, setCaption] = useState('');
  const [evidenceItems, setEvidenceItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const PURPOSE_OPTIONS = [
    { value: 'initial_inspection', label: 'Initial Field Inspection', desc: 'First site survey upon dispatch', badgeColor: 'border-blue-300 bg-blue-50/50 text-blue-900' },
    { value: 'site_inspection', label: 'Additional Site Inspection', desc: 'Follow-up or specialized inspection', badgeColor: 'border-indigo-300 bg-indigo-50/50 text-indigo-900' },
    { value: 'work_in_progress', label: 'Work in Progress', desc: 'Active repair or crew deployment', badgeColor: 'border-amber-300 bg-amber-50/50 text-amber-900' },
    { value: 'repair_progress', label: 'Repair Progress Note', desc: 'Interim construction or equipment progress', badgeColor: 'border-teal-300 bg-teal-50/50 text-teal-900' },
    { value: 'resolution', label: 'Resolution Evidence', desc: 'Completed work verification photo/video', badgeColor: 'border-emerald-300 bg-emerald-50/50 text-emerald-900' },
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!evidenceItems.length) {
      setError('Please capture at least one live photo or video evidence before submitting.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    const legacyImageType = evidencePurpose === 'resolution' ? 'after_repair' : 'progress';
    formData.append('image_type', legacyImageType);
    formData.append('evidence_purpose', evidencePurpose);

    if (caption.trim()) {
      formData.append('caption', caption.trim());
    }

    for (const item of evidenceItems) {
      formData.append('images', item.file);
    }
    formData.append('evidence_metadata', JSON.stringify(evidenceItems.map((it) => it.metadata)));

    try {
      const res = await fetch(`/api/official/complaints/${complaint.id}/evidence`, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload official evidence.');
      }

      onSuccess(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Live Field Evidence Capture</h3>
              <p className="text-xs text-slate-500 font-mono">{complaint.ticket_number} &bull; {complaint.department_name || 'Department'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Evidence Purpose Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Evidence Purpose / Stage <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PURPOSE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex flex-col p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                    evidencePurpose === opt.value
                      ? `${opt.badgeColor} ring-2 ring-emerald-500/20 font-bold`
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{opt.label}</span>
                    <input
                      type="radio"
                      name="evidence_purpose"
                      value={opt.value}
                      checked={evidencePurpose === opt.value}
                      onChange={() => setEvidencePurpose(opt.value)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-normal mt-0.5">{opt.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Optional Caption / Inspection Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Field Directives & Inspection Remarks
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. Completed asphalt compaction on 100ft road; curing required for 4h."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
          </div>

          {/* Reusable Live Camera Evidence */}
          <div className="pt-1">
            <LiveCameraEvidence
              items={evidenceItems}
              onItemsChange={setEvidenceItems}
              maxPhotos={5}
              maxVideos={1}
              disabled={submitting}
              evidencePurpose={evidencePurpose}
            />
          </div>

          {/* Municipal Protocol Notice */}
          <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start space-x-2.5">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold">Municipal Verification Protocol</p>
              <p className="text-[11px] text-amber-800">
                Attaching live camera evidence records device-reported GPS and capture timestamps in the immutable audit log. In accordance with municipal rules, this action does <strong>not</strong> automatically resolve the ticket. Resolution requires formal status progression and citizen verification.
              </p>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !evidenceItems.length}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm flex items-center space-x-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Evidence...</span>
                </>
              ) : (
                <span>Submit Field Evidence ({evidenceItems.length})</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
