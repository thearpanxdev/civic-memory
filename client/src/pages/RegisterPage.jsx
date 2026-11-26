import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import SearchableSelect from '../components/common/SearchableSelect.jsx';
import {
  INDIAN_STATES_AND_UTS,
  DISTRICTS_BY_STATE,
  REPRESENTATIVE_ULBS,
  getDistrictsForState,
  getUlbsForDistrict,
  isValidState,
  isValidDistrictForState,
  isKnownUlb,
} from '../utils/indiaGeoData.js';
import {
  Building2,
  User,
  Mail,
  Lock,
  Phone,
  MapPin,
  Home,
  Navigation,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  RotateCcw,
  Check,
  Compass,
  Loader2,
  Sparkles,
  Bot,
  Info,
} from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, verifyRegistrationOtp, resendRegistrationOtp } = useAuth();

  const [step, setStep] = useState('form'); // 'form' | 'otp' | 'success'

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    ulb: 'Bruhat Bengaluru Mahanagara Palike (BBMP) (Municipal Corporation)',
    locality: '',
    street: '',
    pin_code: '',
    house_number: '',
    landmark: '',
  });

  // Track whether the user has manually interacted with State/District dropdowns
  const [hasUserManuallySelectedState, setHasUserManuallySelectedState] = useState(false);

  // OTP State
  const [registrationId, setRegistrationId] = useState('');
  const [emailMasked, setEmailMasked] = useState('');
  const [phoneMasked, setPhoneMasked] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [mobileOtp, setMobileOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [mobileVerified, setMobileVerified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Address selection & postal lookup state
  const [pinLookupLoading, setPinLookupLoading] = useState(false);
  const [pinLookupError, setPinLookupError] = useState('');
  const [pinLookupNotice, setPinLookupNotice] = useState('');
  const [pinLookupData, setPinLookupData] = useState(null);
  const [pinMismatch, setPinMismatch] = useState(null);
  const [keptMismatchForPin, setKeptMismatchForPin] = useState(null);
  const [pinAutofilled, setPinAutofilled] = useState(false);
  const [conflictingNotice, setConflictingNotice] = useState(null);

  // Locality suggestions & AI locality assessment state
  const [localitySuggestions, setLocalitySuggestions] = useState([]);
  const [isManualLocality, setIsManualLocality] = useState(false);
  const [localityAiLoading, setLocalityAiLoading] = useState(false);
  const [localityAiResult, setLocalityAiResult] = useState(null);
  const [localityVerificationLevel, setLocalityVerificationLevel] = useState('manual_unverified');

  const pinLookupReqIdRef = useRef(0);
  const pinAbortRef = useRef(null);

  // Available districts for selected State
  const availableDistricts = useMemo(() => {
    return formData.state ? getDistrictsForState(formData.state) : [];
  }, [formData.state]);

  // Combined ULB options: known district ULBs with administrative category + suggested ULBs from PIN lookup
  const combinedUlbs = useMemo(() => {
    const list = [];
    if (formData.state && formData.district) {
      list.push(...getUlbsForDistrict(formData.state, formData.district));
    }
    if (pinLookupData?.suggestedUlbs && !keptMismatchForPin) {
      for (const u of pinLookupData.suggestedUlbs) {
        if (!list.includes(u)) {
          list.push(u);
        }
      }
    }
    if (formData.ulb && !list.includes(formData.ulb)) {
      list.push(formData.ulb);
    }
    return list;
  }, [formData.state, formData.district, formData.ulb, pinLookupData, keptMismatchForPin]);

  // Is current ULB recognized/verified
  const isCurrentUlbVerified = useMemo(() => {
    if (!formData.state || !formData.district || !formData.ulb) return false;
    return isKnownUlb(formData.state, formData.district, formData.ulb);
  }, [formData.state, formData.district, formData.ulb]);

  // State selection handler: clears dependent fields and registers manual authority
  const handleStateChange = (newState) => {
    setHasUserManuallySelectedState(true);
    setPinAutofilled(false);
    setFormData((prev) => ({
      ...prev,
      state: newState,
      district: '',
      ulb: '',
      locality: '',
    }));
    setFieldErrors((prev) => ({ ...prev, state: undefined, district: undefined, ulb: undefined }));

    // Evaluate mismatch with active PIN if present
    if (pinLookupData && pinLookupData.state && formData.pin_code.length === 6) {
      if (newState && pinLookupData.state.toLowerCase() === newState.toLowerCase()) {
        setPinMismatch(null);
      } else {
        setPinMismatch({
          pin: formData.pin_code,
          lookupState: pinLookupData.state,
          lookupDistrict: pinLookupData.district,
          currentState: newState,
          currentDistrict: '',
        });
      }
    } else {
      setPinMismatch(null);
    }
  };

  // District selection handler: clears dependent ULB and locality
  const handleDistrictChange = (newDistrict) => {
    setHasUserManuallySelectedState(true);
    setPinAutofilled(false);
    setFormData((prev) => ({
      ...prev,
      district: newDistrict,
      ulb: '',
      locality: '',
    }));
    setFieldErrors((prev) => ({ ...prev, district: undefined, ulb: undefined }));

    if (pinLookupData && pinLookupData.district && formData.pin_code.length === 6) {
      const stateMatches =
        !pinLookupData.state ||
        (formData.state && pinLookupData.state.toLowerCase() === formData.state.toLowerCase());
      if (stateMatches && newDistrict && pinLookupData.district.toLowerCase() === newDistrict.toLowerCase()) {
        setPinMismatch(null);
      } else if (pinLookupData.district && newDistrict && pinLookupData.district.toLowerCase() !== newDistrict.toLowerCase()) {
        setPinMismatch({
          pin: formData.pin_code,
          lookupState: pinLookupData.state,
          lookupDistrict: pinLookupData.district,
          currentState: formData.state,
          currentDistrict: newDistrict,
        });
      }
    }
  };

  // Action: Align State & District with PIN Code
  const handleAlignWithPin = () => {
    if (!pinMismatch) return;
    const { lookupState, lookupDistrict } = pinMismatch;
    setFormData((prev) => ({
      ...prev,
      state: lookupState || prev.state,
      district: lookupDistrict || prev.district,
      ulb: '',
      locality: '',
    }));
    setHasUserManuallySelectedState(false);
    setKeptMismatchForPin(null);
    setPinMismatch(null);
    setPinAutofilled(true);
    setIsManualLocality(false);
  };

  // Action: Keep My Selected Details (Preserves user authority; avoids overwrite from current or late lookup)
  const handleKeepSelectedDetails = () => {
    if (!pinMismatch) return;
    setKeptMismatchForPin(pinMismatch.pin);
    setPinMismatch(null);
    setPinAutofilled(false);
    // When mismatched details are preserved, do not present mismatched PIN's post offices as verified localities
    setIsManualLocality(true);
  };

  // PIN input change handler
  const handlePinChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '').slice(0, 6);
    setFormData((prev) => ({ ...prev, pin_code: rawVal }));
    setFieldErrors((prev) => ({ ...prev, pin_code: undefined }));
    if (rawVal.length < 6) {
      if (pinAbortRef.current) {
        pinAbortRef.current.abort();
      }
      pinLookupReqIdRef.current++;
      setPinLookupData(null);
      setPinMismatch(null);
      setKeptMismatchForPin(null);
      setPinLookupError('');
      setPinLookupNotice('');
      setLocalitySuggestions([]);
      setPinAutofilled(false);
      setConflictingNotice(null);
      setLocalityAiResult(null);
    }
  };

  // PIN lookup effect with generation counter and AbortController
  useEffect(() => {
    const pin = formData.pin_code.trim();
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      return;
    }

    const currentReqId = ++pinLookupReqIdRef.current;
    if (pinAbortRef.current) {
      pinAbortRef.current.abort();
    }
    const controller = new AbortController();
    pinAbortRef.current = controller;

    setPinLookupLoading(true);
    setPinLookupError('');
    setPinLookupNotice('');

    fetch(`/api/geo/pincode/${pin}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then(async (res) => {
        const data = await res.json();
        // Strict generation check: discard stale out-of-order responses
        if (pinLookupReqIdRef.current !== currentReqId) return;

        if (data.success) {
          setPinLookupData(data);

          // Populate locality suggestions with all distinct post-office records
          if (Array.isArray(data.postOffices) && data.postOffices.length > 0) {
            setLocalitySuggestions(data.postOffices);
          } else {
            setLocalitySuggestions([]);
          }

          if (data.conflicting) {
            setConflictingNotice(
              `Postal records for this PIN code span multiple regions (${(data.conflictingDistricts || []).join(', ')}). Please select your State and District manually.`
            );
            return;
          } else {
            setConflictingNotice(null);
          }

          // If user previously pinned "Keep My Selected Details" for this PIN, preserve user selection
          if (keptMismatchForPin === pin) {
            return;
          }

          // Evaluate state/district match against user's selections
          const stateMismatch =
            formData.state &&
            data.state &&
            formData.state.toLowerCase() !== data.state.toLowerCase();
          const districtMismatch =
            formData.district &&
            data.district &&
            formData.district.toLowerCase() !== data.district.toLowerCase();

          if (hasUserManuallySelectedState && (stateMismatch || districtMismatch)) {
            setPinMismatch({
              pin,
              lookupState: data.state,
              lookupDistrict: data.district,
              currentState: formData.state,
              currentDistrict: formData.district,
            });
            setPinAutofilled(false);
          } else if (!hasUserManuallySelectedState && data.state && data.district) {
            // Unambiguous PIN-first autofill!
            setFormData((prev) => ({
              ...prev,
              state: data.state,
              district: data.district,
              // Prepopulate representative ULB if district has verified ULBs
              ulb:
                data.suggestedUlbs && data.suggestedUlbs.length > 0
                  ? data.suggestedUlbs[0]
                  : prev.ulb,
            }));
            setPinMismatch(null);
            setPinAutofilled(true);
          }
        } else {
          setPinLookupError(data.error || 'Postal details not found for this PIN code');
          setLocalitySuggestions([]);
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        if (pinLookupReqIdRef.current !== currentReqId) return;
        setPinLookupError('Postal lookup service is currently unavailable. Manual entry is enabled.');
        setLocalitySuggestions([]);
      })
      .finally(() => {
        if (pinLookupReqIdRef.current === currentReqId) {
          setPinLookupLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [formData.pin_code]);

  // Optional AI Locality Check handler
  const handleCheckLocality = async () => {
    if (!formData.locality || !formData.locality.trim()) {
      setLocalityAiResult({
        status: 'insufficient_information',
        message: 'Please enter a locality name first.',
      });
      return;
    }
    if (!formData.state || !formData.district) {
      setLocalityAiResult({
        status: 'insufficient_information',
        message: 'Please select State and District first.',
      });
      return;
    }

    setLocalityAiLoading(true);
    setLocalityAiResult(null);

    try {
      const res = await fetch('/api/geo/check-locality', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          locality: formData.locality.trim(),
          state: formData.state,
          district: formData.district,
          pin_code: formData.pin_code.trim(),
        }),
      });

      const data = await res.json();
      if (data.success && data.assessment) {
        setLocalityAiResult(data.assessment);
        if (data.verification_level) {
          setLocalityVerificationLevel(data.verification_level);
        }
      } else {
        setLocalityAiResult({
          status: 'insufficient_information',
          message: data.error || 'Locality check could not be completed.',
        });
      }
    } catch (err) {
      setLocalityAiResult({
        status: 'insufficient_information',
        message: 'Locality check service is temporarily unavailable. Manual entry is accepted.',
      });
    } finally {
      setLocalityAiLoading(false);
    }
  };

  // Password validation checks
  const hasMinLength = formData.password.length >= 8;
  const hasUpper = /[A-Z]/.test(formData.password);
  const hasLower = /[a-z]/.test(formData.password);
  const hasNumber = /[0-9]/.test(formData.password);
  const hasSpecial = /[^A-Za-z0-9]/.test(formData.password);
  const passwordsMatch = formData.password && formData.password === formData.confirm_password;
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;

  // Resend cooldown timer
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleInitialSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});

    if (!isPasswordValid) {
      setFormError('Please satisfy all password security requirements.');
      return;
    }

    if (!passwordsMatch) {
      setFormError('Passwords do not match.');
      return;
    }

    // Validate State selection
    if (!isValidState(formData.state)) {
      setFormError('Please select a valid Indian State or Union Territory.');
      setFieldErrors({ state: ['Please select a valid Indian State or Union Territory'] });
      return;
    }

    // Validate District belongs to State
    if (!isValidDistrictForState(formData.state, formData.district)) {
      setFormError('Selected District does not belong to the selected State.');
      setFieldErrors({ district: ['Selected District does not belong to the selected State'] });
      return;
    }

    // Validate ULB
    if (!formData.ulb || !formData.ulb.trim()) {
      setFormError('Please select or enter your Municipality / ULB.');
      setFieldErrors({ ulb: ['Municipality / ULB is required'] });
      return;
    }

    // Validate Locality
    if (!formData.locality || !formData.locality.trim()) {
      setFormError('Please enter your Locality / Area.');
      setFieldErrors({ locality: ['Locality / Area is required'] });
      return;
    }

    // Validate Street
    if (!formData.street || !formData.street.trim()) {
      setFormError('Please enter your Street / Road.');
      setFieldErrors({ street: ['Street / Road is required'] });
      return;
    }

    // Validate phone number format (10-digit Indian mobile)
    const cleanPhone = formData.phone.replace(/[\s\-]/g, '');
    if (!/^(\+91)?[6-9]\d{9}$/.test(cleanPhone)) {
      setFormError('Please enter a valid 10-digit Indian mobile number.');
      setFieldErrors({ phone: ['Must be a valid 10-digit mobile number'] });
      return;
    }

    // Validate 6-digit PIN code
    if (!/^\d{6}$/.test(formData.pin_code.trim())) {
      setFormError('Please enter a valid 6-digit PIN code.');
      setFieldErrors({ pin_code: ['PIN code must be exactly 6 digits'] });
      return;
    }

    setSubmitting(true);
    const result = await register({
      full_name: formData.full_name,
      email: formData.email,
      phone: cleanPhone,
      password: formData.password,
      confirm_password: formData.confirm_password,
      state: formData.state,
      district: formData.district,
      ulb: formData.ulb,
      locality: formData.locality,
      street: formData.street,
      pin_code: formData.pin_code,
      house_number: formData.house_number,
      landmark: formData.landmark,
      locality_verification_level: localityVerificationLevel,
      ulb_verification_status: isCurrentUlbVerified ? 'VERIFIED' : 'CUSTOM',
    });
    setSubmitting(false);

    if (result.success && result.pendingVerification) {
      setRegistrationId(result.registration_id);
      setEmailMasked(result.email_masked);
      setPhoneMasked(result.phone_masked);
      setResendCooldown(result.resend_cooldown_seconds || 60);
      setStep('otp');
    } else if (result.success && result.user) {
      navigate('/citizen', { replace: true });
    } else {
      setFormError(result.error || 'Registration failed. Please check the entered details.');
    }
  };

  const handleOtpVerify = async (e) => {
    e.preventDefault();
    setFormError('');

    if (emailOtp.length !== 6 || mobileOtp.length !== 6) {
      setFormError('Please enter 6-digit verification codes for both Email and Mobile.');
      return;
    }

    setSubmitting(true);
    const result = await verifyRegistrationOtp({
      registration_id: registrationId,
      email_otp: emailOtp,
      mobile_otp: mobileOtp,
    });
    setSubmitting(false);

    if (result.success) {
      setStep('success');
    } else {
      if (result.email_verified) setEmailVerified(true);
      if (result.mobile_verified) setMobileVerified(true);
      setFormError(result.error || 'Verification failed. Please verify your codes.');
    }
  };

  const handleResendOtp = async (type = 'both') => {
    if (resendCooldown > 0) return;
    setFormError('');

    const result = await resendRegistrationOtp({
      registration_id: registrationId,
      type,
    });

    if (result.success) {
      setResendCooldown(result.resend_cooldown_seconds || 60);
    } else {
      setFormError(result.error || 'Failed to resend verification codes.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-civic-50/60 via-white to-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <Link to="/" className="flex items-center justify-center space-x-2.5">
          <div className="w-11 h-11 rounded-xl bg-civic-600 flex items-center justify-center text-white shadow-md shadow-civic-600/20">
            <Building2 className="w-6 h-6" />
          </div>
          <span className="text-2xl font-black text-slate-900 tracking-tight">
            Civic<span className="text-civic-600">Memory</span>
          </span>
        </Link>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          Create Citizen Account
        </h2>
        <p className="mt-1 text-center text-sm text-slate-600">
          Register with your residential address & dual OTP verification
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-start space-x-2">
            <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              Public registration creates verified <strong>Citizen</strong> accounts. Accounts are verified using independent Email and Mobile OTPs before activation.
            </span>
          </div>

          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-2.5">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* STEP 1: Registration Form */}
          {step === 'form' && (
            <form className="space-y-5" onSubmit={handleInitialSubmit}>
              {/* SECTION A: Identity & Contact Details */}
              <div className="border-b border-slate-200 pb-5 space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  1. Citizen Identity & Contact Details
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="Arjun Sharma"
                      className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-civic-500 focus:border-civic-500 text-slate-900 placeholder:text-slate-400 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative rounded-lg shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="arjun@example.com"
                        className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-civic-500 focus:border-civic-500 text-slate-900 placeholder:text-slate-400 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Mobile Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative rounded-lg shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="9876543210"
                        className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-civic-500 focus:border-civic-500 text-slate-900 placeholder:text-slate-400 transition"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION B: Residential Address & Location Details (PIN-First Workflow) */}
              <div className="border-b border-slate-200 pb-5 space-y-4">
                <div className="flex items-center space-x-2">
                  <Compass className="w-4 h-4 text-civic-600" />
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    2. Residential Address & Location Details
                  </h3>
                </div>

                {/* 1. PIN-FIRST INPUT */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="registration-pin"
                      className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
                    >
                      PIN Code <span className="text-rose-500">*</span>
                    </label>
                    {pinAutofilled && (
                      <span className="text-[11px] font-semibold text-emerald-700 flex items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                        Region auto-filled from PIN lookup
                      </span>
                    )}
                  </div>
                  <div className="relative rounded-lg shadow-sm">
                    <input
                      type="text"
                      id="registration-pin"
                      required
                      maxLength={6}
                      value={formData.pin_code}
                      onChange={handlePinChange}
                      placeholder="e.g. 560038"
                      className={`block w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-civic-500 focus:border-civic-500 text-slate-900 transition ${
                        fieldErrors.pin_code ? 'border-rose-400' : 'border-slate-300'
                      }`}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      {pinLookupLoading && (
                        <Loader2 className="w-4 h-4 text-civic-600 animate-spin" />
                      )}
                      {!pinLookupLoading &&
                        formData.pin_code.length === 6 &&
                        !pinMismatch &&
                        !pinLookupError && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        )}
                    </div>
                  </div>
                  {fieldErrors.pin_code && (
                    <p className="mt-1 text-xs text-rose-600">{fieldErrors.pin_code[0]}</p>
                  )}
                </div>

                {/* Conflicting Postal Records Warning Banner */}
                {conflictingNotice && (
                  <div
                    role="alert"
                    className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs flex items-start space-x-2"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                      <span>{conflictingNotice}</span>
                      {pinLookupData?.conflictingDistricts && pinLookupData.conflictingDistricts.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="font-semibold text-slate-700">Choose District:</span>
                          {pinLookupData.conflictingDistricts.map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => {
                                handleDistrictChange(d);
                                setPinAutofilled(true);
                              }}
                              className="px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-medium text-xs transition"
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* PIN Mismatch Warning Banner */}
                {pinMismatch && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className="p-3.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs space-y-2 animate-in fade-in"
                  >
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="font-bold">Postal Code Mismatch Notice:</span>{' '}
                        PIN code <span className="font-semibold">{pinMismatch.pin}</span> is registered under{' '}
                        <span className="font-semibold">
                          {pinMismatch.lookupDistrict ? `${pinMismatch.lookupDistrict}, ` : ''}
                          {pinMismatch.lookupState}
                        </span>
                        , which differs from your selected{' '}
                        <span className="font-semibold">
                          {pinMismatch.currentDistrict ? `${pinMismatch.currentDistrict}, ` : ''}
                          {pinMismatch.currentState}
                        </span>
                        . Please review your address details.
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 pt-1">
                      <button
                        type="button"
                        onClick={handleAlignWithPin}
                        className="px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm transition"
                      >
                        Align State & District with PIN Code
                      </button>
                      <button
                        type="button"
                        onClick={handleKeepSelectedDetails}
                        className="text-amber-800 hover:text-amber-950 underline font-medium text-xs"
                      >
                        Keep My Selected Details
                      </button>
                    </div>
                  </div>
                )}

                {/* Postal Lookup Error / Resilience Notice (never blocks user) */}
                {pinLookupError && (
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs flex items-center justify-between">
                    <span>{pinLookupError}</span>
                    <span className="text-[11px] font-semibold text-civic-700">Manual entry unblocked</span>
                  </div>
                )}
                {pinLookupNotice && !pinLookupError && (
                  <p className="text-[11px] text-slate-500 italic">{pinLookupNotice}</p>
                )}

                {/* 2. STATE & DISTRICT ROW */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <SearchableSelect
                      id="registration-state"
                      label="State / Union Territory"
                      required
                      options={INDIAN_STATES_AND_UTS}
                      value={formData.state}
                      onChange={handleStateChange}
                      placeholder="Select State / UT"
                      error={fieldErrors.state?.[0]}
                    />
                  </div>

                  <div>
                    <SearchableSelect
                      id="registration-district"
                      label="District"
                      required
                      options={availableDistricts}
                      value={formData.district}
                      onChange={handleDistrictChange}
                      placeholder={formData.state ? 'Select District' : 'Select State first'}
                      disabled={!formData.state}
                      error={fieldErrors.district?.[0]}
                      helperText={!formData.state ? 'Select a state to view available districts' : ''}
                    />
                  </div>
                </div>

                {/* 3. MUNICIPALITY / ULB & LOCALITY ROW */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Region-based Municipality / ULB Dropdown */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Municipality / ULB <span className="text-rose-500">*</span>
                      </label>
                      {isCurrentUlbVerified ? (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          Verified ULB
                        </span>
                      ) : formData.ulb ? (
                        <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          Custom Entry
                        </span>
                      ) : null}
                    </div>
                    <SearchableSelect
                      id="registration-ulb"
                      label=""
                      ariaLabel="Municipality / ULB"
                      required
                      options={combinedUlbs}
                      value={formData.ulb}
                      onChange={(val) => {
                        setFormData((prev) => ({ ...prev, ulb: val }));
                        setFieldErrors((prev) => ({ ...prev, ulb: undefined }));
                      }}
                      placeholder="Select or enter Municipality / ULB"
                      allowCustom={true}
                      customPlaceholder="Enter Municipality / ULB name..."
                      error={fieldErrors.ulb?.[0]}
                      helperText="Municipal Corporation, Council, or Nagar Panchayat"
                    />
                  </div>

                  {/* Locality Dropdown with PIN-specific mapping & Manual / AI Check Mode */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="registration-locality"
                        className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
                      >
                        Locality / Area <span className="text-rose-500">*</span>
                      </label>
                      {localitySuggestions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsManualLocality(!isManualLocality);
                            setLocalityAiResult(null);
                          }}
                          className="text-[11px] font-medium text-civic-600 hover:text-civic-800 underline"
                        >
                          {isManualLocality ? 'Use postal suggestions' : 'Enter manually'}
                        </button>
                      )}
                    </div>

                    {isManualLocality || localitySuggestions.length === 0 ? (
                      /* Manual Locality Entry Mode */
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            id="registration-locality"
                            required
                            value={formData.locality}
                            onChange={(e) => {
                              setFormData({ ...formData, locality: e.target.value });
                              setFieldErrors((prev) => ({ ...prev, locality: undefined }));
                              setLocalityVerificationLevel('manual_unverified');
                              setLocalityAiResult(null);
                            }}
                            placeholder="e.g. Defence Colony, Sector 4"
                            className={`block w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-civic-500 focus:border-civic-500 text-slate-900 transition ${
                              fieldErrors.locality ? 'border-rose-400' : 'border-slate-300'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={handleCheckLocality}
                            disabled={localityAiLoading || !formData.locality.trim()}
                            title="Check locality plausibility with AI assistant"
                            className="shrink-0 px-2.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg flex items-center space-x-1 disabled:opacity-50 transition"
                          >
                            {localityAiLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-civic-600" />
                            ) : (
                              <Bot className="w-3.5 h-3.5 text-civic-600" />
                            )}
                            <span className="hidden sm:inline">Check Locality</span>
                          </button>
                        </div>

                        {/* AI Locality Advisory Result Card */}
                        {localityAiResult && (
                          <div
                            role="status"
                            className={`p-2.5 rounded-lg border text-xs space-y-1 animate-in fade-in ${
                              localityAiResult.status === 'plausible'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                : localityAiResult.status === 'possible_mismatch'
                                ? 'bg-amber-50 border-amber-200 text-amber-900'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <div className="flex items-start space-x-1.5">
                              {localityAiResult.status === 'plausible' ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              ) : localityAiResult.status === 'possible_mismatch' ? (
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              ) : (
                                <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1">
                                <span className="font-semibold capitalize">
                                  {localityAiResult.status.replace('_', ' ')}:
                                </span>{' '}
                                {localityAiResult.message}
                              </div>
                            </div>
                            {localityAiResult.suggested_correction && (
                              <div className="pt-1 flex items-center space-x-2">
                                <span className="text-[11px] text-slate-500">Suggested spelling:</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormData((prev) => ({
                                      ...prev,
                                      locality: localityAiResult.suggested_correction,
                                    }));
                                  }}
                                  className="text-xs font-semibold text-civic-700 underline hover:text-civic-900"
                                >
                                  Apply "{localityAiResult.suggested_correction}"
                                </button>
                              </div>
                            )}
                            <p className="text-[10px] text-slate-400 italic">
                              Advisory suggestion only. You may proceed with your entered locality.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Postal Suggestions Dropdown Mode */
                      <div>
                        <SearchableSelect
                          id="registration-locality"
                          label=""
                          ariaLabel="Select locality from postal records"
                          required
                          options={localitySuggestions}
                          value={formData.locality}
                          onChange={(val) => {
                            setFormData((prev) => ({ ...prev, locality: val }));
                            setFieldErrors((prev) => ({ ...prev, locality: undefined }));
                            setLocalityVerificationLevel('postal_matched');
                          }}
                          placeholder="Select locality from postal records"
                          allowCustom={true}
                          customPlaceholder="Enter custom locality..."
                          error={fieldErrors.locality?.[0]}
                          helperText="Post office / locality records for this PIN"
                        />
                      </div>
                    )}
                    {fieldErrors.locality && (
                      <p className="mt-1 text-xs text-rose-600">{fieldErrors.locality[0]}</p>
                    )}
                  </div>
                </div>

                {/* 4. STREET ROW */}
                <div>
                  <label
                    htmlFor="registration-street"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
                  >
                    Street / Road <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      id="registration-street"
                      required
                      value={formData.street}
                      onChange={(e) => {
                        setFormData({ ...formData, street: e.target.value });
                        setFieldErrors((prev) => ({ ...prev, street: undefined }));
                      }}
                      placeholder="100 Feet Road, 12th Main"
                      className={`block w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-civic-500 focus:border-civic-500 text-slate-900 transition ${
                        fieldErrors.street ? 'border-rose-400' : 'border-slate-300'
                      }`}
                    />
                  </div>
                  {fieldErrors.street && (
                    <p className="mt-1 text-xs text-rose-600">{fieldErrors.street[0]}</p>
                  )}
                </div>

                {/* 5. HOUSE NUMBER & LANDMARK ROW */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="registration-house"
                      className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
                    >
                      House / Flat Number <span className="text-slate-400 text-[10px] font-normal">(Optional)</span>
                    </label>
                    <div className="relative rounded-lg shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Home className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        id="registration-house"
                        value={formData.house_number}
                        onChange={(e) => setFormData({ ...formData, house_number: e.target.value })}
                        placeholder="Flat 4B, Silver Oak"
                        className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-civic-500 focus:border-civic-500 text-slate-900 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="registration-landmark"
                      className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
                    >
                      Landmark <span className="text-slate-400 text-[10px] font-normal">(Optional)</span>
                    </label>
                    <div className="relative rounded-lg shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Navigation className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        id="registration-landmark"
                        value={formData.landmark}
                        onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                        placeholder="Near Metro Station"
                        className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-civic-500 focus:border-civic-500 text-slate-900 transition"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION C: Account Security */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  3. Account Security Password
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••••••"
                      className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-civic-500 focus:border-civic-500 text-slate-900 transition"
                    />
                  </div>

                  {/* Password Requirements Checklist */}
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1 text-[11px] text-slate-500">
                    <span className={hasMinLength ? 'text-emerald-600 font-medium' : ''}>
                      • 8+ characters
                    </span>
                    <span className={hasUpper ? 'text-emerald-600 font-medium' : ''}>
                      • 1 uppercase letter
                    </span>
                    <span className={hasLower ? 'text-emerald-600 font-medium' : ''}>
                      • 1 lowercase letter
                    </span>
                    <span className={hasNumber ? 'text-emerald-600 font-medium' : ''}>
                      • 1 number
                    </span>
                    <span className={hasSpecial ? 'text-emerald-600 font-medium' : ''}>
                      • 1 special char
                    </span>
                    <span className={passwordsMatch ? 'text-emerald-600 font-medium' : ''}>
                      • Passwords match
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Confirm Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      required
                      value={formData.confirm_password}
                      onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                      placeholder="••••••••••••"
                      className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-civic-500 focus:border-civic-500 text-slate-900 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-civic-600 hover:bg-civic-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-civic-500 disabled:opacity-50 transition"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending Verification Codes...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue to Verification</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center text-xs text-slate-600">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-civic-600 hover:text-civic-700">
                  Sign in
                </Link>
              </div>
            </form>
          )}

          {/* STEP 2: Dual OTP Verification */}
          {step === 'otp' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="text-center space-y-1">
                <h3 className="text-lg font-bold text-slate-900">Verify Your Contact Information</h3>
                <p className="text-xs text-slate-600">
                  We have dispatched dual verification codes to verify your email and mobile phone.
                </p>
              </div>

              <form onSubmit={handleOtpVerify} className="space-y-5">
                {/* Email OTP Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Email Verification Code
                    </label>
                    <span className="text-xs text-slate-500 font-mono">{emailMasked}</span>
                  </div>
                  <div className="relative rounded-lg shadow-sm">
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={emailOtp}
                      onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit Email OTP"
                      className="block w-full px-3 py-2 text-center text-lg tracking-widest font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-civic-500 focus:border-civic-500 text-slate-900"
                    />
                    {emailVerified && (
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <Check className="w-5 h-5 text-emerald-500" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Mobile OTP Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Mobile Verification Code
                    </label>
                    <span className="text-xs text-slate-500 font-mono">{phoneMasked}</span>
                  </div>
                  <div className="relative rounded-lg shadow-sm">
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={mobileOtp}
                      onChange={(e) => setMobileOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit Mobile OTP"
                      className="block w-full px-3 py-2 text-center text-lg tracking-widest font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-civic-500 focus:border-civic-500 text-slate-900"
                    />
                    {mobileVerified && (
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <Check className="w-5 h-5 text-emerald-500" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600">
                  <button
                    type="button"
                    onClick={() => handleResendOtp('both')}
                    disabled={resendCooldown > 0}
                    className="flex items-center space-x-1 font-semibold text-civic-600 hover:text-civic-700 disabled:text-slate-400 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>
                      {resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : 'Resend Codes'}
                    </span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-civic-600 hover:bg-civic-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-civic-500 disabled:opacity-50 transition"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify & Activate Account</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* STEP 3: Activation Success */}
          {step === 'success' && (
            <div className="text-center py-6 space-y-4 animate-in fade-in">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Registration Complete!</h3>
              <p className="text-sm text-slate-600 max-w-sm mx-auto">
                Your contact details and residential address have been successfully registered. You may now sign in to report civic issues.
              </p>
              <div className="pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center space-x-2 py-2.5 px-6 rounded-lg text-sm font-semibold text-white bg-civic-600 hover:bg-civic-700 transition"
                >
                  <span>Sign In to CivicMemory</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
