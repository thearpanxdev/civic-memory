import React, { useState, useEffect } from 'react';
import {
  X,
  Camera,
  MapPin,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  History,
  Layers,
  Send,
  Trash2,
  Navigation,
} from 'lucide-react';

const CATEGORIES = [
  { name: 'Roads and Infrastructure', icon: '🛣️', desc: 'Potholes, damaged footpaths, cave-ins' },
  { name: 'Sanitation and Waste Management', icon: '🗑️', desc: 'Garbage accumulation, dead animals, illegal dumping' },
  { name: 'Water Supply', icon: '💧', desc: 'Pipeline bursts, dirty water, low pressure' },
  { name: 'Drainage and Sewerage', icon: '🌊', desc: 'Clogged storm drains, overflowing sewers' },
  { name: 'Street Lighting', icon: '💡', desc: 'Non-functional streetlights, open junction boxes' },
];

export default function NewComplaintModal({ onClose, onSuccess }) {
  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].name);
  const [wardId, setWardId] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [latitude, setLatitude] = useState('12.9784');
  const [longitude, setLongitude] = useState('77.6408');
  const [severity, setSeverity] = useState('medium');

  // Metadata options
  const [wards, setWards] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Images state
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  // Geolocation state
  const [locating, setLocating] = useState(false);
  const [locatingMsg, setLocatingMsg] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [successInfo, setSuccessInfo] = useState(null);

  useEffect(() => {
    fetchWards();
  }, []);

  async function fetchWards() {
    setLoadingMeta(true);
    try {
      const res = await fetch('/api/complaints/meta/wards');
      if (res.ok) {
        const data = await res.json();
        setWards(data.wards || []);
        if (data.wards && data.wards.length > 0) {
          setWardId(data.wards[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch wards:', err);
    } finally {
      setLoadingMeta(false);
    }
  }

  function handleCurrentLocation() {
    if (!navigator.geolocation) {
      setLocatingMsg('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    setLocatingMsg('Acquiring high-accuracy GPS coordinates...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setLocating(false);
        setLocatingMsg(`GPS locked (Accuracy ~${Math.round(pos.coords.accuracy)}m)`);
      },
      (err) => {
        setLocating(false);
        setLocatingMsg(`Location error: ${err.message}. Please enter coordinates manually.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function handleFileSelect(e) {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    if (files.length + selected.length > 5) {
      setError('You can upload a maximum of 5 evidence photos.');
      return;
    }

    // Validate size (5MB) and type
    const validFiles = [];
    const newPreviews = [];

    for (const f of selected) {
      if (f.size > 5 * 1024 * 1024) {
        setError(`File "${f.name}" exceeds the 5MB size limit.`);
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
        setError(`File "${f.name}" is not an accepted image format (JPEG, PNG, WebP only).`);
        return;
      }
      validFiles.push(f);
      newPreviews.push({
        name: f.name,
        size: (f.size / 1024).toFixed(0),
        url: URL.createObjectURL(f),
      });
    }

    setFiles([...files, ...validFiles]);
    setPreviews([...previews, ...newPreviews]);
    setError(null);
  }

  function handleRemoveFile(idx) {
    const nextFiles = [...files];
    const nextPreviews = [...previews];
    URL.revokeObjectURL(nextPreviews[idx].url);
    nextFiles.splice(idx, 1);
    nextPreviews.splice(idx, 1);
    setFiles(nextFiles);
    setPreviews(nextPreviews);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    setSuccessInfo(null);

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('description', description.trim());
    formData.append('category', category);
    formData.append('ward_id', wardId);
    formData.append('latitude', latitude);
    formData.append('longitude', longitude);
    formData.append('address', address.trim());
    if (landmark.trim()) {
      formData.append('landmark', landmark.trim());
    }
    formData.append('severity', severity);

    for (const f of files) {
      formData.append('images', f);
    }

    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: formData,
      });

      const resData = await res.json();
      if (!res.ok) {
        if (resData.details) {
          setFieldErrors(resData.details);
          throw new Error('Please resolve the highlighted validation errors.');
        }
        throw new Error(resData.error || 'Failed to submit complaint.');
      }

      setSuccessInfo(resData);
      if (onSuccess) {
        onSuccess(resData.complaint);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Report a Civic Problem</h2>
            <p className="text-xs text-slate-500">
              Submit community issues for municipal action and long-term civic memory tracking.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center border border-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Success Banner */}
          {successInfo ? (
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-900">Complaint Submitted Successfully!</h3>
                <p className="text-sm font-mono font-bold text-civic-700">
                  Ticket Reference: {successInfo.complaint?.ticket_number}
                </p>
              </div>

              {/* Civic Memory Insights Callout */}
              {successInfo.memory_insights?.is_duplicate && (
                <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900 text-xs space-y-1 text-left">
                  <div className="flex items-center space-x-2 font-bold text-sky-800">
                    <Layers className="w-4 h-4 text-sky-600" />
                    <span>Civic Memory: Duplicate Incident Clustered</span>
                  </div>
                  <p className="text-sky-700">
                    Our civic engine recognized an existing active ticket (
                    <strong>{successInfo.memory_insights.linked_ticket}</strong>) within 100 meters. Your report was clustered and your community support vote recorded!
                  </p>
                </div>
              )}

              {successInfo.memory_insights?.is_recurring && (
                <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs space-y-1 text-left">
                  <div className="flex items-center space-x-2 font-bold text-purple-800">
                    <History className="w-4 h-4 text-purple-600" />
                    <span>Civic Memory: Historical Recurring Failure</span>
                  </div>
                  <p className="text-purple-700">
                    This location has experienced recurring failures before (Prior Ticket:{' '}
                    <strong>{successInfo.memory_insights.linked_ticket}</strong>). Recurrence count updated to{' '}
                    <strong>{successInfo.memory_insights.recurrence_count}</strong> for municipal oversight!
                  </p>
                </div>
              )}

              <div className="pt-4 flex justify-center space-x-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-civic-600 hover:bg-civic-700 text-white font-bold text-xs rounded-xl shadow transition"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Title */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-slate-700">Issue Title *</label>
                  <span className="text-slate-400">{title.length}/200</span>
                </div>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Deep crater pothole causing vehicle axle damage"
                  className={`w-full text-xs p-3 rounded-xl border ${
                    fieldErrors.title ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                  } focus:outline-none focus:ring-2 focus:ring-civic-500`}
                />
                {fieldErrors.title && (
                  <span className="text-[11px] text-rose-600 block">{fieldErrors.title[0]}</span>
                )}
              </div>

              {/* Category Picker */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 text-xs block">Category *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setCategory(cat.name)}
                      className={`p-3 rounded-xl border text-left flex items-start space-x-2.5 transition ${
                        category === cat.name
                          ? 'bg-civic-50 border-civic-500 ring-2 ring-civic-200'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xl shrink-0">{cat.icon}</span>
                      <div className="text-xs">
                        <span className="font-bold text-slate-900 block">{cat.name}</span>
                        <span className="text-[11px] text-slate-500 leading-tight block">{cat.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ward & Severity in 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block">Administrative Ward *</label>
                  <select
                    value={wardId}
                    onChange={(e) => setWardId(e.target.value)}
                    required
                    className="w-full text-xs p-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-civic-500"
                  >
                    {loadingMeta ? (
                      <option>Loading wards...</option>
                    ) : (
                      wards.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.ward_number}: {w.name} ({w.zone})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block">Severity Level *</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-civic-500"
                  >
                    <option value="low">Low (Minor inconvenience)</option>
                    <option value="medium">Medium (Moderate traffic or health risk)</option>
                    <option value="high">High (Substantial danger or property hazard)</option>
                    <option value="critical">Critical (Immediate public danger)</option>
                  </select>
                </div>
              </div>

              {/* Location Address & Landmark */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block">Address / Street Location *</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 100ft Road, between 12th & 14th Main"
                    className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-civic-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block">Landmark (Optional)</label>
                  <input
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="e.g. Opp ICICI Bank, near pedestrian crossing"
                    className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-civic-500"
                  />
                </div>
              </div>

              {/* Coordinates & Geolocation */}
              <div className="space-y-2 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
                    <MapPin className="w-4 h-4 text-civic-600" />
                    <span>Coordinates (Used for Civic Memory Proximity Clustering)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCurrentLocation}
                    disabled={locating}
                    className="text-xs font-bold px-2.5 py-1 rounded-lg bg-civic-600 hover:bg-civic-700 text-white flex items-center space-x-1 shadow-xs transition"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>{locating ? 'Locating...' : 'Get GPS'}</span>
                  </button>
                </div>

                {locatingMsg && (
                  <p className="text-[11px] text-civic-700 font-medium">{locatingMsg}</p>
                )}

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-500 block mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-slate-700">Detailed Problem Description *</label>
                  <span className="text-slate-400">{description.length}/3000</span>
                </div>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide complete details: when did it start, exact danger, impact on traffic or sanitation..."
                  className={`w-full text-xs p-3 rounded-xl border ${
                    fieldErrors.description ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                  } focus:outline-none focus:ring-2 focus:ring-civic-500`}
                ></textarea>
                {fieldErrors.description && (
                  <span className="text-[11px] text-rose-600 block">{fieldErrors.description[0]}</span>
                )}
              </div>

              {/* Photo Upload Dropzone */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 text-xs block">
                  Evidence Photos (Optional, Max 5 images, 5MB each)
                </label>
                <div className="border-2 border-dashed border-slate-300 hover:border-civic-500 rounded-2xl p-5 text-center bg-slate-50 transition cursor-pointer relative">
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-1">
                    <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">
                      Click to upload photos or drag and drop
                    </p>
                    <p className="text-[11px] text-slate-400">
                      JPEG, PNG, WebP verified by magic bytes before storage
                    </p>
                  </div>
                </div>

                {/* Previews */}
                {previews.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-2">
                    {previews.map((prev, idx) => (
                      <div key={idx} className="relative group rounded-xl overflow-hidden aspect-square border border-slate-200 bg-slate-100">
                        <img src={prev.url} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <span className="absolute bottom-1 left-1 right-1 bg-slate-900/70 text-white text-[9px] px-1 py-0.5 rounded truncate">
                          {prev.size}KB
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-civic-600 hover:bg-civic-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? 'Verifying & Submitting...' : 'Submit Civic Complaint'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
