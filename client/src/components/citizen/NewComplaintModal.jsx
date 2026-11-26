import React, { useState, useEffect, useRef } from 'react';
import LiveCameraEvidence from '../common/LiveCameraEvidence.jsx';
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
  Sparkles,
  Check,
  Search,
  ThumbsUp,
  CheckCheck,
} from 'lucide-react';

const CATEGORIES = [
  { name: 'Roads and Infrastructure', icon: '🛣️', desc: 'Potholes, damaged footpaths, cave-ins' },
  { name: 'Sanitation and Waste Management', icon: '🗑️', desc: 'Garbage accumulation, dead animals, illegal dumping' },
  { name: 'Water Supply', icon: '💧', desc: 'Pipeline bursts, dirty water, low pressure' },
  { name: 'Drainage and Sewerage', icon: '🌊', desc: 'Clogged storm drains, overflowing sewers' },
  { name: 'Street Lighting', icon: '💡', desc: 'Non-functional streetlights, open junction boxes' },
];

export const SUPPORTED_LANGUAGES = [
  { code: 'auto', label: '🌐 Auto-detect (Automatic)' },
  { code: 'en', label: 'English' },
  { code: 'bn', label: 'Bengali (বাংলা)' },
  { code: 'hi', label: 'Hindi (हिन्दी)' },
  { code: 'ta', label: 'Tamil (தமிழ்)' },
  { code: 'te', label: 'Telugu (తెలుగు)' },
  { code: 'mr', label: 'Marathi (मराठी)' },
  { code: 'gu', label: 'Gujarati (ગુજરાતી)' },
  { code: 'kn', label: 'Kannada (ಕನ್ನಡ)' },
  { code: 'ml', label: 'Malayalam (മലയാളം)' },
  { code: 'pa', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'or', label: 'Odia (ଓଡ଼ିଆ)' },
  { code: 'ur', label: 'Urdu (اردو)' },
];

