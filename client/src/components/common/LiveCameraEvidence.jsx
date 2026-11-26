import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Video,
  VideoOff,
  X,
  RotateCcw,
  Check,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Clock,
  Trash2,
  Play,
  Square,
  Circle,
  Loader2,
  Shield,
  Eye,
  Info,
} from 'lucide-react';

/**
 * CivicMemory — Live Geo-Tagged Camera & Video Evidence Component
 * 
 * Hardware-integrated capture component utilizing:
 * - navigator.mediaDevices.getUserMedia() for live environment camera stream.
 * - MediaRecorder for client-side live video recording.
 * - HTML5 Canvas for real-time live photographic frame grabs.
 * - Browser Geolocation API for immediate device GPS acquisition.
 * 
 * Strictly client-provided claims terminology:
 * - "Camera captured"
 * - "GPS location reported by device"
 * - "Location accuracy reported by device"
 */
export default function LiveCameraEvidence({
  items = [],
  onItemsChange,
  maxPhotos = 5,
  maxVideos = 1,
  maxVideoDurationSeconds = 30,
  maxVideoSizeBytes = 25 * 1024 * 1024, // 25 MB
  disabled = false,
  accuracyThresholdMeters = 100,
  evidencePurpose = 'citizen_report',
}) {
  // Active camera modal state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState('photo'); // 'photo' | 'video'

  // Device streams & recording state
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isInitializingCamera, setIsInitializingCamera] = useState(false);

  // Video recording runtime state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingStartTimeRef = useRef(null);

  // Live Location state
  const [liveLocation, setLiveLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('pending'); // 'pending' | 'acquired' | 'unavailable'
  const [locationError, setLocationError] = useState(null);

  // Staged Item under immediate review (before confirmed into items array)
  const [stagedEvidence, setStagedEvidence] = useState(null);

  // Selected item modal preview (for existing items in gallery)
  const [inspectItem, setInspectItem] = useState(null);

  // Video / Canvas DOM refs
  const videoPreviewRef = useRef(null);

  const photoCount = items.filter((it) => it.metadata?.media_type === 'IMAGE' || it.media_type === 'IMAGE').length;
  const videoCount = items.filter((it) => it.metadata?.media_type === 'VIDEO' || it.media_type === 'VIDEO').length;
  const canAddPhoto = photoCount < maxPhotos;
  const canAddVideo = videoCount < maxVideos;

  // Stop all camera media tracks safely
  const stopMediaTracks = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      setStream(null);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, [stream]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopMediaTracks();
    };
  }, [stopMediaTracks]);

  // Attach active stream to video element
  useEffect(() => {
    if (videoPreviewRef.current && stream) {
      videoPreviewRef.current.srcObject = stream;
    }
  }, [stream, isCameraOpen]);

  // Fetch fresh GPS position using high accuracy
  const fetchFreshGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setLocationStatus('pending');
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: parseFloat(pos.coords.latitude.toFixed(6)),
          longitude: parseFloat(pos.coords.longitude.toFixed(6)),
          accuracy_meters: Math.round(pos.coords.accuracy),
          acquired_at: new Date(pos.timestamp || Date.now()).toISOString(),
        };
        setLiveLocation(coords);
        setLocationStatus('acquired');
      },
      (err) => {
        let msg = 'Device GPS location unavailable.';
        if (err.code === 1) msg = 'Location permission denied by user. Verified location evidence cannot be attached.';
        else if (err.code === 2) msg = 'Location unavailable or GPS signal lost.';
        else if (err.code === 3) msg = 'Location request timed out.';
        setLocationStatus('unavailable');
        setLocationError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0, // Force fresh reading immediately before capture
      }
    );
  }, []);

  // Initialize Camera Stream
  const startCamera = async (mode = captureMode) => {
    stopMediaTracks();
    setCameraError(null);
    setIsInitializingCamera(true);
    setStagedEvidence(null);
    setIsRecording(false);
    setRecordingSeconds(0);

    // Refresh device location concurrently
    fetchFreshGPS();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API is not supported on this device/browser.');
      setIsInitializingCamera(false);
      return;
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: mode === 'video', // Audio enabled only in video mode
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setIsCameraOpen(true);
    } catch (err) {
      console.error('[LiveCameraEvidence] Camera access error:', err);
      let errMsg = 'Could not access device camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errMsg = 'Camera permission denied. Please enable camera access in browser permissions to capture evidence.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errMsg = 'No camera device found on this system.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errMsg = 'Camera hardware is currently in use by another application.';
      }
      setCameraError(errMsg);
    } finally {
      setIsInitializingCamera(false);
    }
  };

  // Close camera modal
  const handleCloseCamera = () => {
    stopMediaTracks();
    setIsCameraOpen(false);
    setStagedEvidence(null);
  };

  // Switch capture mode (Photo vs Video)
  const handleModeSwitch = (newMode) => {
    if (newMode === captureMode || isRecording) return;
    setCaptureMode(newMode);
    startCamera(newMode);
  };

  // -------------------------------------------------------------
  // Photo Capture Flow
  // -------------------------------------------------------------
  const capturePhoto = () => {
    if (!videoPreviewRef.current || !stream) return;

    const videoEl = videoPreviewRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth || 1280;
    canvas.height = videoEl.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    const captureTimestamp = new Date().toISOString();

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError('Failed to capture frame from video stream.');
          return;
        }

        const fileName = `live_photo_${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        const previewUrl = URL.createObjectURL(blob);

        const metadata = {
          latitude: liveLocation?.latitude ?? null,
          longitude: liveLocation?.longitude ?? null,
          accuracy_meters: liveLocation?.accuracy_meters ?? null,
          captured_at: captureTimestamp,
          recording_started_at: null,
          recording_ended_at: null,
          capture_type: 'LIVE_CAMERA',
          media_type: 'IMAGE',
          evidence_purpose: evidencePurpose,
          mime_type: 'image/jpeg',
          file_size: blob.size,
          duration_seconds: null,
        };

        setStagedEvidence({
          id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          blob,
          previewUrl,
          metadata,
        });

        // Pause stream preview while reviewing
        try {
          videoEl.pause();
        } catch (_) {}
      },
      'image/jpeg',
      0.92
    );
  };

  // -------------------------------------------------------------
  // Video Recording Flow
  // -------------------------------------------------------------
  const startVideoRecording = () => {
    if (!stream || isRecording) return;

    // Refresh location right at recording start
    fetchFreshGPS();
    recordedChunksRef.current = [];
    recordingStartTimeRef.current = new Date().toISOString();
    setRecordingSeconds(0);

    // Determine supported mime type
    let mimeType = 'video/webm;codecs=vp8,opus';
    if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
      mimeType = 'video/webm;codecs=vp9,opus';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      mimeType = 'video/webm';
    }

    try {
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const recordingEndTime = new Date().toISOString();
        const videoBlob = new Blob(recordedChunksRef.current, { type: mimeType });

        if (videoBlob.size > maxVideoSizeBytes) {
          setCameraError(
            `Recorded video exceeds the maximum allowed size of ${(maxVideoSizeBytes / (1024 * 1024)).toFixed(0)}MB. Please record a shorter clip.`
          );
          setStagedEvidence(null);
          return;
        }

        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const fileName = `live_video_${Date.now()}.${ext}`;
        const file = new File([videoBlob], fileName, { type: mimeType });
        const previewUrl = URL.createObjectURL(videoBlob);

        const duration = recordingSeconds;

        const metadata = {
          latitude: liveLocation?.latitude ?? null,
          longitude: liveLocation?.longitude ?? null,
          accuracy_meters: liveLocation?.accuracy_meters ?? null,
          captured_at: recordingStartTimeRef.current,
          recording_started_at: recordingStartTimeRef.current,
          recording_ended_at: recordingEndTime,
          capture_type: 'LIVE_CAMERA',
          media_type: 'VIDEO',
          evidence_purpose: evidencePurpose,
          mime_type: mimeType.split(';')[0],
          file_size: videoBlob.size,
          duration_seconds: duration,
        };

        setStagedEvidence({
          id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          blob: videoBlob,
          previewUrl,
          metadata,
        });
      };

      recorder.start(1000); // 1-second chunks
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      // Start duration counter
      const timer = setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          if (next >= maxVideoDurationSeconds) {
            stopVideoRecording();
          }
          return next;
        });
      }, 1000);
      recordingTimerRef.current = timer;
    } catch (err) {
      console.error('[LiveCameraEvidence] Failed to start MediaRecorder:', err);
      setCameraError(`Failed to initialize video recording: ${err.message}`);
    }
  };

  const stopVideoRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // Retake staged evidence
  const handleRetakeStaged = () => {
    if (stagedEvidence?.previewUrl) {
      URL.revokeObjectURL(stagedEvidence.previewUrl);
    }
    setStagedEvidence(null);
    if (videoPreviewRef.current) {
      try {
        videoPreviewRef.current.play();
      } catch (_) {}
    }
  };

  // Confirm staged evidence into confirmed items list
  const handleConfirmStaged = () => {
    if (!stagedEvidence) return;
    const nextItems = [...items, stagedEvidence];
    onItemsChange(nextItems);
    setStagedEvidence(null);

    // If limits reached, close camera; otherwise stay in camera for next capture
    const updatedPhotos = nextItems.filter((i) => i.metadata?.media_type === 'IMAGE').length;
    const updatedVideos = nextItems.filter((i) => i.metadata?.media_type === 'VIDEO').length;

    if (captureMode === 'photo' && updatedPhotos >= maxPhotos) {
      handleCloseCamera();
    } else if (captureMode === 'video' && updatedVideos >= maxVideos) {
      handleCloseCamera();
    } else {
      if (videoPreviewRef.current) {
        try {
          videoPreviewRef.current.play();
        } catch (_) {}
      }
    }
  };

  // Remove existing confirmed item
  const handleRemoveItem = (index) => {
    const toRemove = items[index];
    if (toRemove?.previewUrl) {
      URL.revokeObjectURL(toRemove.previewUrl);
    }
    const nextItems = items.filter((_, idx) => idx !== index);
    onItemsChange(nextItems);
  };

  return (
    <div className="space-y-3">
      {/* Captured Evidence Gallery / Triggers */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
            Live Geo-Tagged Evidence
          </label>
          <p className="text-[11px] text-slate-500">
            Real-time device camera capture with device-reported GPS and timestamps.
          </p>
        </div>

        {/* Counter Indicators */}
        <div className="flex items-center space-x-2 text-xs">
          <span
            className={`px-2.5 py-1 rounded-lg border font-semibold flex items-center space-x-1 ${
              photoCount >= maxPhotos
                ? 'bg-slate-100 text-slate-500 border-slate-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>
              {photoCount}/{maxPhotos} Photos
            </span>
          </span>

          <span
            className={`px-2.5 py-1 rounded-lg border font-semibold flex items-center space-x-1 ${
              videoCount >= maxVideos
                ? 'bg-slate-100 text-slate-500 border-slate-200'
                : 'bg-purple-50 text-purple-700 border-purple-200'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>
              {videoCount}/{maxVideos} Video ({maxVideoDurationSeconds}s max)
            </span>
          </span>
        </div>
      </div>

      {/* Captured Items Thumbnails Gallery */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
          {items.map((item, idx) => {
            const isVideo = item.metadata?.media_type === 'VIDEO';
            const meta = item.metadata || {};
            const hasGPS = meta.latitude != null && meta.longitude != null;

            return (
              <div
                key={item.id || idx}
                className="group relative rounded-2xl border border-slate-200 bg-slate-900 overflow-hidden shadow-sm aspect-video flex flex-col justify-end text-white text-[11px]"
              >
                {/* Visual Media Element */}
                {isVideo ? (
                  <video
                    src={item.previewUrl}
                    className="absolute inset-0 w-full h-full object-cover opacity-90"
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={item.previewUrl}
                    alt="Captured evidence"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}

                {/* Dark Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent pointer-events-none" />

                {/* Media Type Badge (Top-left) */}
                <div className="absolute top-2 left-2 flex items-center space-x-1 z-10">
                  <span
                    className={`px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center space-x-1 shadow-sm ${
                      isVideo
                        ? 'bg-purple-600/90 text-white'
                        : 'bg-blue-600/90 text-white'
                    }`}
                  >
                    {isVideo ? <Video className="w-3 h-3" /> : <Camera className="w-3 h-3" />}
                    <span>{isVideo ? `VIDEO (${meta.duration_seconds || 0}s)` : 'PHOTO'}</span>
                  </span>
                </div>

                {/* Remove & Inspect Buttons (Top-right) */}
                <div className="absolute top-2 right-2 flex items-center space-x-1 z-10">
                  <button
                    type="button"
                    onClick={() => setInspectItem(item)}
                    title="Preview Full Evidence"
                    className="p-1 rounded-md bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white transition shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      title="Remove Evidence"
                      className="p-1 rounded-md bg-rose-900/80 hover:bg-rose-700 text-rose-200 hover:text-white transition shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Metadata Summary (Bottom Overlay) */}
                <div className="relative z-10 p-2.5 space-y-0.5">
                  <div className="flex items-center space-x-1 text-[10px] text-slate-300 font-mono">
                    <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {meta.captured_at
                        ? new Date(meta.captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : 'Captured'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 text-[10px]">
                    <MapPin className={`w-3 h-3 shrink-0 ${hasGPS ? 'text-emerald-400' : 'text-amber-400'}`} />
                    <span className="truncate font-mono">
                      {hasGPS
                        ? `${meta.latitude.toFixed(4)}, ${meta.longitude.toFixed(4)} (±${meta.accuracy_meters}m)`
                        : 'GPS reported unavailable'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trigger Open Live Camera Button */}
      {(!items.length || canAddPhoto || canAddVideo) && (
        <div className="flex items-center space-x-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setCaptureMode('photo');
              startCamera('photo');
            }}
            className="flex-1 py-3.5 px-4 rounded-2xl border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/50 hover:bg-blue-50 text-blue-700 transition flex items-center justify-center space-x-2 text-xs font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Camera className="w-4 h-4 text-blue-600" />
            <span>Open Live Camera & Capture Evidence</span>
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Full-Screen / Modal Live Camera Capture Interface */}
      {/* ------------------------------------------------------------- */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between text-white bg-slate-950/60">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-400/30 flex items-center justify-center">
                  {captureMode === 'photo' ? <Camera className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                    <span>Live Evidence Camera</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      LIVE
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {captureMode === 'photo' ? 'Capture geo-tagged photograph' : 'Record geo-tagged video'}
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={handleCloseCamera}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Selector Tabs (Top Bar) */}
            <div className="px-5 py-2.5 bg-slate-900 border-b border-slate-800/80 flex items-center justify-between">
              <div className="inline-flex rounded-xl p-1 bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  disabled={isRecording || !canAddPhoto}
                  onClick={() => handleModeSwitch('photo')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition ${
                    captureMode === 'photo'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Photo ({photoCount}/{maxPhotos})</span>
                </button>

                <button
                  type="button"
                  disabled={isRecording || !canAddVideo}
                  onClick={() => handleModeSwitch('video')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition ${
                    captureMode === 'video'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Video ({videoCount}/{maxVideos})</span>
                </button>
              </div>

              {/* Live Device GPS Pill */}
              <div className="flex items-center space-x-1.5 text-[11px]">
                {locationStatus === 'pending' ? (
                  <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 flex items-center space-x-1 font-mono">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                    <span>Acquiring GPS...</span>
                  </span>
                ) : locationStatus === 'acquired' && liveLocation ? (
                  <span
                    className={`px-2.5 py-1 rounded-full border flex items-center space-x-1 font-mono font-medium ${
                      liveLocation.accuracy_meters > accuracyThresholdMeters
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    <MapPin className="w-3 h-3" />
                    <span>
                      {liveLocation.latitude}, {liveLocation.longitude} (±{liveLocation.accuracy_meters}m)
                    </span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30 flex items-center space-x-1 text-[10px]">
                    <AlertTriangle className="w-3 h-3" />
                    <span>GPS unavailable</span>
                  </span>
                )}
              </div>
            </div>

            {/* Camera Viewport & Capture Stage */}
            <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[340px]">
              {/* Hardware Camera Viewport */}
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover max-h-[55vh] ${stagedEvidence ? 'hidden' : 'block'}`}
              />

              {/* Loading Indicator */}
              {isInitializingCamera && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-white space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="text-xs text-slate-300">Initializing device camera stream...</p>
                </div>
              )}

              {/* Camera Error Message */}
              {cameraError && !stagedEvidence && (
                <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center bg-slate-950/95 text-white space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
                    <VideoOff className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-rose-400">Camera Unavailable</h4>
                  <p className="text-xs text-slate-300 max-w-sm">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => startCamera(captureMode)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 transition"
                  >
                    Retry Camera Initialization
                  </button>
                </div>
              )}

              {/* Review Screen for Staged Item */}
              {stagedEvidence && (
                <div className="relative w-full h-full flex items-center justify-center bg-black max-h-[55vh]">
                  {stagedEvidence.metadata.media_type === 'VIDEO' ? (
                    <video
                      src={stagedEvidence.previewUrl}
                      controls
                      autoPlay
                      playsInline
                      className="w-full h-full object-contain max-h-[55vh]"
                    />
                  ) : (
                    <img
                      src={stagedEvidence.previewUrl}
                      alt="Captured evidence preview"
                      className="w-full h-full object-contain max-h-[55vh]"
                    />
                  )}

                  {/* Device GPS overlay banner */}
                  <div className="absolute top-3 left-3 right-3 p-2.5 rounded-xl bg-slate-950/80 backdrop-blur-sm border border-slate-800 text-white text-[11px] flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <MapPin
                        className={`w-3.5 h-3.5 ${
                          stagedEvidence.metadata.latitude ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      />
                      <span>
                        {stagedEvidence.metadata.latitude
                          ? `GPS Reported: ${stagedEvidence.metadata.latitude}, ${stagedEvidence.metadata.longitude} (±${stagedEvidence.metadata.accuracy_meters}m)`
                          : 'GPS location reported unavailable by device'}
                      </span>
                    </div>

                    <span className="font-mono text-[10px] text-slate-400">
                      {new Date(stagedEvidence.metadata.captured_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Video Recording Live Overlay */}
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center space-x-2 px-3 py-1.5 rounded-full bg-rose-600/90 text-white text-xs font-bold shadow-lg animate-pulse">
                  <Circle className="w-3 h-3 fill-white" />
                  <span>REC {recordingSeconds}s / {maxVideoDurationSeconds}s</span>
                </div>
              )}
            </div>

            {/* Bottom Controls Bar */}
            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-white">
              {stagedEvidence ? (
                // Review Controls
                <div className="w-full flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleRetakeStaged}
                    className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-2 transition"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Retake</span>
                  </button>

                  <div className="text-center text-xs text-slate-400">
                    Review captured {stagedEvidence.metadata.media_type === 'VIDEO' ? 'video clip' : 'photograph'}
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmStaged}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-2 shadow-sm transition"
                  >
                    <Check className="w-4 h-4" />
                    <span>Keep & Attach</span>
                  </button>
                </div>
              ) : (
                // Live Capture Controls
                <div className="w-full flex items-center justify-between">
                  <div className="text-xs text-slate-400 font-medium">
                    {locationError && (
                      <span className="text-amber-400 flex items-center space-x-1 text-[11px]">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        <span>Location evidence will be unattached</span>
                      </span>
                    )}
                  </div>

                  {/* Big Center Shutter Button */}
                  <div className="flex items-center justify-center">
                    {captureMode === 'photo' ? (
                      <button
                        type="button"
                        onClick={capturePhoto}
                        disabled={!stream || !!cameraError || isInitializingCamera}
                        className="w-16 h-16 rounded-full border-4 border-white bg-blue-600 hover:bg-blue-500 active:scale-95 transition flex items-center justify-center text-white shadow-xl disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Capture Live Photo"
                      >
                        <Camera className="w-7 h-7" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={isRecording ? stopVideoRecording : startVideoRecording}
                        disabled={!stream || !!cameraError || isInitializingCamera}
                        className={`w-16 h-16 rounded-full border-4 border-white transition flex items-center justify-center text-white shadow-xl active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                          isRecording ? 'bg-rose-600 hover:bg-rose-700' : 'bg-rose-600 hover:bg-rose-500'
                        }`}
                        title={isRecording ? 'Stop Recording' : 'Start Recording'}
                      >
                        {isRecording ? <Square className="w-6 h-6 fill-white" /> : <Circle className="w-7 h-7 fill-white" />}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleCloseCamera}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Full Evidence Inspection Modal */}
      {/* ------------------------------------------------------------- */}
      {inspectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl flex flex-col">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between text-white">
              <span className="text-xs font-bold uppercase tracking-wider">
                Evidence Details ({inspectItem.metadata?.media_type || 'MEDIA'})
              </span>
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-black flex items-center justify-center max-h-[60vh]">
              {inspectItem.metadata?.media_type === 'VIDEO' ? (
                <video src={inspectItem.previewUrl} controls autoPlay className="max-h-[55vh] object-contain" />
              ) : (
                <img src={inspectItem.previewUrl} alt="Inspection view" className="max-h-[55vh] object-contain" />
              )}
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-2 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Device Captured At:</span>
                <span className="font-mono text-slate-200">{inspectItem.metadata?.captured_at || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Device Reported GPS:</span>
                <span className="font-mono text-slate-200">
                  {inspectItem.metadata?.latitude
                    ? `${inspectItem.metadata.latitude}, ${inspectItem.metadata.longitude} (±${inspectItem.metadata.accuracy_meters}m)`
                    : 'Not reported'}
                </span>
              </div>
              {inspectItem.metadata?.media_type === 'VIDEO' && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Duration:</span>
                  <span className="font-mono text-slate-200">{inspectItem.metadata?.duration_seconds || 0} seconds</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
