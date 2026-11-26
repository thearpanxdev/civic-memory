import React from 'react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import RegisterPage from './RegisterPage';
import * as AuthContextModule from '../context/AuthContext';

describe('RegisterPage — Citizen Registration & Address Selection Enhancement', () => {
  const mockRegister = vi.fn();
  const mockVerifyRegistrationOtp = vi.fn();
  const mockResendRegistrationOtp = vi.fn();

  beforeEach(() => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      register: mockRegister,
      verifyRegistrationOtp: mockVerifyRegistrationOtp,
      resendRegistrationOtp: mockResendRegistrationOtp,
      user: null,
      loading: false,
    });

    // Mock global fetch for postal lookup and locality AI check API
    global.fetch = vi.fn((url, options) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      // Postal lookup endpoints
      if (urlStr.includes('/api/geo/pincode/560038')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              pincode: '560038',
              state: 'Karnataka',
              district: 'Bengaluru Urban',
              postOffices: ['HAL II Stage', 'Indiranagar'],
              suggestedUlbs: ['Bruhat Bengaluru Mahanagara Palike (BBMP) (Municipal Corporation)'],
              conflicting: false,
            }),
        });
      }
      if (urlStr.includes('/api/geo/pincode/411001')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              pincode: '411001',
              state: 'Maharashtra',
              district: 'Pune',
              postOffices: ['Pune Station', 'Rasta Peth'],
              suggestedUlbs: ['Pune Municipal Corporation (PMC) (Municipal Corporation)'],
              conflicting: false,
            }),
        });
      }
      if (urlStr.includes('/api/geo/pincode/500001')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              pincode: '500001',
              state: 'Telangana',
              district: 'Hyderabad',
              postOffices: ['Abids', 'Hyderabad G.P.O.', 'Moazzam Jahi Market'],
              suggestedUlbs: ['Greater Hyderabad Municipal Corporation (GHMC) (Municipal Corporation)'],
              conflicting: false,
            }),
        });
      }
      if (urlStr.includes('/api/geo/pincode/111222')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              pincode: '111222',
              state: null,
              district: null,
              postOffices: ['Border Sub Post Office'],
              suggestedUlbs: [],
              conflicting: true,
              conflictingDistricts: ['Gautam Buddha Nagar', 'Ghaziabad'],
            }),
        });
      }
      if (urlStr.includes('/api/geo/pincode/999999')) {
        return Promise.resolve({
          ok: false,
          json: () =>
            Promise.resolve({
              success: false,
              error: 'PIN code not found in postal directory',
            }),
        });
      }

      // Locality check AI endpoint
      if (urlStr.includes('/api/geo/check-locality')) {
        const body = options?.body ? JSON.parse(options.body) : {};
        if (body.locality === 'Defence Colony') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                assessment: {
                  status: 'plausible',
                  message: 'Defence Colony is recognized as a residential area in this district.',
                  suggested_correction: null,
                  confidence: 0.95,
                },
                verification_level: 'ai_assessed',
              }),
          });
        }
        if (body.locality === 'Defenc Colny') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                assessment: {
                  status: 'plausible',
                  message: 'Plausible locality with slight spelling correction.',
                  suggested_correction: 'Defence Colony',
                  confidence: 0.85,
                },
                verification_level: 'ai_assessed',
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              assessment: {
                status: 'insufficient_information',
                message: 'No authoritative records found for this locality.',
                suggested_correction: null,
                confidence: 0.5,
              },
              verification_level: 'manual_unverified',
            }),
        });
      }

      return Promise.reject(new Error('Network error / Service offline'));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('1. Renders PIN Code first and strictly excludes ward number', () => {
    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    // Identity and contact fields
    expect(screen.getByPlaceholderText('Arjun Sharma')).toBeDefined();
    expect(screen.getByPlaceholderText('arjun@example.com')).toBeDefined();
    expect(screen.getByPlaceholderText('9876543210')).toBeDefined();

    // Section B: PIN Code is rendered first in address details
    expect(screen.getByText('2. Residential Address & Location Details')).toBeDefined();
    expect(screen.getByLabelText(/PIN Code/i)).toBeDefined();
    expect(screen.getByText('State / Union Territory')).toBeDefined();
    expect(screen.getByText('District')).toBeDefined();
    expect(screen.getByText('Municipality / ULB')).toBeDefined();

    // Verify ward number is strictly NOT present in the registration form
    const wardInput = screen.queryByLabelText(/ward/i);
    const wardNumberInput = screen.queryByPlaceholderText(/ward/i);
    expect(wardInput).toBeNull();
    expect(wardNumberInput).toBeNull();
  });

  test('2. Changing State resets dependent District, ULB, and Locality', async () => {
    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    // Initial state is Karnataka and district is Bengaluru Urban
    expect(screen.getByText('Karnataka')).toBeDefined();
    expect(screen.getByText('Bengaluru Urban')).toBeDefined();

    // Open State dropdown and select Maharashtra
    const stateCombobox = screen.getByRole('combobox', { name: /state/i });
    await act(async () => {
      fireEvent.click(stateCombobox);
    });

    const searchStateInput = screen.getByPlaceholderText('Search State / Union Territory...');
    await act(async () => {
      fireEvent.change(searchStateInput, { target: { value: 'Maharashtra' } });
    });

    const maharashtraOption = screen.getByRole('option', { name: /maharashtra/i });
    await act(async () => {
      fireEvent.click(maharashtraOption);
    });

    // District and ULB should be reset because state changed
    expect(screen.queryByText('Bengaluru Urban')).toBeNull();
    expect(screen.getByText('Select District')).toBeDefined();

    // Open District dropdown — should now list Maharashtra districts (e.g. Pune, Mumbai City)
    const districtCombobox = screen.getByRole('combobox', { name: /district/i });
    await act(async () => {
      fireEvent.click(districtCombobox);
    });

    const searchDistrictInput = screen.getByPlaceholderText('Search District...');
    await act(async () => {
      fireEvent.change(searchDistrictInput, { target: { value: 'Pune' } });
    });

    const puneOption = screen.getByRole('option', { name: /pune/i });
    expect(puneOption).toBeDefined();

    await act(async () => {
      fireEvent.click(puneOption);
    });

    expect(screen.getByText('Pune')).toBeDefined();
  });

  test('3. Entering 6-digit PIN code triggers postal lookup and populates all distinct locality options', async () => {
    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    const pinInput = screen.getByPlaceholderText(/e\.g\. 560038/i);
    await act(async () => {
      fireEvent.change(pinInput, { target: { value: '560038' } });
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/geo/pincode/560038'),
        expect.any(Object)
      );
    });

    // Both distinct post offices (HAL II Stage and Indiranagar) are available in locality suggestions
    await waitFor(() => {
      const localityCombobox = screen.getByRole('combobox', { name: /select locality from postal records/i });
      expect(localityCombobox).toBeDefined();
    });

    // Open locality combobox and verify both post offices are listed
    const localityCombobox = screen.getByRole('combobox', { name: /select locality from postal records/i });
    await act(async () => {
      fireEvent.click(localityCombobox);
    });

    expect(screen.getByRole('option', { name: /hal ii stage/i })).toBeDefined();
    expect(screen.getByRole('option', { name: /indiranagar/i })).toBeDefined();

    // Selecting a locality stores the chosen post office
    const indiranagarOption = screen.getByRole('option', { name: /indiranagar/i });
    await act(async () => {
      fireEvent.click(indiranagarOption);
    });

    expect(screen.getByText('Indiranagar')).toBeDefined();
  });

  test('4. Postal mismatch: "Keep My Selected Details" preserves State & District without overwrite', async () => {
    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    // Initial state is Karnataka, Bengaluru Urban
    expect(screen.getByText('Karnataka')).toBeDefined();
    expect(screen.getByText('Bengaluru Urban')).toBeDefined();

    // First, user manually selects State and District to claim authority
    const stateCombobox = screen.getByRole('combobox', { name: /state/i });
    await act(async () => {
      fireEvent.click(stateCombobox);
    });
    const searchState = screen.getByPlaceholderText('Search State / Union Territory...');
    await act(async () => {
      fireEvent.change(searchState, { target: { value: 'Karnataka' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: /karnataka/i }));
    });

    const distCombobox = screen.getByRole('combobox', { name: /district/i });
    await act(async () => {
      fireEvent.click(distCombobox);
    });
    const searchDist = screen.getByPlaceholderText('Search District...');
    await act(async () => {
      fireEvent.change(searchDist, { target: { value: 'Bengaluru Urban' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: /bengaluru urban/i }));
    });

    // Enter a PIN code that belongs to Pune, Maharashtra (411001)
    const pinInput = screen.getByPlaceholderText(/e\.g\. 560038/i);
    await act(async () => {
      fireEvent.change(pinInput, { target: { value: '411001' } });
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/postal code mismatch notice/i)).toBeDefined();
      expect(screen.getByText(/keep my selected details/i)).toBeDefined();
    });

    // User clicks "Keep My Selected Details"
    const keepBtn = screen.getByRole('button', { name: /keep my selected details/i });
    await act(async () => {
      fireEvent.click(keepBtn);
    });

    // The user's selections MUST remain preserved as Karnataka, Bengaluru Urban!
    expect(screen.getByText('Karnataka')).toBeDefined();
    expect(screen.getByText('Bengaluru Urban')).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('5. "Align State & District with PIN Code" updates region cleanly', async () => {
    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    // Manually set Karnataka, Bengaluru Urban
    const stateCombobox = screen.getByRole('combobox', { name: /state/i });
    await act(async () => {
      fireEvent.click(stateCombobox);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: /karnataka/i }));
    });
    const distCombobox = screen.getByRole('combobox', { name: /district/i });
    await act(async () => {
      fireEvent.click(distCombobox);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: /bengaluru urban/i }));
    });

    // Enter PIN 411001 (Pune, Maharashtra)
    const pinInput = screen.getByPlaceholderText(/e\.g\. 560038/i);
    await act(async () => {
      fireEvent.change(pinInput, { target: { value: '411001' } });
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /align state & district with pin code/i })).toBeDefined();
    });

    const alignBtn = screen.getByRole('button', { name: /align state & district with pin code/i });
    await act(async () => {
      fireEvent.click(alignBtn);
    });

    // Region is updated to Maharashtra, Pune
    await waitFor(() => {
      expect(screen.getByText('Maharashtra')).toBeDefined();
      expect(screen.getByText('Pune')).toBeDefined();
    });
  });

  test('6. Conflicting postal records show warning and require manual selection', async () => {
    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    const pinInput = screen.getByPlaceholderText(/e\.g\. 560038/i);
    await act(async () => {
      fireEvent.change(pinInput, { target: { value: '111222' } });
    });

    await waitFor(() => {
      expect(screen.getByText(/postal records for this pin code span multiple regions/i)).toBeDefined();
      expect(screen.getByText(/gautam buddha nagar, ghaziabad/i)).toBeDefined();
    });
  });

  test('7. Manual locality entry with optional AI Check', async () => {
    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    const pinInput = screen.getByPlaceholderText(/e\.g\. 560038/i);
    await act(async () => {
      fireEvent.change(pinInput, { target: { value: '560038' } });
    });

    await waitFor(() => {
      expect(screen.getByText('Enter manually')).toBeDefined();
    });

    // Click "Enter manually"
    await act(async () => {
      fireEvent.click(screen.getByText('Enter manually'));
    });

    // Text input is rendered
    const localityInput = screen.getByPlaceholderText(/defence colony, sector 4/i);
    expect(localityInput).toBeDefined();

    await act(async () => {
      fireEvent.change(localityInput, { target: { value: 'Defence Colony' } });
    });

    // Click "Check Locality" button to invoke AI assessment
    const checkBtn = screen.getByTitle(/check locality plausibility with ai assistant/i);
    expect(checkBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(checkBtn);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/geo/check-locality'),
        expect.any(Object)
      );
    });

    // Advisory result card appears
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeDefined();
      expect(screen.getByText(/plausible:/i)).toBeDefined();
      expect(screen.getByText(/defence colony is recognized as a residential area/i)).toBeDefined();
    });
  });

  test('8. AI locality check applies suggested spelling correction when clicked', async () => {
    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    const pinInput = screen.getByPlaceholderText(/e\.g\. 560038/i);
    await act(async () => {
      fireEvent.change(pinInput, { target: { value: '560038' } });
    });

    await waitFor(() => {
      expect(screen.getByText('Enter manually')).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Enter manually'));
    });

    const localityInput = screen.getByPlaceholderText(/defence colony, sector 4/i);
    await act(async () => {
      fireEvent.change(localityInput, { target: { value: 'Defenc Colny' } });
    });

    const checkBtn = screen.getByTitle(/check locality plausibility with ai assistant/i);
    await act(async () => {
      fireEvent.click(checkBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/apply "defence colony"/i)).toBeDefined();
    });

    const applyBtn = screen.getByText(/apply "defence colony"/i);
    await act(async () => {
      fireEvent.click(applyBtn);
    });

    expect(localityInput.value).toBe('Defence Colony');
  });

  test('9. Submitting valid citizen registration initiates dual OTP verification screen', async () => {
    mockRegister.mockResolvedValueOnce({
      success: true,
      pendingVerification: true,
      registration_id: 'reg-uuid-1234',
      email_masked: 'a***n@example.com',
      phone_masked: '******3210',
      resend_cooldown_seconds: 60,
    });

    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('Arjun Sharma'), { target: { value: 'Arjun Sharma' } });
      fireEvent.change(screen.getByPlaceholderText('arjun@example.com'), { target: { value: 'arjun@example.com' } });
      fireEvent.change(screen.getByPlaceholderText('9876543210'), { target: { value: '9876543210' } });
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. 560038/i), { target: { value: '560038' } });
      fireEvent.change(screen.getByPlaceholderText('100 Feet Road, 12th Main'), { target: { value: '12th Main' } });

      const pwdInputs = screen.getAllByPlaceholderText('••••••••••••');
      fireEvent.change(pwdInputs[0], { target: { value: 'ValidPassword123!' } });
      fireEvent.change(pwdInputs[1], { target: { value: 'ValidPassword123!' } });
    });

    await waitFor(() => {
      expect(screen.getByText('Enter manually')).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Enter manually'));
    });

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/defence colony, sector 4/i), { target: { value: 'Indiranagar' } });
    });

    const submitBtn = screen.getByRole('button', { name: /continue to verification/i });
    expect(submitBtn.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: 'Arjun Sharma',
          email: 'arjun@example.com',
          phone: '9876543210',
          state: 'Karnataka',
          district: 'Bengaluru Urban',
          locality: 'Indiranagar',
          street: '12th Main',
          pin_code: '560038',
        })
      );
    });

    // Dual OTP Verification UI should now be visible
    await waitFor(() => {
      expect(screen.getByText('Verify Your Contact Information')).toBeDefined();
      expect(screen.getByPlaceholderText('6-digit Email OTP')).toBeDefined();
      expect(screen.getByPlaceholderText('6-digit Mobile OTP')).toBeDefined();
    });
  });

  test('10. Clearing or shortening PIN below 6 digits resets locality suggestions and PIN lookup state', async () => {
    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    const pinInput = screen.getByPlaceholderText(/e\.g\. 560038/i);
    await act(async () => {
      fireEvent.change(pinInput, { target: { value: '560038' } });
    });

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /select locality from postal records/i })).toBeDefined();
    });

    // Now shorten PIN to 5 digits
    await act(async () => {
      fireEvent.change(pinInput, { target: { value: '56003' } });
    });

    // Locality suggestions combobox must be cleared and replaced with manual locality input
    await waitFor(() => {
      expect(screen.queryByRole('combobox', { name: /select locality from postal records/i })).toBeNull();
      expect(screen.getByPlaceholderText(/defence colony, sector 4/i)).toBeDefined();
    });
  });

  test('11. Out-of-order lookup responses cannot overwrite newer user input', async () => {
    let resolveSlowPin;
    const slowPinPromise = new Promise((resolve) => {
      resolveSlowPin = resolve;
    });

    const origFetch = global.fetch;
    global.fetch = vi.fn((url, options) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/api/geo/pincode/560038')) {
        // Slow response
        return slowPinPromise;
      }
      if (urlStr.includes('/api/geo/pincode/411001')) {
        // Fast response for Pune, Maharashtra
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              pincode: '411001',
              state: 'Maharashtra',
              district: 'Pune',
              postOffices: ['Pune Station', 'Rasta Peth'],
              suggestedUlbs: ['Pune Municipal Corporation (PMC) (Municipal Corporation)'],
              conflicting: false,
            }),
        });
      }
      return origFetch(url, options);
    });

    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    const pinInput = screen.getByPlaceholderText(/e\.g\. 560038/i);

    // 1. User enters 560038 (slow)
    await act(async () => {
      fireEvent.change(pinInput, { target: { value: '560038' } });
    });

    // 2. User quickly changes to 411001 (fast)
    await act(async () => {
      fireEvent.change(pinInput, { target: { value: '411001' } });
    });

    // Fast response resolves and updates to Pune, Maharashtra
    await waitFor(() => {
      expect(screen.getByText('Maharashtra')).toBeDefined();
      expect(screen.getByText('Pune')).toBeDefined();
    });

    // 3. Slow response for 560038 finally resolves
    await act(async () => {
      resolveSlowPin({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            pincode: '560038',
            state: 'Karnataka',
            district: 'Bengaluru Urban',
            postOffices: ['Indiranagar'],
            suggestedUlbs: [],
            conflicting: false,
          }),
      });
    });

    // Must STILL be Maharashtra and Pune, NOT overwritten by the slow, stale 560038 response!
    expect(screen.getByText('Maharashtra')).toBeDefined();
    expect(screen.getByText('Pune')).toBeDefined();
    expect(screen.queryByText('Karnataka')).toBeNull();
  });

  test('12. Postal lookup failure preserves manual address entry with unblocked notice', async () => {
    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    const pinInput = screen.getByPlaceholderText(/e\.g\. 560038/i);
    await act(async () => {
      fireEvent.change(pinInput, { target: { value: '999999' } });
    });

    await waitFor(() => {
      expect(screen.getByText(/pin code not found in postal directory/i)).toBeDefined();
      expect(screen.getByText(/manual entry unblocked/i)).toBeDefined();
    });

    // Manual locality input remains available and functional
    const localityInput = screen.getByPlaceholderText(/defence colony, sector 4/i);
    expect(localityInput).toBeDefined();
    await act(async () => {
      fireEvent.change(localityInput, { target: { value: 'Custom Colony' } });
    });
    expect(localityInput.value).toBe('Custom Colony');
  });
});