export default function NewComplaintModal({ onClose, onSuccess }) {
  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [languagePreference, setLanguagePreference] = useState('auto');
  const [category, setCategory] = useState(CATEGORIES[0].name);
  const [wardId, setWardId] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [latitude, setLatitude] = useState('12.9784');
  const [longitude, setLongitude] = useState('77.6408');
  const [severity, setSeverity] = useState('medium');

  // Metadata options
  const [wards, setWards] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Images & Live Camera Evidence state
  const [files, setFiles] = useState([]);
  const [evidenceItems, setEvidenceItems] = useState([]);
  const [previews, setPreviews] = useState([]);

  // Geolocation state
  const [locating, setLocating] = useState(false);
  const [locatingMsg, setLocatingMsg] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [successInfo, setSuccessInfo] = useState(null);

  // AI Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [analysisStale, setAnalysisStale] = useState(false);
  const [analyzedSnapshot, setAnalyzedSnapshot] = useState(null);

  // Semantic Duplicate Detection state
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicateCandidates, setDuplicateCandidates] = useState([]);
  const [duplicateError, setDuplicateError] = useState(null);
  const [selectedDuplicateId, setSelectedDuplicateId] = useState(null);
  const [dismissedDuplicateIds, setDismissedDuplicateIds] = useState([]);
  const [hasCheckedDuplicates, setHasCheckedDuplicates] = useState(false);

  // AI Analysis lifecycle refs
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef(null);
  const latestInputRef = useRef({ title: '', description: '' });
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    fetchWards();
    return () => {
      isMountedRef.current = false;
      requestIdRef.current += 1;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
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

  function clearFieldError(...fieldNames) {
    setFieldErrors((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const name of fieldNames) {
        if (next[name]) {
          delete next[name];
          changed = true;
        }
      }
      if (!changed) return prev;
      if (Object.keys(next).length === 0) {
        setError(null);
      }
      return next;
    });
  }

  function handleAddressChange(e) {
    const val = e.target.value;
    setAddress(val);
    clearFieldError('address');
  }

  function handleAddressBlur() {
    const trimmed = address.trim();
    if (trimmed && trimmed.length < 3) {
      setFieldErrors((prev) => ({
        ...prev,
        address: ['Address description must be at least 3 characters long.'],
      }));
    }
  }

  function handleCategorySelect(catName) {
    setCategory(catName);
    clearFieldError('category');
  }

  function handleWardChange(e) {
    const val = e.target.value;
    setWardId(val);
    clearFieldError('ward_id', 'ward');
  }

  function handleSeverityChange(e) {
    const val = e.target.value;
    setSeverity(val);
    clearFieldError('severity');
  }

  function handleLandmarkChange(e) {
    const val = e.target.value;
    setLandmark(val);
    clearFieldError('landmark');
  }

  function handleLatitudeChange(e) {
    const val = e.target.value;
    setLatitude(val);
    clearFieldError('latitude');
  }

  function handleLongitudeChange(e) {
    const val = e.target.value;
    setLongitude(val);
    clearFieldError('longitude');
  }

  function handleTitleChange(e) {
    const val = e.target.value;
    setTitle(val);
    latestInputRef.current.title = val;
    clearFieldError('title');

    if (abortControllerRef.current) {
      requestIdRef.current += 1;
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setAnalyzing(false);
      setAnalysisError('Input changed while analysis was in progress. Please request a fresh analysis.');
    }

    if (analysis) {
      if (analyzedSnapshot && (val.trim() !== analyzedSnapshot.title || description.trim() !== analyzedSnapshot.description)) {
        setAnalysisStale(true);
      } else {
        setAnalysisStale(false);
      }
    }
  }

  function handleDescriptionChange(e) {
    const val = e.target.value;
    setDescription(val);
    latestInputRef.current.description = val;
    clearFieldError('description');

    if (abortControllerRef.current) {
      requestIdRef.current += 1;
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setAnalyzing(false);
      setAnalysisError('Input changed while analysis was in progress. Please request a fresh analysis.');
    }

    if (analysis) {
      if (analyzedSnapshot && (title.trim() !== analyzedSnapshot.title || val.trim() !== analyzedSnapshot.description)) {
        setAnalysisStale(true);
      } else {
        setAnalysisStale(false);
      }
    }
  }

  const ISSUE_TO_MUNICIPAL_CATEGORY_MAP = {
    'Road damage': 'Roads and Infrastructure',
    'Waterlogging': 'Drainage and Sewerage',
    'Drainage and sewage': 'Drainage and Sewerage',
    'Garbage accumulation': 'Sanitation and Waste Management',
    'Streetlight failure': 'Street Lighting',
    'Water supply': 'Water Supply',
    'Public infrastructure damage': 'Roads and Infrastructure',
    'Electricity-related civic issues': 'Street Lighting',
    'Other': 'Roads and Infrastructure',
  };

  async function handleAnalyzeComplaint() {
    if (analyzing) return;
    setAnalysisError(null);

    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();

    if (!trimmedTitle) {
      setAnalysisError('Please enter an issue title before requesting AI analysis.');
      return;
    }
    if (trimmedTitle.length < 5) {
      setAnalysisError('Title must be at least 5 characters long to request AI analysis.');
      return;
    }
    if (!trimmedDesc) {
      setAnalysisError('Please provide a detailed description before requesting AI analysis.');
      return;
    }
    if (trimmedDesc.length < 10) {
      setAnalysisError('Description must be at least 10 characters long to request AI analysis.');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const currentRequestId = ++requestIdRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setAnalyzing(true);

    try {
      let res;
      if (files && files.length > 0) {
        // Send multipart FormData with attached photos for multimodal Gemini analysis
        const formData = new FormData();
        formData.append('title', trimmedTitle);
        formData.append('description', trimmedDesc);
        if (address.trim()) formData.append('address', address.trim());
        if (landmark.trim()) formData.append('landmark', landmark.trim());
        if (additionalInfo.trim()) formData.append('additional_info', additionalInfo.trim());
        if (latitude) formData.append('latitude', latitude);
        if (longitude) formData.append('longitude', longitude);
        formData.append('language_preference', languagePreference);
        for (const f of files) {
          formData.append('images', f);
        }

        res = await fetch('/api/complaints/analyze', {
          method: 'POST',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'include',
          signal: controller.signal,
          body: formData,
        });
      } else {
        // Send JSON payload when no files are attached (preserves test contract)
        const jsonBody = {
          title: trimmedTitle,
          description: trimmedDesc,
        };
        if (languagePreference && languagePreference !== 'auto') {
          jsonBody.language_preference = languagePreference;
        }
        res = await fetch('/api/complaints/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify(jsonBody),
        });
      }

      if (currentRequestId !== requestIdRef.current || !isMountedRef.current) {
        return;
      }

      const resData = await res.json().catch(() => null);

      if (currentRequestId !== requestIdRef.current || !isMountedRef.current) {
        return;
      }

      if (res.status === 400) {
        if (resData?.details?.title?.[0]) {
          setAnalysisError(resData.details.title[0]);
        } else if (resData?.details?.description?.[0]) {
          setAnalysisError(resData.details.description[0]);
        } else {
          setAnalysisError(resData?.error || 'Validation failed. Please review title and description length.');
        }
        return;
      }

      if (res.status === 401) {
        setAnalysisError('Your session has expired. Please log in again to request AI analysis.');
        return;
      }

      if (res.status === 403) {
        setAnalysisError(resData?.error || 'Access denied or CSRF session expired. Only citizen accounts can use this feature.');
        return;
      }

      if (res.status === 502 || res.status === 503) {
        setAnalysisError(
          resData?.error || 'AI analysis service is temporarily busy or unavailable. You can proceed to select your category manually.'
        );
        return;
      }

      if (!res.ok) {
        setAnalysisError(resData?.error || 'Unable to analyze complaint at this time. Please select category manually.');
        return;
      }

      if (resData && (resData.suggestedCategory || resData.issue_category)) {
        setAnalysis(resData);
        setAnalysisStale(false);
        setAnalyzedSnapshot({ title: trimmedTitle, description: trimmedDesc });
        setAnalysisError(null);
      } else {
        setAnalysisError('AI service returned an unexpected response structure. Please select category manually.');
      }
    } catch (err) {
      if (err.name === 'AbortError' || currentRequestId !== requestIdRef.current || !isMountedRef.current) {
        return;
      }
      setAnalysisError('Network error connecting to AI analysis service. Please check your connection and try again.');
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      if (currentRequestId === requestIdRef.current && isMountedRef.current) {
        setAnalyzing(false);
      }
    }
  }

  function handleAcceptSuggestion() {
    if (analysisStale) return;
    if (!analyzedSnapshot) return;
    if (
      title.trim() !== analyzedSnapshot.title ||
      description.trim() !== analyzedSnapshot.description
    ) {
      return;
    }

    // Set category based on suggested municipal category or issue category mapping
    const targetCat = analysis?.suggestedCategory || ISSUE_TO_MUNICIPAL_CATEGORY_MAP[analysis?.issue_category] || analysis?.issue_category;
    if (targetCat) {
      const direct = CATEGORIES.find((c) => c.name.toLowerCase() === targetCat.toLowerCase());
      if (direct) {
        setCategory(direct.name);
      } else if (ISSUE_TO_MUNICIPAL_CATEGORY_MAP[targetCat]) {
        setCategory(ISSUE_TO_MUNICIPAL_CATEGORY_MAP[targetCat]);
      } else {
        setCategory(targetCat);
      }
      clearFieldError('category');
    }

    // Also accept suggested severity if valid
    if (analysis?.severity) {
      const sevLower = analysis.severity.toLowerCase();
      if (['low', 'medium', 'high', 'critical'].includes(sevLower)) {
        setSeverity(sevLower);
        clearFieldError('severity');
      }
    }
  }

  function handleIgnoreSuggestion() {
    requestIdRef.current += 1;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setAnalyzing(false);
    setAnalysis(null);
    setAnalysisStale(false);
    setAnalyzedSnapshot(null);
    setAnalysisError(null);
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

  async function handleCheckDuplicates() {
    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();

    if (!trimmedTitle || trimmedTitle.length < 5) {
      setDuplicateError('Please enter an issue title (at least 5 characters) before checking for similar reports.');
      return;
    }
    if (!trimmedDesc || trimmedDesc.length < 10) {
      setDuplicateError('Please enter a description (at least 10 characters) before checking for similar reports.');
      return;
    }

    setCheckingDuplicates(true);
    setDuplicateError(null);

    try {
      const res = await fetch('/api/complaints/check-duplicates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: trimmedTitle,
          description: trimmedDesc,
          category,
          ward_id: wardId || undefined,
          address: address.trim() || undefined,
          landmark: landmark.trim() || undefined,
          latitude: latitude ? Number(latitude) : undefined,
          longitude: longitude ? Number(longitude) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to check for similar complaints.');
      }

      setHasCheckedDuplicates(true);
      setDuplicateCandidates(data.duplicates || []);
    } catch (err) {
      setDuplicateError(err.message || 'Error checking for similar complaints.');
    } finally {
      setCheckingDuplicates(false);
    }
  }

  function handleSelectDuplicate(candidateId) {
    setSelectedDuplicateId(candidateId);
  }

  function handleUnlinkDuplicate() {
    setSelectedDuplicateId(null);
  }

  function handleDismissDuplicate(candidateId) {
    setDismissedDuplicateIds((prev) => [...prev, candidateId]);
    if (selectedDuplicateId === candidateId) {
      setSelectedDuplicateId(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    setSuccessInfo(null);

    // Client-side address validation (minimum length 3)
    const trimmedAddress = address.trim();
    if (!trimmedAddress || trimmedAddress.length < 3) {
      setFieldErrors({
        address: ['Address description must be at least 3 characters long.'],
      });
      setError('Please resolve the highlighted validation errors.');
      setSubmitting(false);
      return;
    }

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('description', description.trim());
    formData.append('language_preference', languagePreference);
    formData.append('category', category);
    formData.append('ward_id', wardId);
    formData.append('latitude', latitude);
    formData.append('longitude', longitude);
    formData.append('address', trimmedAddress);
    if (landmark.trim()) {
      formData.append('landmark', landmark.trim());
    }
    if (additionalInfo.trim()) {
      formData.append('additional_info', additionalInfo.trim());
    }
    formData.append('severity', severity);

    if (selectedDuplicateId) {
      formData.append('duplicate_of_id', selectedDuplicateId);
    } else if (dismissedDuplicateIds.length > 0) {
      formData.append('duplicate_of_id', 'separate');
    }

    if (analysis && !analysisStale) {
      formData.append('ai_analysis', JSON.stringify(analysis));
    }

    for (const f of files) {
      formData.append('images', f);
    }
    if (evidenceItems.length > 0) {
      formData.append('evidence_metadata', JSON.stringify(evidenceItems.map((it) => it.metadata)));
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

      const resData = await res.json().catch(() => null);
      if (!res.ok) {
        if (resData?.details && Object.keys(resData.details).length > 0) {
          const details = { ...resData.details };
          if (details.ward && !details.ward_id) {
            details.ward_id = details.ward;
          }
          setFieldErrors(details);
          setError('Please resolve the highlighted validation errors.');
          return;
        }

        // Preserve generic banner for cases where no field-specific errors are available
        setFieldErrors({});
        setError(resData?.error || 'Failed to submit complaint.');
        return;
      }

      setSuccessInfo(resData);
      if (onSuccess) {
        onSuccess(resData.complaint);
      }
    } catch (err) {
      setError(err.message || 'Network error submitting complaint. Please try again.');
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

              {/* Language Selector */}
              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <label htmlFor="language-selector" className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <span>🌐 Preferred Language / পছন্দের ভাষা / पसंदीदा भाषा</span>
                  </label>
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">
                    Multilingual Gemini AI
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    id="language-selector"
                    value={languagePreference}
                    onChange={(e) => setLanguagePreference(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-blue-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 self-center leading-snug">
                    Submit in Bengali, Hindi, English, or any Indian regional language. Hinglish/Benglish &amp; colloquial phrasing are supported.
                  </p>
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <label htmlFor="issue-title" className="font-bold text-slate-700">Issue Title *</label>
                  <span className="text-slate-400">{title.length}/200</span>
                </div>
                <input
                  id="issue-title"
                  type="text"
                  required
                  value={title}
                  onChange={handleTitleChange}
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
                      onClick={() => handleCategorySelect(cat.name)}
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
                {fieldErrors.category && (
                  <span className="text-[11px] text-rose-600 block">{fieldErrors.category[0]}</span>
                )}
              </div>

              {/* Ward & Severity in 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="ward-select" className="font-bold text-slate-700 text-xs block">Administrative Ward *</label>
                  <select
                    id="ward-select"
                    value={wardId}
                    onChange={handleWardChange}
                    required
                    className={`w-full text-xs p-3 rounded-xl border ${
                      fieldErrors.ward_id || fieldErrors.ward ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                    } bg-white focus:outline-none focus:ring-2 focus:ring-civic-500`}
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
                  {(fieldErrors.ward_id || fieldErrors.ward) && (
                    <span className="text-[11px] text-rose-600 block">{(fieldErrors.ward_id || fieldErrors.ward)[0]}</span>
                  )}
                </div>

                <div className="space-y-1">
                  <label htmlFor="severity-select" className="font-bold text-slate-700 text-xs block">Severity Level *</label>
                  <select
                    id="severity-select"
                    value={severity}
                    onChange={handleSeverityChange}
                    className={`w-full text-xs p-3 rounded-xl border ${
                      fieldErrors.severity ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                    } bg-white focus:outline-none focus:ring-2 focus:ring-civic-500`}
                  >
                    <option value="low">Low (Minor inconvenience)</option>
                    <option value="medium">Medium (Moderate traffic or health risk)</option>
                    <option value="high">High (Substantial danger or property hazard)</option>
                    <option value="critical">Critical (Immediate public danger)</option>
                  </select>
                  {fieldErrors.severity && (
                    <span className="text-[11px] text-rose-600 block">{fieldErrors.severity[0]}</span>
                  )}
                </div>
              </div>

              {/* Location Address & Landmark */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="address-input" className="font-bold text-slate-700 text-xs block">Address / Street Location *</label>
                  <input
                    id="address-input"
                    type="text"
                    required
                    value={address}
                    onChange={handleAddressChange}
                    onBlur={handleAddressBlur}
                    placeholder="e.g. 100ft Road, between 12th & 14th Main"
                    className={`w-full text-xs p-3 rounded-xl border ${
                      fieldErrors.address ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                    } focus:outline-none focus:ring-2 focus:ring-civic-500`}
                  />
                  {fieldErrors.address && (
                    <span className="text-[11px] text-rose-600 block">{fieldErrors.address[0]}</span>
                  )}
                </div>

                <div className="space-y-1">
                  <label htmlFor="landmark-input" className="font-bold text-slate-700 text-xs block">Landmark (Optional)</label>
                  <input
                    id="landmark-input"
                    type="text"
                    value={landmark}
                    onChange={handleLandmarkChange}
                    placeholder="e.g. Opp ICICI Bank, near pedestrian crossing"
                    className={`w-full text-xs p-3 rounded-xl border ${
                      fieldErrors.landmark ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                    } focus:outline-none focus:ring-2 focus:ring-civic-500`}
                  />
                  {fieldErrors.landmark && (
                    <span className="text-[11px] text-rose-600 block">{fieldErrors.landmark[0]}</span>
                  )}
                </div>
              </div>

              {/* Additional Information / Field Observations */}
              <div className="space-y-1">
                <label htmlFor="additional-info-input" className="font-bold text-slate-700 text-xs block">
                  Additional Information / Citizen Notes (Optional)
                </label>
                <input
                  id="additional-info-input"
                  type="text"
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="e.g. Water enters nearby shops during heavy rain, or observed sparks yesterday"
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-civic-500"
                />
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
                      onChange={handleLatitudeChange}
                      className={`w-full p-2.5 rounded-lg border ${
                        fieldErrors.latitude ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                      } bg-white font-mono text-xs`}
                    />
                    {fieldErrors.latitude && (
                      <span className="text-[11px] text-rose-600 block mt-1">{fieldErrors.latitude[0]}</span>
                    )}
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={longitude}
                      onChange={handleLongitudeChange}
                      className={`w-full p-2.5 rounded-lg border ${
                        fieldErrors.longitude ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                      } bg-white font-mono text-xs`}
                    />
                    {fieldErrors.longitude && (
                      <span className="text-[11px] text-rose-600 block mt-1">{fieldErrors.longitude[0]}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <label htmlFor="problem-description" className="font-bold text-slate-700">Detailed Problem Description *</label>
                  <span className="text-slate-400">{description.length}/3000</span>
                </div>
                <textarea
                  id="problem-description"
                  required
                  rows={4}
                  value={description}
                  onChange={handleDescriptionChange}
                  placeholder="Provide complete details: when did it start, exact danger, impact on traffic or sanitation..."
                  className={`w-full text-xs p-3 rounded-xl border ${
                    fieldErrors.description ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                  } focus:outline-none focus:ring-2 focus:ring-civic-500`}
                ></textarea>
                {fieldErrors.description && (
                  <span className="text-[11px] text-rose-600 block">{fieldErrors.description[0]}</span>
                )}

                {/* AI Suggestion Action Button */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleAnalyzeComplaint}
                      disabled={analyzing}
                      aria-busy={analyzing}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      <span>{analyzing ? 'Analyzing with Gemini...' : 'Suggest Category & Summary'}</span>
                    </button>
                    {analyzing && (
                      <button
                        type="button"
                        onClick={handleIgnoreSuggestion}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                      >
                        Ignore Analysis
                      </button>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400">Gemini AI Assistance (Optional & Advisory)</span>
                </div>

                {/* Analysis Error Announcement */}
                {analysisError && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start space-x-2 mt-2"
                  >
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{analysisError}</span>
                  </div>
                )}

                {/* AI Advisory Results Card */}
                {analysis && (
                  <div
                    role="region"
                    aria-live="polite"
                    aria-label="AI Complaint Analysis Result"
                    className={`p-4 rounded-2xl border text-xs space-y-3 mt-3 transition ${
                      analysisStale
                        ? 'bg-slate-50 border-dashed border-slate-300 text-slate-600'
                        : 'bg-purple-50/70 border-purple-200 text-purple-950'
                    }`}
                  >
                    {/* Stale Warning Banner */}
                    {analysisStale && (
                      <div className="flex items-center space-x-1.5 text-[11px] text-amber-700 font-medium bg-amber-50 p-2 rounded-lg border border-amber-200">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Input modified since analysis. Click &quot;Suggest Category &amp; Summary&quot; to refresh.</span>
                      </div>
                    )}

                    {/* Header with Advisory Label and Confidence Badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span className="font-bold text-slate-900 text-xs">AI Advisory Suggestion</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] text-slate-500 font-normal hidden sm:inline">Advisory only, not an official decision</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            (analysis.confidence === 'high' || analysis.confidence_score >= 80)
                              ? 'bg-emerald-100 text-emerald-800'
                              : (analysis.confidence === 'medium' || analysis.confidence_score >= 50)
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {analysis.confidence_score ? `${analysis.confidence_score}%` : analysis.confidence} Confidence
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 italic">
                      This suggestion was generated by AI to help classify your issue. You have full control to accept or keep your manual choice.
                    </p>

                    {/* Multilingual Understanding & Standardised Translation (Requirements 4 & 5) */}
                    {analysis.detected_language && (
                      <div className="p-3.5 rounded-xl bg-white border border-purple-200/90 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Detected Language:</span>
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-800 font-bold text-xs">
                              {analysis.detected_language}
                            </span>
                          </div>
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            {analysis.translation_confidence || analysis.confidence_score || 100}% translation confidence
                          </span>
                        </div>

                        {/* Standardised English Translation Preview */}
                        {analysis.english_translation && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              Standardised English Translation (For Municipal Engineers &amp; Officials):
                            </span>
                            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 italic leading-relaxed">
                              &ldquo;{analysis.english_translation}&rdquo;
                            </div>
                          </div>
                        )}

                        <div className="text-[11px] text-slate-500 bg-slate-50/70 p-2 rounded-lg border border-slate-200/60 leading-snug">
                          <strong>Note:</strong> Your original submission text is preserved verbatim and never silently altered. You may edit your description above before final submission.
                        </div>
                      </div>
                    )}

                    {/* Suggested Category & Subcategory */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                        Detected Civic Issue &amp; Category:
                      </span>
                      <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-purple-100">
                        <div>
                          <span className="font-bold text-slate-900 text-xs">
                            {analysis.issue_category || analysis.suggestedCategory}
                          </span>
                          {analysis.issue_subcategory && (
                            <span className="text-[11px] text-slate-500 ml-2 font-medium">
                              ({analysis.issue_subcategory})
                            </span>
                          )}
                        </div>
                        {category === (analysis.suggestedCategory || analysis.issue_category) ? (
                          <span className="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            ✓ Category Selected
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Current selection: {category}</span>
                        )}
                      </div>
                    </div>

                    {/* Department & Severity Row */}
                    {(analysis.recommended_department || analysis.severity) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {analysis.recommended_department && (
                          <div className="bg-white p-2 rounded-xl border border-purple-100 space-y-0.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                              Recommended Department:
                            </span>
                            <p className="text-xs font-semibold text-slate-800">{analysis.recommended_department}</p>
                          </div>
                        )}
                        {analysis.severity && (
                          <div className="bg-white p-2 rounded-xl border border-purple-100 space-y-0.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                              Estimated Severity:
                            </span>
                            <div className="flex items-center space-x-1.5">
                              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${
                                analysis.severity === 'Critical' ? 'bg-rose-100 text-rose-800' :
                                analysis.severity === 'High' ? 'bg-orange-100 text-orange-800' :
                                analysis.severity === 'Medium' ? 'bg-amber-100 text-amber-800' :
                                'bg-slate-100 text-slate-800'
                              }`}>
                                {analysis.severity}
                              </span>
                              {severity.toLowerCase() === analysis.severity.toLowerCase() && (
                                <span className="text-[10px] text-emerald-600 font-medium">✓ Active</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Summary */}
                    {(analysis.description_summary || analysis.summary) && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                          Executive Summary:
                        </span>
                        <p className="bg-white p-2.5 rounded-xl border border-purple-100 text-slate-700 text-xs leading-relaxed">
                          {analysis.description_summary || analysis.summary}
                        </p>
                      </div>
                    )}

                    {/* Visible Evidence */}
                    {Array.isArray(analysis.visible_evidence) && analysis.visible_evidence.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                          Visible Evidence:
                        </span>
                        <div className="flex flex-wrap gap-1.5 bg-white p-2.5 rounded-xl border border-purple-100">
                          {analysis.visible_evidence.map((ev, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] border border-slate-200">
                              {ev}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Detected Objects */}
                    {Array.isArray(analysis.detected_objects) && analysis.detected_objects.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                          Detected Objects:
                        </span>
                        <div className="flex flex-wrap gap-1.5 bg-white p-2.5 rounded-xl border border-purple-100">
                          {analysis.detected_objects.map((obj, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 text-[11px] border border-purple-200">
                              {obj}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Key Details Fallback */}
                    {Array.isArray(analysis.keyDetails) && (!analysis.visible_evidence || analysis.visible_evidence.length === 0) && analysis.keyDetails.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                          Key Details Identified:
                        </span>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-700 text-xs bg-white p-2.5 rounded-xl border border-purple-100">
                          {analysis.keyDetails.map((detail, idx) => (
                            <li key={idx} className="leading-relaxed">{detail}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Potential Public Safety Risk */}
                    {analysis.potential_public_safety_risk && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-0.5">
                        <span className="font-bold block text-rose-800">Public Safety Risk Assessment:</span>
                        <p className="text-rose-700 text-[11px] leading-relaxed">{analysis.potential_public_safety_risk}</p>
                      </div>
                    )}

                    {/* Additional Information Required / Clarification */}
                    {((Array.isArray(analysis.additional_information_required) && analysis.additional_information_required.length > 0) || (analysis.needsClarification && analysis.clarificationQuestion)) && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                        <span className="font-bold block text-amber-800">Additional Information Required:</span>
                        {analysis.clarificationQuestion ? (
                          <p className="text-amber-700">{analysis.clarificationQuestion}</p>
                        ) : (
                          <ul className="list-disc list-inside space-y-0.5 text-amber-700 text-xs">
                            {analysis.additional_information_required.map((reqItem, idx) => (
                              <li key={idx}>{reqItem}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center space-x-2 pt-1 border-t border-purple-100">
                      <button
                        type="button"
                        onClick={handleAcceptSuggestion}
                        disabled={analysisStale}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs shadow-xs transition flex items-center space-x-1 ${
                          analysisStale
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept &quot;{analysis.suggestedCategory || analysis.issue_category}&quot;</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleIgnoreSuggestion}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 font-medium text-xs transition"
                      >
                        Ignore Suggestion
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Live Geo-Tagged Camera Evidence */}
              <div className="space-y-2">
                <LiveCameraEvidence
                  items={evidenceItems}
                  onItemsChange={(newItems) => {
                    setEvidenceItems(newItems);
                    setFiles(newItems.map((it) => it.file));
                    setAnalysisStale(true);
                  }}
                  maxPhotos={5}
                  maxVideos={1}
                  disabled={submitting || analyzing}
                  evidencePurpose="citizen_report"
                />
                {fieldErrors.images && (
                  <span className="text-[11px] text-rose-600 block">{fieldErrors.images[0]}</span>
                )}
              </div>

              {/* Duplicate Detection / Similar Issues Section */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                      <Layers className="w-4 h-4 text-purple-600" />
                      <span>Similar issues already reported near this location</span>
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Avoid duplicate tickets by linking your report to an existing community issue.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCheckDuplicates}
                    disabled={checkingDuplicates}
                    className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-xs flex items-center space-x-1.5 transition"
                  >
                    <Search className={`w-3.5 h-3.5 ${checkingDuplicates ? 'animate-spin' : ''}`} />
                    <span>{checkingDuplicates ? 'Scanning Nearby...' : 'Check Nearby Reports'}</span>
                  </button>
                </div>

                {duplicateError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{duplicateError}</span>
                  </div>
                )}

                {hasCheckedDuplicates && duplicateCandidates.length === 0 && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 text-xs flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>No similar complaints found nearby. Your report will be recorded as a unique standalone issue.</span>
                  </div>
                )}

                {hasCheckedDuplicates && duplicateCandidates.length > 0 && (
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {duplicateCandidates
                      .filter((cand) => !dismissedDuplicateIds.includes(cand.id))
                      .map((match) => {
                        const isSelected = selectedDuplicateId === match.id;
                        const isHigh = match.similarity_level === 'high';
                        const isMed = match.similarity_level === 'medium';

                        const badgeBg = isHigh
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : isMed
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300';

                        const similarityLabel = isHigh
                          ? `Strong Match (${match.similarity_score}%)`
                          : isMed
                          ? `Possible Related (${match.similarity_score}%)`
                          : `Low Match (${match.similarity_score}%)`;

                        return (
                          <div
                            key={match.id}
                            className={`p-3.5 rounded-2xl border transition space-y-2 ${
                              isSelected
                                ? 'bg-purple-50/80 border-purple-400 ring-2 ring-purple-300'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center space-x-2">
                                <span className="font-mono font-bold text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  {match.ticket_number}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-600 px-2 py-0.5 rounded-full bg-slate-100">
                                  {match.category}
                                </span>
                              </div>
                              <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${badgeBg}`}>
                                {similarityLabel}
                              </span>
                            </div>

                            <div>
                              <p className="font-bold text-slate-900 text-xs line-clamp-1">{match.title}</p>
                              <p className="text-slate-600 text-[11px] line-clamp-2 mt-0.5">{match.description}</p>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                              <div className="flex items-center space-x-3">
                                <span className="flex items-center space-x-1">
                                  <MapPin className="w-3 h-3 text-slate-400" />
                                  <span>{match.distance_meters !== null ? `${match.distance_meters}m away` : match.address}</span>
                                </span>
                                <span>Status: <strong className="text-slate-700">{match.status}</strong></span>
                                <span>Reported: {new Date(match.created_at).toLocaleDateString()}</span>
                              </div>

                              <div className="flex items-center space-x-2">
                                {isSelected ? (
                                  <button
                                    type="button"
                                    onClick={handleUnlinkDuplicate}
                                    className="px-2.5 py-1 rounded-lg bg-purple-600 text-white font-bold text-[11px] flex items-center space-x-1 shadow-xs"
                                  >
                                    <CheckCheck className="w-3 h-3" />
                                    <span>Linked (Click to Unlink)</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectDuplicate(match.id)}
                                    className="px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold text-[11px] flex items-center space-x-1 transition"
                                  >
                                    <ThumbsUp className="w-3 h-3" />
                                    <span>This is the same issue</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDismissDuplicate(match.id)}
                                  className="px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100 text-[11px] font-medium transition"
                                >
                                  Report as Separate Issue
                                </button>
                              </div>
                            </div>

                            {isSelected && (
                              <div className="p-2 bg-purple-100/60 rounded-xl text-purple-900 text-[11px] flex items-center space-x-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                                <span>
                                  Confirmed: Your photos and notes will be submitted as supporting evidence for ticket {match.ticket_number}.
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
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
