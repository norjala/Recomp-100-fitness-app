// Frontend hook testing example - useAuth hook functionality
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { ReactNode } from 'react';

// Mock the API request function
vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn()
}));

describe('useAuth Hook - Frontend Authentication', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );

  test('should initialize with loading state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  test('should provide authentication methods', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(typeof result.current.login).toBe('function');
    expect(typeof result.current.logout).toBe('function');
    expect(typeof result.current.register).toBe('function');
  });

  test('should handle successful login', async () => {
    const { apiRequest } = await import('@/lib/queryClient');
    const mockApiRequest = apiRequest as any;
    
    // Mock successful login response
    mockApiRequest.mockResolvedValueOnce({
      json: () => Promise.resolve({
        id: 'user-123',
        username: 'testuser',
        name: 'Test User'
      })
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const loginData = {
      username: 'testuser',
      password: 'password123'
    };

    await result.current.login(loginData);

    await waitFor(() => {
      expect(result.current.user).toBeDefined();
      expect(result.current.user?.username).toBe('testuser');
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  test('should handle login failure', async () => {
    const { apiRequest } = await import('@/lib/queryClient');
    const mockApiRequest = apiRequest as any;
    
    // Mock failed login response
    mockApiRequest.mockRejectedValueOnce(new Error('Invalid credentials'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const loginData = {
      username: 'wronguser',
      password: 'wrongpassword'
    };

    await expect(result.current.login(loginData)).rejects.toThrow('Invalid credentials');
    
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  test('should handle logout correctly', async () => {
    const { apiRequest } = await import('@/lib/queryClient');
    const mockApiRequest = apiRequest as any;
    
    // Mock logout response
    mockApiRequest.mockResolvedValueOnce({
      json: () => Promise.resolve({ message: 'Logged out successfully' })
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Set initial authenticated state
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.logout();

    await waitFor(() => {
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});