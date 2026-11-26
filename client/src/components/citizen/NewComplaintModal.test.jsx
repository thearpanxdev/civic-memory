import React from 'react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import NewComplaintModal from './NewComplaintModal';

describe('NewComplaintModal — Gemini AI Complaint Analysis Integration', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Default fetch mock handles wards metadata lookup
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (typeof url === 'string' && url.includes('/meta/wards')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            wards: [
              { id: 'ward-1', ward_number: 1, name: 'Indiranagar', zone: 'East' },
              { id: 'ward-2', ward_number: 2, name: 'Koramangala', zone: 'South' },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
      });
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  test('1. Successful analysis: Displays advisory suggestions without overwriting category automatically', async () => {
    const mockAnalysis = {
      suggestedCategory: 'Sanitation and Waste Management',
      summary: 'Public garbage bin overflowing onto sidewalk.',
      keyDetails: ['Garbage spilling onto walkway', 'Uncollected for 3 days'],
      confidence: 'high',
      needsClarification: true,
      clarificationQuestion: 'Is the waste household garbage or hazardous industrial waste?',
    };

    let resolveAnalysis;
    const analysisPromise = new Promise((resolve) => {
      resolveAnalysis = resolve;
    });

    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ wards: [{ id: 'ward-1', ward_number: 1, name: 'Indiranagar', zone: 'East' }] }),
        });
      }
      if (url.includes('/api/complaints/analyze')) {
        return analysisPromise.then(() => ({
          ok: true,
          status: 200,
          json: async () => mockAnalysis,
        }));
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);

    // Fill valid title & description
    const titleInput = screen.getByPlaceholderText(/Deep crater pothole/i);
    const descInput = screen.getByPlaceholderText(/Provide complete details/i);

    fireEvent.change(titleInput, { target: { value: 'Overflowing dump bin on 4th cross' } });
    fireEvent.change(descInput, { target: { value: 'Waste has been piling up for 3 days and is spilling onto the street.' } });

    // Click "Suggest Category & Summary"
    const analyzeBtn = screen.getByRole('button', { name: /Suggest Category & Summary/i });
    fireEvent.click(analyzeBtn);

    // Verify loading state while request is in-flight
    expect(analyzeBtn.disabled).toBe(true);

    // Resolve the in-flight request
    resolveAnalysis();

    // Verify advisory results are displayed
    await waitFor(() => {
      expect(screen.getByText('AI Advisory Suggestion')).toBeDefined();
      expect(screen.getAllByText('Sanitation and Waste Management').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Public garbage bin overflowing onto sidewalk.')).toBeDefined();
      expect(screen.getByText('Garbage spilling onto walkway')).toBeDefined();
      expect(screen.getByText(/high Confidence/i)).toBeDefined();
      expect(screen.getByText(/Is the waste household garbage/i)).toBeDefined();
    });

    // Verify request payload and headers
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/complaints/analyze',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        }),
        credentials: 'include',
        body: JSON.stringify({
          title: 'Overflowing dump bin on 4th cross',
          description: 'Waste has been piling up for 3 days and is spilling onto the street.',
        }),
      })
    );

    // Category should NOT be automatically changed to the suggestion yet (Default is Roads and Infrastructure)
    expect(screen.getByText('Current selection: Roads and Infrastructure')).toBeDefined();
  });

  test('2. Missing title or description: Validates locally before calling API', async () => {
    render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);

    const analyzeBtn = screen.getByRole('button', { name: /Suggest Category & Summary/i });

    // Both empty -> shows title error
    act(() => {
      fireEvent.click(analyzeBtn);
    });
    expect(screen.getByText(/Please enter an issue title/i)).toBeDefined();
    expect(global.fetch).not.toHaveBeenCalledWith('/api/complaints/analyze', expect.anything());

    // Title too short (< 5 chars)
    const titleInput = screen.getByPlaceholderText(/Deep crater pothole/i);
    act(() => {
      fireEvent.change(titleInput, { target: { value: 'Poth' } });
      fireEvent.click(analyzeBtn);
    });
    expect(screen.getByText(/Title must be at least 5 characters/i)).toBeDefined();

    // Valid title, but empty description
    act(() => {
      fireEvent.change(titleInput, { target: { value: 'Valid Complaint Title' } });
      fireEvent.click(analyzeBtn);
    });
    expect(screen.getByText(/Please provide a detailed description/i)).toBeDefined();

    // Description too short (< 10 chars)
    const descInput = screen.getByPlaceholderText(/Provide complete details/i);
    act(() => {
      fireEvent.change(descInput, { target: { value: 'Short' } });
      fireEvent.click(analyzeBtn);
    });
    expect(screen.getByText(/Description must be at least 10 characters/i)).toBeDefined();

    // Ensure no API call was dispatched for invalid inputs
    expect(global.fetch).not.toHaveBeenCalledWith('/api/complaints/analyze', expect.anything());
  });

  test('3. 400 validation response: Displays field-level validation feedback', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ wards: [] }) });
      }
      if (url.includes('/api/complaints/analyze')) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({
            error: 'Validation failed',
            details: {
              title: ['Title cannot exceed 200 characters.'],
            },
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText(/Deep crater pothole/i), {
      target: { value: 'Valid Title Here' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Provide complete details/i), {
      target: { value: 'Valid detailed problem description for testing.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Suggest Category & Summary/i }));

    await waitFor(() => {
      expect(screen.getByText('Title cannot exceed 200 characters.')).toBeDefined();
    });
  });

  test('4. 401 & 403 response: Displays authentication and authorization feedback', async () => {
    // 401 Session expired
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ wards: [] }) });
      }
      if (url.includes('/api/complaints/analyze')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ error: 'Authentication required' }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    const { unmount } = render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText(/Deep crater pothole/i), { target: { value: 'Valid Title' } });
    fireEvent.change(screen.getByPlaceholderText(/Provide complete details/i), { target: { value: 'Valid Description Text' } });
    fireEvent.click(screen.getByRole('button', { name: /Suggest Category & Summary/i }));

    await waitFor(() => {
      expect(screen.getByText(/Your session has expired/i)).toBeDefined();
    });

    unmount();

    // 403 Forbidden / CSRF
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ wards: [] }) });
      }
      if (url.includes('/api/complaints/analyze')) {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: async () => ({ error: 'Access denied: Only citizens can request AI complaint analysis.' }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/Deep crater pothole/i), { target: { value: 'Valid Title' } });
    fireEvent.change(screen.getByPlaceholderText(/Provide complete details/i), { target: { value: 'Valid Description Text' } });
    fireEvent.click(screen.getByRole('button', { name: /Suggest Category & Summary/i }));

    await waitFor(() => {
      expect(screen.getByText(/Access denied: Only citizens can request AI complaint analysis/i)).toBeDefined();
    });
  });

  test('5. 502 & 503 response: Displays graceful AI service unavailable feedback', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ wards: [] }) });
      }
      if (url.includes('/api/complaints/analyze')) {
        return Promise.resolve({
          ok: false,
          status: 503,
          json: async () => ({ error: 'AI analysis service is temporarily unavailable.' }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText(/Deep crater pothole/i), { target: { value: 'Water leak on road' } });
    fireEvent.change(screen.getByPlaceholderText(/Provide complete details/i), { target: { value: 'Water pipe broke underground and is flooding.' } });
    fireEvent.click(screen.getByRole('button', { name: /Suggest Category & Summary/i }));

    await waitFor(() => {
      expect(screen.getByText(/AI analysis service is temporarily unavailable/i)).toBeDefined();
    });
  });

  test('6. Network failure: Displays network retry error message', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ wards: [] }) });
      }
      if (url.includes('/api/complaints/analyze')) {
        return Promise.reject(new TypeError('Failed to fetch'));
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText(/Deep crater pothole/i), { target: { value: 'Pothole on 100ft road' } });
    fireEvent.change(screen.getByPlaceholderText(/Provide complete details/i), { target: { value: 'Pothole causing accidents near crossing.' } });
    fireEvent.click(screen.getByRole('button', { name: /Suggest Category & Summary/i }));

    await waitFor(() => {
      expect(screen.getByText(/Network error connecting to AI analysis service/i)).toBeDefined();
    });
  });

  test('7. Accepting a suggestion: Changes category and preserves severity without submitting', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ wards: [] }) });
      }
      if (url.includes('/api/complaints/analyze')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            suggestedCategory: 'Water Supply',
            summary: 'Drinking water pipeline burst.',
            keyDetails: ['Clean water wasting'],
            confidence: 'high',
            needsClarification: false,
            clarificationQuestion: null,
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    const mockSuccess = vi.fn();
    render(<NewComplaintModal onClose={() => {}} onSuccess={mockSuccess} />);

    // Select Severity "High" manually before analysis
    const severitySelect = screen.getByLabelText(/Severity Level/i);
    fireEvent.change(severitySelect, { target: { value: 'high' } });

    // Fill title and description
    fireEvent.change(screen.getByPlaceholderText(/Deep crater pothole/i), { target: { value: 'Fresh water gushing out' } });
    fireEvent.change(screen.getByPlaceholderText(/Provide complete details/i), { target: { value: 'Main water supply pipe burst under road.' } });

    // Request analysis
    fireEvent.click(screen.getByRole('button', { name: /Suggest Category & Summary/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Accept "Water Supply"/i })).toBeDefined();
    });

    // Click "Accept 'Water Supply'"
    fireEvent.click(screen.getByRole('button', { name: /Accept "Water Supply"/i }));

    // Verify category was updated to "Water Supply"
    expect(screen.getByText('✓ Category Selected')).toBeDefined();

    // Verify severity remains "high" (not modified by AI)
    expect(severitySelect.value).toBe('high');

    // Verify form was NOT submitted automatically
    expect(mockSuccess).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalledWith('/api/complaints', expect.anything());
  });

  test('8. Ignoring a suggestion: Dismisses the analysis card without altering category', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ wards: [] }) });
      }
      if (url.includes('/api/complaints/analyze')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            suggestedCategory: 'Street Lighting',
            summary: 'Broken lamp.',
            keyDetails: ['Dark street'],
            confidence: 'low',
            needsClarification: false,
            clarificationQuestion: null,
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);

    // Initial category is "Roads and Infrastructure"
    fireEvent.change(screen.getByPlaceholderText(/Deep crater pothole/i), { target: { value: 'Dark street corner' } });
    fireEvent.change(screen.getByPlaceholderText(/Provide complete details/i), { target: { value: 'Street light bulb is not working at night.' } });

    fireEvent.click(screen.getByRole('button', { name: /Suggest Category & Summary/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ignore Suggestion/i })).toBeDefined();
    });

    // Click "Ignore Suggestion"
    fireEvent.click(screen.getByRole('button', { name: /Ignore Suggestion/i }));

    // Analysis card should be dismissed
    expect(screen.queryByText('AI Advisory Suggestion')).toBeNull();
  });

  test('9. Changing description invalidates previous analysis with stale status', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ wards: [] }) });
      }
      if (url.includes('/api/complaints/analyze')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            suggestedCategory: 'Roads and Infrastructure',
            summary: 'Pothole issue.',
            keyDetails: [],
            confidence: 'high',
            needsClarification: false,
            clarificationQuestion: null,
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);

    const titleInput = screen.getByPlaceholderText(/Deep crater pothole/i);
    const descInput = screen.getByPlaceholderText(/Provide complete details/i);

    fireEvent.change(titleInput, { target: { value: 'Pothole problem' } });
    fireEvent.change(descInput, { target: { value: 'Initial description of road damage.' } });

    fireEvent.click(screen.getByRole('button', { name: /Suggest Category & Summary/i }));

    await waitFor(() => {
      expect(screen.getByText('AI Advisory Suggestion')).toBeDefined();
    });

    // Stale notice should not be present initially
    expect(screen.queryByText(/Input modified since analysis/i)).toBeNull();

    // Now modify the description
    fireEvent.change(descInput, { target: { value: 'Initial description of road damage with NEW details added.' } });

    // Stale notice MUST appear immediately
    expect(screen.getByText(/Input modified since analysis/i)).toBeDefined();
  });

  test('10. Complaint submission still works without using AI', async () => {
    let submittedBody = null;
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ wards: [{ id: 'ward-101', ward_number: 101, name: 'MG Road', zone: 'Central' }] }),
        });
      }
      if (url.includes('/api/complaints') && opts?.method === 'POST') {
        submittedBody = opts.body;
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            message: 'Complaint submitted successfully',
            complaint: { ticket_number: 'CM-2026-99999' },
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    const mockSuccess = vi.fn();
    render(<NewComplaintModal onClose={() => {}} onSuccess={mockSuccess} />);

    // Fill form manually
    fireEvent.change(screen.getByPlaceholderText(/Deep crater pothole/i), {
      target: { value: 'Manual Pothole Report' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Provide complete details/i), {
      target: { value: 'Manually entered issue without ever clicking AI button.' },
    });
    fireEvent.change(screen.getByPlaceholderText(/100ft Road/i), {
      target: { value: 'Near Metro Station' },
    });

    // Submit form directly
    fireEvent.click(screen.getByRole('button', { name: /Submit Civic Complaint/i }));

    await waitFor(() => {
      expect(screen.getByText('Complaint Submitted Successfully!')).toBeDefined();
      expect(screen.getByText(/Ticket Reference: CM-2026-99999/i)).toBeDefined();
    });

    // Confirm that analyze endpoint was NEVER called
    expect(global.fetch).not.toHaveBeenCalledWith('/api/complaints/analyze', expect.anything());

    // Confirm that FormData submission happened
    expect(submittedBody instanceof FormData).toBe(true);
    expect(mockSuccess).toHaveBeenCalledWith(expect.objectContaining({ ticket_number: 'CM-2026-99999' }));
  });

  test('11. Editing title while analysis is pending cancels active request and prevents its result from appearing', async () => {
    let resolveAnalysis;
    const analysisPromise = new Promise((resolve) => {
      resolveAnalysis = resolve;
    });

    let capturedSignal = null;

    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ wards: [] }) });
      }
      if (url.includes('/api/complaints/analyze')) {
        capturedSignal = opts?.signal;
        return analysisPromise.then(() => ({
          ok: true,
          status: 200,
          json: async () => ({
            suggestedCategory: 'Roads and Infrastructure',
            summary: 'Late pothole result that should be discarded',
            keyDetails: [],
            confidence: 'high',
          }),
        }));
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);

    const titleInput = screen.getByPlaceholderText(/Deep crater pothole/i);
    const descInput = screen.getByPlaceholderText(/Provide complete details/i);

    fireEvent.change(titleInput, { target: { value: 'Initial Pothole Title' } });
    fireEvent.change(descInput, { target: { value: 'Detailed description of road damage.' } });

    // Click Suggest Category & Summary
    const analyzeBtn = screen.getByRole('button', { name: /Suggest Category & Summary/i });
    fireEvent.click(analyzeBtn);

    // Analysis is in flight
    expect(screen.getByRole('button', { name: /Analyzing with Gemini.../i })).toBeDefined();

    // While pending, citizen edits the title
    act(() => {
      fireEvent.change(titleInput, { target: { value: 'Edited Pothole Title During Analysis' } });
    });

    // Check that signal was aborted
    if (capturedSignal) {
      expect(capturedSignal.aborted).toBe(true);
    }

    // Check that loading state stopped and citizen was informed
    expect(screen.queryByRole('button', { name: /Analyzing with Gemini.../i })).toBeNull();
    expect(screen.getByText(/Input changed while analysis was in progress/i)).toBeDefined();

    // Now resolve the late response
    resolveAnalysis();

    // Wait for microtasks
    await new Promise((r) => setTimeout(r, 50));

    // Verify that the result did NOT appear
    expect(screen.queryByText('AI Advisory Suggestion')).toBeNull();
    expect(screen.queryByText('Late pothole result that should be discarded')).toBeNull();
  });

  test('12. Editing description while analysis is pending cancels active request and prevents its result from appearing', async () => {
    let resolveAnalysis;
    const analysisPromise = new Promise((resolve) => {
      resolveAnalysis = resolve;
    });

    let capturedSignal = null;

    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ wards: [] }) });
      }
      if (url.includes('/api/complaints/analyze')) {
        capturedSignal = opts?.signal;
        return analysisPromise.then(() => ({
          ok: true,
          status: 200,
          json: async () => ({
            suggestedCategory: 'Water Supply',
            summary: 'Late water result that should be discarded',
            keyDetails: [],
            confidence: 'high',
          }),
        }));
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);

    const titleInput = screen.getByPlaceholderText(/Deep crater pothole/i);
    const descInput = screen.getByPlaceholderText(/Provide complete details/i);

    fireEvent.change(titleInput, { target: { value: 'Leaking pipe on 5th main' } });
    fireEvent.change(descInput, { target: { value: 'Fresh drinking water leaking for days.' } });

    const analyzeBtn = screen.getByRole('button', { name: /Suggest Category & Summary/i });
    fireEvent.click(analyzeBtn);

    expect(screen.getByRole('button', { name: /Analyzing with Gemini.../i })).toBeDefined();

    // While pending, citizen edits the description
    act(() => {
      fireEvent.change(descInput, { target: { value: 'Fresh drinking water leaking for days with major flood on sidewalk.' } });
    });

    // Signal should be aborted
    if (capturedSignal) {
      expect(capturedSignal.aborted).toBe(true);
    }

    // Loading state stopped and notice displayed
    expect(screen.queryByRole('button', { name: /Analyzing with Gemini.../i })).toBeNull();
    expect(screen.getByText(/Input changed while analysis was in progress/i)).toBeDefined();

    // Resolve late response
    resolveAnalysis();

    await new Promise((r) => setTimeout(r, 50));

    // Result must not appear
    expect(screen.queryByText('AI Advisory Suggestion')).toBeNull();
    expect(screen.queryByText('Late water result that should be discarded')).toBeNull();
  });

  test('13. Ignoring analysis while pending prevents late response from rendering', async () => {
    let resolveAnalysis;
    const analysisPromise = new Promise((resolve) => {
      resolveAnalysis = resolve;
    });

    let capturedSignal = null;

    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ wards: [] }) });
      }
      if (url.includes('/api/complaints/analyze')) {
        capturedSignal = opts?.signal;
        return analysisPromise.then(() => ({
          ok: true,
          status: 200,
          json: async () => ({
            suggestedCategory: 'Street Lighting',
            summary: 'Late lighting result that citizen ignored',
            keyDetails: [],
            confidence: 'high',
          }),
        }));
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText(/Deep crater pothole/i), { target: { value: 'Street light out' } });
    fireEvent.change(screen.getByPlaceholderText(/Provide complete details/i), { target: { value: 'Dark intersection causing danger.' } });

    const analyzeBtn = screen.getByRole('button', { name: /Suggest Category & Summary/i });
    fireEvent.click(analyzeBtn);

    expect(screen.getByRole('button', { name: /Analyzing with Gemini.../i })).toBeDefined();

    // Find ignore / cancel button while pending
    const ignoreBtn = screen.getByRole('button', { name: /Ignore Analysis/i });
    act(() => {
      fireEvent.click(ignoreBtn);
    });

    // Signal should be aborted
    if (capturedSignal) {
      expect(capturedSignal.aborted).toBe(true);
    }

    // Loading state should be stopped
    expect(screen.queryByRole('button', { name: /Analyzing with Gemini.../i })).toBeNull();

    // Resolve late response
    resolveAnalysis();

    await new Promise((r) => setTimeout(r, 50));

    // Card must not appear
    expect(screen.queryByText('AI Advisory Suggestion')).toBeNull();
    expect(screen.queryByText('Late lighting result that citizen ignored')).toBeNull();
  });

  test('14. "Accept" button is disabled when analysis is stale', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ wards: [] }) });
      }
      if (url.includes('/api/complaints/analyze')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            suggestedCategory: 'Drainage and Sewerage',
            summary: 'Drainage overflow analysis',
            keyDetails: [],
            confidence: 'high',
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);

    const titleInput = screen.getByPlaceholderText(/Deep crater pothole/i);
    const descInput = screen.getByPlaceholderText(/Provide complete details/i);

    fireEvent.change(titleInput, { target: { value: 'Clogged storm drain' } });
    fireEvent.change(descInput, { target: { value: 'Storm drain clogged with plastic bottles and silt.' } });

    fireEvent.click(screen.getByRole('button', { name: /Suggest Category & Summary/i }));

    await waitFor(() => {
      expect(screen.getByText('AI Advisory Suggestion')).toBeDefined();
    });

    const acceptBtn = screen.getByRole('button', { name: /Accept "Drainage and Sewerage"/i });
    // Initially, analysis is fresh -> accept button is not disabled
    expect(acceptBtn.disabled).toBe(false);

    // Now mutate the title to make it stale
    fireEvent.change(titleInput, { target: { value: 'Clogged storm drain near park' } });

    // Stale notice appears
    expect(screen.getByText(/Input modified since analysis/i)).toBeDefined();

    // Accept button MUST be disabled
    expect(acceptBtn.disabled).toBe(true);

    // Attempting to click disabled accept button should not change category
    fireEvent.click(acceptBtn);
    expect(screen.getByText('Current selection: Roads and Infrastructure')).toBeDefined();
  });

  test('15. Superseded requests cannot overwrite newer results (out-of-order responses)', async () => {
    let resolveReq1, resolveReq2;
    const promise1 = new Promise((r) => { resolveReq1 = r; });
    const promise2 = new Promise((r) => { resolveReq2 = r; });

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ wards: [] }) });
      }
      if (url.includes('/api/complaints/analyze')) {
        callCount++;
        if (callCount === 1) {
          return promise1.then(() => ({
            ok: true,
            status: 200,
            json: async () => ({
              suggestedCategory: 'Roads and Infrastructure',
              summary: 'Old result from Request 1 (superseded)',
              keyDetails: [],
              confidence: 'low',
            }),
          }));
        }
        return promise2.then(() => ({
          ok: true,
          status: 200,
          json: async () => ({
            suggestedCategory: 'Water Supply',
            summary: 'New result from Request 2 (latest)',
            keyDetails: [],
            confidence: 'high',
          }),
        }));
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);

    const titleInput = screen.getByPlaceholderText(/Deep crater pothole/i);
    const descInput = screen.getByPlaceholderText(/Provide complete details/i);

    // Trigger Request 1
    fireEvent.change(titleInput, { target: { value: 'Request 1 Title' } });
    fireEvent.change(descInput, { target: { value: 'Request 1 Description details' } });
    fireEvent.click(screen.getByRole('button', { name: /Suggest Category & Summary/i }));

    // While Request 1 is still pending, citizen changes description (which cancels Request 1)
    // and requests a fresh analysis (Request 2)
    fireEvent.change(descInput, { target: { value: 'Request 2 Updated description details' } });
    fireEvent.click(screen.getByRole('button', { name: /Suggest Category & Summary/i }));

    // Now resolve Request 2 first!
    resolveReq2();

    await waitFor(() => {
      expect(screen.getByText('New result from Request 2 (latest)')).toBeDefined();
    });

    // Now resolve Request 1 later!
    resolveReq1();

    await new Promise((r) => setTimeout(r, 50));

    // The older Request 1 must NOT overwrite Request 2
    expect(screen.getByText('New result from Request 2 (latest)')).toBeDefined();
    expect(screen.queryByText('Old result from Request 1 (superseded)')).toBeNull();
  });

  test('16. Component unmounting during analysis does not produce React state update warnings or unhandled rejections', async () => {
    let resolveAnalysis;
    const analysisPromise = new Promise((resolve) => {
      resolveAnalysis = resolve;
    });

    let capturedSignal = null;
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ wards: [] }) });
      }
      if (url.includes('/api/complaints/analyze')) {
        capturedSignal = opts?.signal;
        return analysisPromise.then(() => ({
          ok: true,
          status: 200,
          json: async () => ({
            suggestedCategory: 'Street Lighting',
            summary: 'Result after unmount',
            confidence: 'high',
          }),
        }));
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText(/Deep crater pothole/i), { target: { value: 'Valid Title for Unmount' } });
    fireEvent.change(screen.getByPlaceholderText(/Provide complete details/i), { target: { value: 'Valid description for unmount test.' } });

    fireEvent.click(screen.getByRole('button', { name: /Suggest Category & Summary/i }));

    // Unmount while request is active
    unmount();

    // Verify signal was aborted on unmount
    if (capturedSignal) {
      expect(capturedSignal.aborted).toBe(true);
    }

    // Resolve late analysis after unmount
    resolveAnalysis();

    await new Promise((r) => setTimeout(r, 50));

    // Verify console.error was not called with React unmounted component state update warning
    const stateUpdateWarnings = consoleSpy.mock.calls.filter(call =>
      call.some(arg => typeof arg === 'string' && (arg.includes('unmounted') || arg.includes('state update on an unmounted component')))
    );
    expect(stateUpdateWarnings.length).toBe(0);

    consoleSpy.mockRestore();
  });

  test('17. Backend HTTP 400 validation response maps details.address below address input with generic banner', async () => {
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ wards: [{ id: 'ward-1', ward_number: 1, name: 'Indiranagar', zone: 'East' }] }),
        });
      }
      if (url.includes('/api/complaints') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({
            error: 'Validation failed',
            details: {
              address: ['Address description must be at least 3 characters long.'],
            },
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);

    // Fill valid form fields with an address >= 3 chars so client validation passes to test server 400 response
    fireEvent.change(screen.getByPlaceholderText(/Deep crater pothole/i), { target: { value: 'Valid Complaint Title' } });
    fireEvent.change(screen.getByPlaceholderText(/Provide complete details/i), { target: { value: 'Valid Description with enough length.' } });
    const addressInput = screen.getByPlaceholderText(/100ft Road/i);
    fireEvent.change(addressInput, { target: { value: '10th Main' } });

    // Submit form
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Submit Civic Complaint/i }));
    });

    // Wait for error rendering
    await waitFor(() => {
      // 1. Generic banner appears
      expect(screen.getByText(/Please resolve the highlighted validation errors/i)).toBeDefined();
      // 2. Field error appears directly below address input
      expect(screen.getByText('Address description must be at least 3 characters long.')).toBeDefined();
    });

    // 3. Address input displays error styling border
    expect(addressInput.className).toContain('border-rose-400');
  });

  test('18. Correcting the address field immediately clears the address field error and banner', async () => {
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ wards: [{ id: 'ward-1', ward_number: 1, name: 'Indiranagar', zone: 'East' }] }),
        });
      }
      if (url.includes('/api/complaints') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({
            error: 'Validation failed',
            details: {
              address: ['Address description must be at least 3 characters long.'],
            },
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText(/Deep crater pothole/i), { target: { value: 'Valid Complaint Title' } });
    fireEvent.change(screen.getByPlaceholderText(/Provide complete details/i), { target: { value: 'Valid Description with enough length.' } });
    const addressInput = screen.getByPlaceholderText(/100ft Road/i);
    fireEvent.change(addressInput, { target: { value: '10th Main' } });

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Submit Civic Complaint/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Address description must be at least 3 characters long.')).toBeDefined();
    });

    // Citizen types to correct the address
    act(() => {
      fireEvent.change(addressInput, { target: { value: '100ft Road Indiranagar Near Metro' } });
    });

    // Error message and generic banner should be cleared
    expect(screen.queryByText('Address description must be at least 3 characters long.')).toBeNull();
    expect(screen.queryByText(/Please resolve the highlighted validation errors/i)).toBeNull();
    expect(addressInput.className).not.toContain('border-rose-400');
  });

  test('19. Client-side address validation blocks submission when address is shorter than 3 characters', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ wards: [{ id: 'ward-1', ward_number: 1, name: 'Indiranagar', zone: 'East' }] }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText(/Deep crater pothole/i), { target: { value: 'Valid Complaint Title' } });
    fireEvent.change(screen.getByPlaceholderText(/Provide complete details/i), { target: { value: 'Valid Description with enough length.' } });
    const addressInput = screen.getByPlaceholderText(/100ft Road/i);
    // User types "10" (length 2, exactly as described in prompt)
    fireEvent.change(addressInput, { target: { value: '10' } });

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Submit Civic Complaint/i }));
    });

    // Client-side address validation should immediately flag the error
    expect(screen.getByText('Address description must be at least 3 characters long.')).toBeDefined();
    expect(screen.getByText(/Please resolve the highlighted validation errors/i)).toBeDefined();
    expect(addressInput.className).toContain('border-rose-400');

    // fetch('/api/complaints') MUST NOT have been called
    expect(global.fetch).not.toHaveBeenCalledWith('/api/complaints', expect.anything());
  });

  test('20. HTTP 400 response with no field-specific details preserves generic banner', async () => {
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ wards: [{ id: 'ward-1', ward_number: 1, name: 'Indiranagar', zone: 'East' }] }),
        });
      }
      if (url.includes('/api/complaints') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({
            error: 'Invalid ward: Selected ward does not exist.',
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText(/Deep crater pothole/i), { target: { value: 'Valid Complaint Title' } });
    fireEvent.change(screen.getByPlaceholderText(/Provide complete details/i), { target: { value: 'Valid Description with enough length.' } });
    fireEvent.change(screen.getByPlaceholderText(/100ft Road/i), { target: { value: '100ft Road, Indiranagar' } });

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Submit Civic Complaint/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Invalid ward: Selected ward does not exist.')).toBeDefined();
    });

    // No field-level error messages should be displayed
    expect(screen.queryByText('Address description must be at least 3 characters long.')).toBeNull();
  });

  test('21. Valid complaint submission still succeeds and invokes onSuccess callback', async () => {
    let capturedFormData = null;
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ wards: [{ id: 'ward-1', ward_number: 1, name: 'Indiranagar', zone: 'East' }] }),
        });
      }
      if (url.includes('/api/complaints') && opts?.method === 'POST') {
        capturedFormData = opts.body;
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            message: 'Complaint submitted successfully',
            complaint: { ticket_number: 'CM-2026-88888', title: 'Road repair needed' },
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    const mockSuccess = vi.fn();
    render(<NewComplaintModal onClose={() => {}} onSuccess={mockSuccess} />);

    fireEvent.change(screen.getByPlaceholderText(/Deep crater pothole/i), { target: { value: 'Road repair needed' } });
    fireEvent.change(screen.getByPlaceholderText(/Provide complete details/i), { target: { value: 'Large pothole on main road causing severe issues.' } });
    fireEvent.change(screen.getByPlaceholderText(/100ft Road/i), { target: { value: '100ft Road, Indiranagar' } });

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Submit Civic Complaint/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Complaint Submitted Successfully!')).toBeDefined();
      expect(screen.getByText(/Ticket Reference: CM-2026-88888/i)).toBeDefined();
    });

    expect(capturedFormData instanceof FormData).toBe(true);
    expect(mockSuccess).toHaveBeenCalledWith(expect.objectContaining({ ticket_number: 'CM-2026-88888' }));
  });

  test('22. Multimodal AI Analysis: Displays all 10 structured fields and allows citizen review/acceptance', async () => {
    const multimodalOutput = {
      issue_category: 'Road damage',
      issue_subcategory: 'Asphalt crater',
      description_summary: 'Severe road depression on 100ft road creating hazardous conditions.',
      severity: 'High',
      detected_objects: ['asphalt depression', 'fractured road edge'],
      visible_evidence: ['broken bitumen chunks visible in traffic lane'],
      potential_public_safety_risk: 'High danger of two-wheeler crashes and vehicle axle damage.',
      recommended_department: 'Roads and Infrastructure',
      confidence_score: 95,
      additional_information_required: ['Estimated crater depth'],
      suggestedCategory: 'Roads and Infrastructure',
      summary: 'Severe road depression on 100ft road creating hazardous conditions.',
      keyDetails: ['broken bitumen chunks visible in traffic lane'],
      confidence: 'high',
      needsClarification: true,
      clarificationQuestion: 'Estimated crater depth',
    };

    let capturedAnalyzeBody = null;
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ wards: [{ id: 'ward-1', ward_number: 1, name: 'Indiranagar', zone: 'East' }] }),
        });
      }
      if (url.includes('/api/complaints/analyze')) {
        capturedAnalyzeBody = opts.body;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => multimodalOutput,
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);

    // Enter title & description
    fireEvent.change(screen.getByPlaceholderText(/Deep crater pothole/i), {
      target: { value: 'Massive pothole on 100ft road' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Provide complete details/i), {
      target: { value: 'Deep asphalt pothole near junction causing severe vehicle traffic swerving.' },
    });

    // Request analysis
    const analyzeBtn = screen.getByRole('button', { name: /Suggest Category & Summary/i });
    act(() => {
      fireEvent.click(analyzeBtn);
    });

    await waitFor(() => {
      // 1. Issue Category & Subcategory
      expect(screen.getByText('Road damage')).toBeDefined();
      expect(screen.getByText('(Asphalt crater)')).toBeDefined();

      // 2. Department & Severity
      expect(screen.getAllByText('Roads and Infrastructure').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('High')).toBeDefined();

      // 3. Summary
      expect(screen.getByText('Severe road depression on 100ft road creating hazardous conditions.')).toBeDefined();

      // 4. Evidence & Objects
      expect(screen.getByText('broken bitumen chunks visible in traffic lane')).toBeDefined();
      expect(screen.getByText('asphalt depression')).toBeDefined();

      // 5. Public Safety Risk
      expect(screen.getByText('High danger of two-wheeler crashes and vehicle axle damage.')).toBeDefined();

      // 6. Confidence Score
      expect(screen.getByText('95% Confidence')).toBeDefined();

      // 7. Additional Info
      expect(screen.getByText('Estimated crater depth')).toBeDefined();
    });

    // Click Accept Suggestion
    const acceptBtn = screen.getByRole('button', { name: /Accept/i });
    act(() => {
      fireEvent.click(acceptBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/✓ Category Selected/i)).toBeDefined();
    });
  });

  test('23. Form submission includes ai_analysis payload when accepted', async () => {
    let capturedSubmitBody = null;
    const multimodalOutput = {
      issue_category: 'Drainage and sewage',
      issue_subcategory: 'Clogged storm drain',
      description_summary: 'Storm drain clogged with black wastewater overflowing onto footpath.',
      severity: 'High',
      detected_objects: ['drain grate', 'sewage'],
      visible_evidence: ['dark wastewater overflowing drain'],
      potential_public_safety_risk: 'Biological contamination risk.',
      recommended_department: 'Drainage and Sewerage',
      confidence_score: 93,
      additional_information_required: [],
      suggestedCategory: 'Drainage and Sewerage',
    };

    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ wards: [{ id: 'ward-1', ward_number: 1, name: 'Indiranagar', zone: 'East' }] }),
        });
      }
      if (url.includes('/api/complaints/analyze')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => multimodalOutput,
        });
      }
      if (url.includes('/api/complaints') && opts?.method === 'POST') {
        capturedSubmitBody = opts.body;
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            message: 'Complaint submitted successfully',
            complaint: { ticket_number: 'CM-2026-99999', title: 'Clogged storm drain' },
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText(/Deep crater pothole/i), {
      target: { value: 'Clogged storm drain on 5th cross' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Provide complete details/i), {
      target: { value: 'Storm drain has been completely blocked with sewage for three days.' },
    });
    fireEvent.change(screen.getByPlaceholderText(/100ft Road/i), {
      target: { value: '5th Cross, Koramangala' },
    });

    // Run analysis
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Suggest Category & Summary/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Drainage and sewage')).toBeDefined();
    });

    // Submit complaint
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Submit Civic Complaint/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Complaint Submitted Successfully!')).toBeDefined();
    });

    expect(capturedSubmitBody instanceof FormData).toBe(true);
    const rawAiAnalysis = capturedSubmitBody.get('ai_analysis');
    expect(rawAiAnalysis).toBeDefined();
    const parsed = JSON.parse(rawAiAnalysis);
    expect(parsed.issue_category).toBe('Drainage and sewage');
  });

  test('24. Semantic Duplicate Detection: Displays "Similar issues already reported near this location" and allows linking', async () => {
    let capturedSubmitBody = null;
    const mockDuplicateCandidates = [
      {
        id: 'cmp-existing-1',
        ticket_number: 'CM-2026-10101',
        category: 'Roads and Infrastructure',
        title: 'Massive pothole near railway station',
        description: 'Vehicles struggling on deep crater near station gate 2.',
        address: 'Station Road',
        landmark: 'Near Station',
        created_at: '2026-11-20T10:00:00Z',
        status: 'In Progress',
        support_count: 4,
        distance_meters: 35,
        similarity_score: 92,
        similarity_level: 'high',
        reasoning: 'Both describe the same road pothole outside railway station.',
        infrastructure_type: 'Asphalt road',
        nature_of_damage: 'Deep crater',
      },
    ];

    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ wards: [{ id: 'ward-1', ward_number: 1, name: 'Indiranagar', zone: 'East' }] }),
        });
      }
      if (url.includes('/api/complaints/check-duplicates')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            duplicate_found: true,
            candidates_count: 1,
            duplicates: mockDuplicateCandidates,
          }),
        });
      }
      if (url.includes('/api/complaints') && opts?.method === 'POST') {
        capturedSubmitBody = opts.body;
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            message: 'Complaint submitted successfully',
            complaint: { ticket_number: 'CM-2026-88888', title: 'Road outside station has huge hole' },
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);

    // Section title is present
    expect(screen.getByText('Similar issues already reported near this location')).toBeDefined();

    // Fill valid form
    fireEvent.change(screen.getByPlaceholderText(/Deep crater pothole/i), {
      target: { value: 'Road outside station has huge hole' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Provide complete details/i), {
      target: { value: 'Very dangerous pothole at the station exit gate.' },
    });
    fireEvent.change(screen.getByPlaceholderText(/100ft Road/i), {
      target: { value: 'Station Road, Indiranagar' },
    });

    // Click "Check Nearby Reports"
    const checkBtn = screen.getByRole('button', { name: /Check Nearby Reports/i });
    act(() => {
      fireEvent.click(checkBtn);
    });

    // Verify candidate card rendered
    await waitFor(() => {
      expect(screen.getByText('CM-2026-10101')).toBeDefined();
      expect(screen.getByText('Strong Match (92%)')).toBeDefined();
      expect(screen.getByText('35m away')).toBeDefined();
      expect(screen.getByText('This is the same issue')).toBeDefined();
    });

    // Click "This is the same issue"
    const linkBtn = screen.getByRole('button', { name: /This is the same issue/i });
    act(() => {
      fireEvent.click(linkBtn);
    });

    // Verify visual confirmation banner appears
    await waitFor(() => {
      expect(screen.getByText(/Confirmed: Your photos and notes will be submitted as supporting evidence for ticket CM-2026-10101/i)).toBeDefined();
    });

    // Submit complaint
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Submit Civic Complaint/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Complaint Submitted Successfully!')).toBeDefined();
    });

    // Verify duplicate_of_id was included in FormData
    expect(capturedSubmitBody instanceof FormData).toBe(true);
    expect(capturedSubmitBody.get('duplicate_of_id')).toBe('cmp-existing-1');
  });

  test('25. Semantic Duplicate Detection: Dismiss candidate as separate issue', async () => {
    const mockDuplicateCandidates = [
      {
        id: 'cmp-existing-2',
        ticket_number: 'CM-2026-20202',
        category: 'Street Lighting',
        title: 'Broken lamp fixture',
        description: 'Dark area at corner.',
        address: '5th cross',
        created_at: '2026-11-21T10:00:00Z',
        status: 'Submitted',
        support_count: 1,
        distance_meters: 50,
        similarity_score: 65,
        similarity_level: 'medium',
        reasoning: 'Related lighting issue nearby.',
      },
    ];

    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/meta/wards')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ wards: [{ id: 'ward-1', ward_number: 1, name: 'Indiranagar', zone: 'East' }] }),
        });
      }
      if (url.includes('/api/complaints/check-duplicates')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            duplicate_found: true,
            candidates_count: 1,
            duplicates: mockDuplicateCandidates,
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<NewComplaintModal onClose={() => {}} onSuccess={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText(/Deep crater pothole/i), {
      target: { value: 'Completely different issue' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Provide complete details/i), {
      target: { value: 'Another unrelated street problem description.' },
    });

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Check Nearby Reports/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('CM-2026-20202')).toBeDefined();
    });

    // Dismiss candidate
    const dismissBtn = screen.getByRole('button', { name: /Report as Separate Issue/i });
    act(() => {
      fireEvent.click(dismissBtn);
    });

    // Candidate card should disappear
    await waitFor(() => {
      expect(screen.queryByText('CM-2026-20202')).toBeNull();
    });
  });
});
