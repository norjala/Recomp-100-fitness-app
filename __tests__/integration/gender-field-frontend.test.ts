// Gender Field Frontend Integration Tests - React component behavior testing
import { describe, test, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import Upload from '../../client/src/pages/upload';
import MyScans from '../../client/src/pages/my-scans';

// Mock API calls
const mockApiRequest = vi.fn();
vi.mock('../../client/src/lib/queryClient', () => ({
  apiRequest: mockApiRequest,
}));

// Mock auth hook
const mockUseAuth = vi.fn();
vi.mock('../../client/src/hooks/use-auth', () => ({
  useAuth: mockUseAuth,
}));

// Mock toast hook
const mockToast = vi.fn();
vi.mock('../../client/src/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Gender Field Frontend Integration Tests', () => {
  let user: any;
  let queryClient: QueryClient;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create fresh query client
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Setup default user auth
    user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: {
        id: 'test-user-id',
        username: 'jaron',
        email: 'jaron@test.com',
      },
      isLoading: false,
    });
  });

  describe('Upload Page Gender Field Visibility', () => {
    test('should show gender field when user has null gender', async () => {
      // Mock user profile with null gender
      mockApiRequest.mockImplementation((method, url) => {
        if (url === '/api/user') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'test-user-id',
              username: 'jaron',
              gender: null, // NULL gender - should show field
              name: 'Jaron Parnala',
            }),
          });
        }
        if (url.includes('/api/users/test-user-id/scans')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]), // No existing scans
          });
        }
        return Promise.reject(new Error('Unexpected API call'));
      });

      render(
        <TestWrapper>
          <Upload />
        </TestWrapper>
      );

      // Wait for component to load and data to be fetched
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('GET', '/api/user');
      });

      // Gender field should be visible
      await waitFor(() => {
        const genderField = screen.getByLabelText(/gender/i);
        expect(genderField).toBeInTheDocument();
      });

      // Verify debug information is displayed
      expect(screen.getByText(/UPLOAD DEBUG PANEL/)).toBeInTheDocument();
      expect(screen.getByText(/userProfile.gender: null/)).toBeInTheDocument();
    });

    test('should hide gender field when user already has gender set', async () => {
      // Mock user profile with existing gender
      mockApiRequest.mockImplementation((method, url) => {
        if (url === '/api/user') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'test-user-id',
              username: 'jaron',
              gender: 'male', // Gender already set - should hide field
              name: 'Jaron Parnala',
            }),
          });
        }
        if (url.includes('/api/users/test-user-id/scans')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              { id: 'scan-1', scanDate: '2024-01-01' }, // Has existing scans
            ]),
          });
        }
        return Promise.reject(new Error('Unexpected API call'));
      });

      render(
        <TestWrapper>
          <Upload />
        </TestWrapper>
      );

      // Wait for component to load
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('GET', '/api/user');
      });

      // Gender field should NOT be visible
      await waitFor(() => {
        const genderField = screen.queryByLabelText(/gender/i);
        expect(genderField).not.toBeInTheDocument();
      });
    });

    test('should show gender field for first scan even if user has gender', async () => {
      // Mock user profile with gender but no scans (first scan scenario)
      mockApiRequest.mockImplementation((method, url) => {
        if (url === '/api/user') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'test-user-id',
              username: 'jaron',
              gender: 'male',
              name: 'Jaron Parnala',
            }),
          });
        }
        if (url.includes('/api/users/test-user-id/scans')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]), // No existing scans - first scan
          });
        }
        return Promise.reject(new Error('Unexpected API call'));
      });

      render(
        <TestWrapper>
          <Upload />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('GET', '/api/user');
      });

      // Gender field should be visible for first scan
      await waitFor(() => {
        const genderField = screen.getByLabelText(/gender/i);
        expect(genderField).toBeInTheDocument();
      });
    });

    test('should force show gender field when debug button is clicked', async () => {
      // Mock user with existing gender (normally would hide field)
      mockApiRequest.mockImplementation((method, url) => {
        if (url === '/api/user') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'test-user-id',
              username: 'jaron',
              gender: 'male',
              name: 'Jaron Parnala',
            }),
          });
        }
        if (url.includes('/api/users/test-user-id/scans')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 'scan-1' }]),
          });
        }
        return Promise.reject(new Error('Unexpected API call'));
      });

      render(
        <TestWrapper>
          <Upload />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('GET', '/api/user');
      });

      // Initially, gender field should not be visible
      expect(screen.queryByLabelText(/gender/i)).not.toBeInTheDocument();

      // Click the debug button to force show
      const debugButton = screen.getByRole('button', { name: /Force Show Gender Field/i });
      await user.click(debugButton);

      // Now gender field should be visible
      await waitFor(() => {
        const genderField = screen.getByLabelText(/gender/i);
        expect(genderField).toBeInTheDocument();
      });
    });
  });

  describe('Gender Field Interaction Tests', () => {
    beforeEach(() => {
      // Mock user with null gender for these tests
      mockApiRequest.mockImplementation((method, url) => {
        if (url === '/api/user') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'test-user-id',
              username: 'jaron',
              gender: null,
              name: 'Jaron Parnala',
            }),
          });
        }
        if (url.includes('/api/users/test-user-id/scans')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          });
        }
        return Promise.reject(new Error('Unexpected API call'));
      });
    });

    test('should update form state when gender is selected', async () => {
      render(
        <TestWrapper>
          <Upload />
        </TestWrapper>
      );

      await waitFor(() => {
        const genderField = screen.getByLabelText(/gender/i);
        expect(genderField).toBeInTheDocument();
      });

      // Open gender dropdown and select male
      const genderSelect = screen.getByRole('combobox');
      await user.click(genderSelect);

      const maleOption = screen.getByRole('option', { name: /male/i });
      await user.click(maleOption);

      // Verify selection is reflected in the form
      expect(genderSelect).toHaveDisplayValue('Male');
    });

    test('should include gender in form submission', async () => {
      // Mock successful form submission
      mockApiRequest.mockImplementation((method, url, data) => {
        if (method === 'POST' && url === '/api/scans') {
          expect(data).toHaveProperty('gender', 'male');
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 'new-scan-id' }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(
        <TestWrapper>
          <Upload />
        </TestWrapper>
      );

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByLabelText(/gender/i)).toBeInTheDocument();
      });

      // Fill required form fields
      await user.type(screen.getByLabelText(/Body Fat/), '15.2');
      await user.type(screen.getByLabelText(/Lean Mass/), '142.5');
      await user.type(screen.getByLabelText(/Total Weight/), '178.0');
      await user.type(screen.getByLabelText(/Fat Mass/), '30.7');

      // Select gender
      const genderSelect = screen.getByRole('combobox');
      await user.click(genderSelect);
      await user.click(screen.getByRole('option', { name: /male/i }));

      // Submit form
      const submitButton = screen.getByRole('button', { name: /Save Scan Data/i });
      await user.click(submitButton);

      // Verify API was called with gender data
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          'POST',
          '/api/scans',
          expect.objectContaining({
            gender: 'male',
          })
        );
      });
    });
  });

  describe('AI Extraction Gender Population', () => {
    test('should populate gender field from AI extraction', async () => {
      // Mock AI extraction response with gender
      mockApiRequest.mockImplementation((method, url, data) => {
        if (method === 'POST' && url === '/api/extract-dexa-data') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              confidence: 0.8,
              bodyFatPercent: 15.2,
              leanMass: 142.5,
              totalWeight: 178.0,
              fatMass: 30.7,
              gender: 'male', // AI detected gender
              firstName: 'Jaron',
              lastName: 'Parnala',
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(
        <TestWrapper>
          <Upload />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/gender/i)).toBeInTheDocument();
      });

      // Simulate file upload for extraction
      const fileInput = screen.getByLabelText(/Extract data from scan/);
      const file = new File(['test'], 'scan.png', { type: 'image/png' });

      await user.upload(fileInput, file);

      // Wait for extraction to complete and form to be populated
      await waitFor(() => {
        const genderSelect = screen.getByRole('combobox');
        expect(genderSelect).toHaveDisplayValue('Male');
      });
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle validation errors for invalid gender', async () => {
      render(
        <TestWrapper>
          <Upload />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/gender/i)).toBeInTheDocument();
      });

      // Fill form with invalid data (simulate programmatic invalid gender)
      const formElement = screen.getByRole('form');

      // Simulate invalid form state that would trigger validation error
      fireEvent.submit(formElement);

      // Should see validation error if required fields are missing
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Validation Error',
            variant: 'destructive',
          })
        );
      });
    });

    test('should handle API errors during form submission', async () => {
      // Mock API error
      mockApiRequest.mockImplementation((method, url) => {
        if (method === 'POST' && url === '/api/scans') {
          return Promise.reject(new Error('API Error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(
        <TestWrapper>
          <Upload />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/gender/i)).toBeInTheDocument();
      });

      // Fill and submit form
      await user.type(screen.getByLabelText(/Body Fat/), '15.2');
      await user.type(screen.getByLabelText(/Lean Mass/), '142.5');
      await user.type(screen.getByLabelText(/Total Weight/), '178.0');
      await user.type(screen.getByLabelText(/Fat Mass/), '30.7');

      const submitButton = screen.getByRole('button', { name: /Save Scan Data/i });
      await user.click(submitButton);

      // Should show error toast
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            variant: 'destructive',
          })
        );
      });
    });
  });

  describe('Debug Panel Functionality', () => {
    test('should display comprehensive debug information', async () => {
      mockApiRequest.mockImplementation((method, url) => {
        if (url === '/api/user') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'test-user-id',
              username: 'jaron',
              gender: null,
              name: 'Jaron Parnala',
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      });

      render(
        <TestWrapper>
          <Upload />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/UPLOAD DEBUG PANEL/)).toBeInTheDocument();
      });

      // Verify debug panel shows all required information
      expect(screen.getByText(/userProfile exists: true/)).toBeInTheDocument();
      expect(screen.getByText(/userProfile.gender: null/)).toBeInTheDocument();
      expect(screen.getByText(/isFirstScan: true/)).toBeInTheDocument();
      expect(screen.getByText(/formData.gender:/)).toBeInTheDocument();
    });

    test('should update debug panel when form state changes', async () => {
      render(
        <TestWrapper>
          <Upload />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/gender/i)).toBeInTheDocument();
      });

      // Select gender and verify debug panel updates
      const genderSelect = screen.getByRole('combobox');
      await user.click(genderSelect);
      await user.click(screen.getByRole('option', { name: /male/i }));

      // Debug panel should reflect the updated form data
      await waitFor(() => {
        expect(screen.getByText(/formData.gender: male/)).toBeInTheDocument();
      });
    });
  });
});