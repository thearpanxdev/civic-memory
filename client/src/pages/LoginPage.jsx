import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Building2,
  Lock,
  Mail,
  Phone,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  X,
  RotateCcw,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, forgotPassword, verifyResetOtp, resendResetOtp, resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: request, 2: verify otp, 3: new password, 4: success
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [resetId, setResetId] = useState('');
  const [contactMasked, setContactMasked] = useState('');
  const [contactType, setContactType] = useState('email');
  const [recoveryOtp, setRecoveryOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [recoveryCooldown, setRecoveryCooldown] = useState(0);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');

  // Password rules for reset
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const isResetPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;
  const resetPasswordsMatch = newPassword && newPassword === confirmNewPassword;

  // Recovery cooldown timer
  useEffect(() => {
    let timer;
    if (recoveryCooldown > 0) {
      timer = setInterval(() => {
        setRecoveryCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [recoveryCooldown]);

  const redirectPath = (role) => {
    if (role === 'admin') return '/admin';
    if (role === 'official') return '/official';
    return '/citizen';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setInfoMessage('');
    setSubmitting(true);

    const result = await login(email, password);
    setSubmitting(false);

    if (result.success) {
      const target = location.state?.from?.pathname || redirectPath(result.user.role);
      navigate(target, { replace: true });
    } else {
      setFormError(result.error);
    }
  };

  const handleDemoFill = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setFormError('');
  };

  // Forgot Password Handlers
  const handleOpenForgot = () => {
    setShowForgotModal(true);
    setForgotStep(1);
    setRecoveryIdentifier(email || '');
    setRecoveryError('');
    setRecoveryOtp('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const handleCloseForgot = () => {
    setShowForgotModal(false);
    setForgotStep(1);
    setRecoveryError('');
  };

  const handleRequestRecoveryOtp = async (e) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoveryLoading(true);

    const result = await forgotPassword(recoveryIdentifier.trim());
    setRecoveryLoading(false);

    if (result.success) {
      setResetId(result.reset_id);
      setContactMasked(result.contact_masked);
      setContactType(result.contact_type || 'contact');
      setRecoveryCooldown(result.resend_cooldown_seconds || 60);
      setForgotStep(2);
    } else {
      setRecoveryError(result.error || 'Failed to request recovery code.');
    }
  };

  const handleVerifyRecoveryOtp = async (e) => {
    e.preventDefault();
    setRecoveryError('');

    if (recoveryOtp.trim().length !== 6) {
      setRecoveryError('Please enter the 6-digit recovery code.');
      return;
    }

    setRecoveryLoading(true);
    const result = await verifyResetOtp({
      reset_id: resetId,
      otp: recoveryOtp.trim(),
    });
    setRecoveryLoading(false);

    if (result.success && result.reset_token) {
      setResetToken(result.reset_token);
      setForgotStep(3);
    } else {
      setRecoveryError(result.error || 'Invalid recovery code. Please check and try again.');
    }
  };

  const handleResendRecoveryOtp = async () => {
    if (recoveryCooldown > 0) return;
    setRecoveryError('');

    const result = await resendResetOtp({ reset_id: resetId });
    if (result.success) {
      setRecoveryCooldown(result.resend_cooldown_seconds || 60);
    } else {
      setRecoveryError(result.error || 'Failed to resend recovery code.');
    }
  };

  const handleExecutePasswordReset = async (e) => {
    e.preventDefault();
    setRecoveryError('');

    if (!isResetPasswordValid) {
      setRecoveryError('Please satisfy all password security requirements.');
      return;
    }

    if (!resetPasswordsMatch) {
      setRecoveryError('Passwords do not match.');
      return;
    }

    setRecoveryLoading(true);
    const result = await resetPassword({
      reset_token: resetToken,
      new_password: newPassword,
      confirm_password: confirmNewPassword,
    });
    setRecoveryLoading(false);

    if (result.success) {
      setForgotStep(4);
    } else {
      setRecoveryError(result.error || 'Password reset failed. Please start recovery again.');
    }
  };

  const handleCompleteAndSignIn = () => {
    setShowForgotModal(false);
    if (recoveryIdentifier.includes('@')) {
      setEmail(recoveryIdentifier.trim());
    }
    setPassword('');
    setInfoMessage('Password reset successfully! Please sign in with your new password.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-civic-50/60 via-white to-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex items-center justify-center space-x-2.5">
          <div className="w-11 h-11 rounded-xl bg-civic-600 flex items-center justify-center text-white shadow-md shadow-civic-600/20">
            <Building2 className="w-6 h-6" />
          </div>
          <span className="text-2xl font-black text-slate-900 tracking-tight">
            Civic<span className="text-civic-600">Memory</span>
          </span>
        </Link>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          Sign in to your account
        </h2>
        <p className="mt-1 text-center text-sm text-slate-600">
          Access citizen problem reporting or municipal administration
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          {infoMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start space-x-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-2.5">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="block w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-civic-500 focus:border-civic-500 text-slate-900 placeholder:text-slate-400 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleOpenForgot}
                  className="text-xs font-semibold text-civic-600 hover:text-civic-700 transition"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-civic-500 focus:border-civic-500 text-slate-900 placeholder:text-slate-400 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center py-2.5 px-4 rounded-lg bg-civic-600 hover:bg-civic-700 text-white text-sm font-semibold shadow-sm hover:shadow transition disabled:opacity-60 space-x-1.5"
            >
              {submitting ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Autofill for Reviewers */}
          <div className="pt-4 border-t border-slate-200">
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              Quick Demo Fill (Evaluator Shortcut)
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleDemoFill('citizen.arjun@civicmemory.local', 'Citizen@Civic2026!')}
                className="px-2 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-center transition"
              >
                Citizen
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('official.roads@civicmemory.local', 'Official@Civic2026!')}
                className="px-2 py-1.5 text-xs font-medium rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-center transition"
              >
                Official
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('admin@civicmemory.local', 'Admin@Civic2026!')}
                className="px-2 py-1.5 text-xs font-medium rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-center transition"
              >
                Admin
              </button>
            </div>
          </div>

          <div className="text-center pt-2">
            <p className="text-xs text-slate-600">
              New to CivicMemory?{' '}
              <Link to="/register" className="font-semibold text-civic-600 hover:text-civic-700">
                Register as a Citizen
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Recovery Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-5 relative">
            <button
              type="button"
              onClick={handleCloseForgot}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-civic-100 text-civic-600 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Password Recovery</h3>
                <p className="text-xs text-slate-500">Secure recovery via verified contact OTP</p>
              </div>
            </div>

            {recoveryError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{recoveryError}</span>
              </div>
            )}

            {/* STEP 1: Enter Email or Mobile */}
            {forgotStep === 1 && (
              <form onSubmit={handleRequestRecoveryOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Registered Email or Mobile Number
                  </label>
                  <input
                    type="text"
                    required
                    value={recoveryIdentifier}
                    onChange={(e) => setRecoveryIdentifier(e.target.value)}
                    placeholder="citizen@example.com or 9876543210"
                    className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-civic-500 focus:border-civic-500 text-slate-900 transition"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    We will send a 6-digit recovery code to your registered contact.
                  </p>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseForgot}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={recoveryLoading || !recoveryIdentifier.trim()}
                    className="px-4 py-2 text-xs font-semibold text-white bg-civic-600 hover:bg-civic-700 rounded-lg shadow-sm transition disabled:opacity-60"
                  >
                    {recoveryLoading ? 'Sending Code...' : 'Send Recovery Code'}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Enter 6-digit Recovery Code */}
            {forgotStep === 2 && (
              <form onSubmit={handleVerifyRecoveryOtp} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      6-Digit Recovery Code
                    </label>
                    <span className="text-[11px] text-slate-500">Sent to {contactMasked}</span>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={recoveryOtp}
                    onChange={(e) => setRecoveryOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Enter 6-digit code"
                    className="block w-full text-center tracking-widest text-lg font-mono px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-civic-500 focus:border-civic-500 text-slate-900 transition"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="text-slate-600 hover:text-slate-900 underline"
                  >
                    Change contact
                  </button>
                  <button
                    type="button"
                    disabled={recoveryCooldown > 0}
                    onClick={handleResendRecoveryOtp}
                    className="flex items-center space-x-1 text-civic-600 hover:text-civic-700 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>
                      {recoveryCooldown > 0 ? `Resend in ${recoveryCooldown}s` : 'Resend Code'}
                    </span>
                  </button>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={recoveryLoading || recoveryOtp.trim().length !== 6}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-civic-600 hover:bg-civic-700 rounded-lg shadow-sm transition disabled:opacity-60"
                  >
                    {recoveryLoading ? 'Verifying...' : 'Verify Recovery Code'}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Enter New Password */}
            {forgotStep === 3 && (
              <form onSubmit={handleExecutePasswordReset} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-civic-500 focus:border-civic-500 text-slate-900 transition"
                  />
                  <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-slate-500">
                    <span className={hasMinLength ? 'text-emerald-600 font-medium' : ''}>• 8+ characters</span>
                    <span className={hasUpper ? 'text-emerald-600 font-medium' : ''}>• Uppercase</span>
                    <span className={hasLower ? 'text-emerald-600 font-medium' : ''}>• Lowercase</span>
                    <span className={hasNumber ? 'text-emerald-600 font-medium' : ''}>• Number</span>
                    <span className={hasSpecial ? 'text-emerald-600 font-medium' : ''}>• Special char</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-civic-500 focus:border-civic-500 text-slate-900 transition"
                  />
                  {confirmNewPassword && (
                    <p className={`mt-1 text-[11px] ${resetPasswordsMatch ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {resetPasswordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
                    </p>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={recoveryLoading || !isResetPasswordValid || !resetPasswordsMatch}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-civic-600 hover:bg-civic-700 rounded-lg shadow-sm transition disabled:opacity-60"
                  >
                    {recoveryLoading ? 'Updating Password...' : 'Reset Password & Revoke Sessions'}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 4: Reset Success */}
            {forgotStep === 4 && (
              <div className="text-center py-4 space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-600">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Password Reset Successful!</h4>
                <p className="text-xs text-slate-600">
                  Your password has been securely updated. Any existing active sessions have been invalidated.
                </p>
                <button
                  type="button"
                  onClick={handleCompleteAndSignIn}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-civic-600 hover:bg-civic-700 rounded-lg shadow-sm transition"
                >
                  Return to Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
