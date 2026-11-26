import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check existing session on load via HttpOnly cookie
  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.warn('[CivicMemory Auth] Session check failed:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest', // Custom header for CSRF defense
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed. Please check your credentials.');
      }

      // Safe user object is stored in state; token remains securely locked in HttpOnly cookie
      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }

  async function register(userData) {
    setError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest', // Custom header for CSRF defense
        },
        credentials: 'include',
        body: JSON.stringify(userData),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.details) {
          const firstField = Object.keys(data.details)[0];
          throw new Error(data.details[firstField][0] || 'Registration validation failed.');
        }
        throw new Error(data.error || 'Registration failed.');
      }

      if (data.registration_id) {
        return { success: true, pendingVerification: true, ...data };
      }

      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }

  async function verifyRegistrationOtp({ registration_id, email_otp, mobile_otp }) {
    setError(null);
    try {
      const res = await fetch('/api/auth/register/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ registration_id, email_otp, mobile_otp }),
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Verification failed.',
          email_verified: data.email_verified,
          mobile_verified: data.mobile_verified,
          attempts_remaining: data.attempts_remaining,
        };
      }

      return { success: true, message: data.message, user: data.user };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }

  async function resendRegistrationOtp({ registration_id, type = 'both' }) {
    try {
      const res = await fetch('/api/auth/register/resend-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ registration_id, type }),
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Failed to resend code.',
          retry_after_seconds: data.retry_after_seconds,
        };
      }

      return { success: true, message: data.message, resend_cooldown_seconds: data.resend_cooldown_seconds };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async function forgotPassword(identifier) {
    setError(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ identifier }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.details) {
          const firstField = Object.keys(data.details)[0];
          throw new Error(data.details[firstField][0]);
        }
        throw new Error(data.error || 'Password recovery request failed.');
      }

      return { success: true, ...data };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }

  async function verifyResetOtp({ reset_id, otp }) {
    setError(null);
    try {
      const res = await fetch('/api/auth/forgot-password/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ reset_id, otp }),
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Verification failed.',
          attempts_remaining: data.attempts_remaining,
        };
      }

      return { success: true, reset_token: data.reset_token, message: data.message };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }

  async function resendResetOtp({ reset_id }) {
    try {
      const res = await fetch('/api/auth/forgot-password/resend-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ reset_id }),
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Failed to resend code.',
          retry_after_seconds: data.retry_after_seconds,
        };
      }

      return { success: true, message: data.message, resend_cooldown_seconds: data.resend_cooldown_seconds };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async function resetPassword({ reset_token, new_password, confirm_password }) {
    setError(null);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ reset_token, new_password, confirm_password }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.details) {
          const firstField = Object.keys(data.details)[0];
          throw new Error(data.details[firstField][0]);
        }
        throw new Error(data.error || 'Password reset failed.');
      }

      return { success: true, message: data.message };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
      });
    } catch (err) {
      console.warn('[CivicMemory Auth] Logout request error:', err);
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  }

  const value = {
    user,
    loading,
    error,
    login,
    register,
    verifyRegistrationOtp,
    resendRegistrationOtp,
    forgotPassword,
    verifyResetOtp,
    resendResetOtp,
    resetPassword,
    logout,
    checkAuth,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
