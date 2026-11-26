import React from 'react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import * as AuthContextModule from '../context/AuthContext';

describe('LoginPage — Authentication & Forgot Password Recovery Integration', () => {
  const mockLogin = vi.fn();
  const mockForgotPassword = vi.fn();
  const mockVerifyResetOtp = vi.fn();
  const mockResendResetOtp = vi.fn();
  const mockResetPassword = vi.fn();

  beforeEach(() => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      login: mockLogin,
      forgotPassword: mockForgotPassword,
      verifyResetOtp: mockVerifyResetOtp,
      resendResetOtp: mockResendResetOtp,
      resetPassword: mockResetPassword,
      user: null,
      loading: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('1. Renders login form with visible Forgot Password button', () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    expect(screen.getByPlaceholderText('name@example.com')).toBeDefined();
    expect(screen.getByPlaceholderText('••••••••••••')).toBeDefined();
    expect(screen.getByRole('button', { name: /forgot password\?/i })).toBeDefined();
  });

  test('2. Clicking Forgot Password opens recovery modal and requests OTP', async () => {
    mockForgotPassword.mockResolvedValueOnce({
      success: true,
      reset_id: 'reset-1234',
      contact_masked: 'a***n@example.com',
      contact_type: 'email',
      resend_cooldown_seconds: 60,
    });

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    // Open Forgot Password modal
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /forgot password\?/i }));
    });

    expect(screen.getByText('Password Recovery')).toBeDefined();
    expect(screen.getByPlaceholderText('citizen@example.com or 9876543210')).toBeDefined();

    // Submit identifier
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('citizen@example.com or 9876543210'), {
        target: { value: 'arjun@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: /send recovery code/i }));
    });

    await waitFor(() => {
      expect(mockForgotPassword).toHaveBeenCalledWith('arjun@example.com');
      expect(screen.getByPlaceholderText('Enter 6-digit code')).toBeDefined();
      expect(screen.getByText(/sent to a\*\*\*n@example\.com/i)).toBeDefined();
    });
  });

  test('3. Entering recovery OTP and resetting password completes workflow', async () => {
    mockForgotPassword.mockResolvedValueOnce({
      success: true,
      reset_id: 'reset-1234',
      contact_masked: 'a***n@example.com',
      contact_type: 'email',
      resend_cooldown_seconds: 60,
    });

    mockVerifyResetOtp.mockResolvedValueOnce({
      success: true,
      reset_token: 'secret-reset-token-32-chars-long',
    });

    mockResetPassword.mockResolvedValueOnce({
      success: true,
      message: 'Password reset successful',
    });

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    // Step 1: Request OTP
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /forgot password\?/i }));
    });

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('citizen@example.com or 9876543210'), {
        target: { value: 'arjun@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: /send recovery code/i }));
    });

    // Step 2: Enter OTP
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter 6-digit code')).toBeDefined();
    });

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('Enter 6-digit code'), {
        target: { value: '556677' },
      });
      fireEvent.click(screen.getByRole('button', { name: /verify recovery code/i }));
    });

    // Step 3: Enter New Password
    await waitFor(() => {
      expect(mockVerifyResetOtp).toHaveBeenCalledWith({
        reset_id: 'reset-1234',
        otp: '556677',
      });
      expect(screen.getByText('New Password')).toBeDefined();
      expect(screen.getByText('Confirm New Password')).toBeDefined();
    });

    const pwdInput = screen.getByPlaceholderText('Enter new password');
    const confirmPwdInput = screen.getByPlaceholderText('Confirm new password');
    await act(async () => {
      fireEvent.change(pwdInput, { target: { value: 'NewSecurePass99!' } });
      fireEvent.change(confirmPwdInput, { target: { value: 'NewSecurePass99!' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /reset password & revoke sessions/i }));
    });

    // Step 4: Success confirmation
    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith({
        reset_token: 'secret-reset-token-32-chars-long',
        new_password: 'NewSecurePass99!',
        confirm_password: 'NewSecurePass99!',
      });
      expect(screen.getByText('Password Reset Successful!')).toBeDefined();
      expect(screen.getByRole('button', { name: /return to sign in/i })).toBeDefined();
    });
  });
});
