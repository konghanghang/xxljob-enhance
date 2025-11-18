import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { AuthProvider, useAuth } from '../AuthContext';
import { authApi } from '../../api/services';
import type { UserInfo, LoginRequest } from '../../types/api';

// Mock the API
vi.mock('../../api/services', () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn(),
    getProfile: vi.fn(),
  },
}));

describe('useAuth Hook', () => {
  const mockUser: UserInfo = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    isAdmin: false,
  };

  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage properly
    localStorage.clear();
    // Reset mocks to default behavior
    vi.mocked(authApi.getProfile).mockReset();
    vi.mocked(authApi.login).mockReset();
    vi.mocked(authApi.logout).mockReset();
  });

  describe('Initial State', () => {
    it('should start with no user when no token in localStorage', async () => {
      vi.mocked(authApi.getProfile).mockRejectedValue(new Error('No token'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should load user profile if valid token exists', async () => {
      localStorage.setItem('accessToken', 'valid-token');
      vi.mocked(authApi.getProfile).mockResolvedValue({ data: mockUser } as any);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(
        () => {
          expect(result.current.user).toEqual(mockUser);
        },
        { timeout: 3000 }
      );

      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should clear storage if token is invalid', async () => {
      localStorage.setItem('accessToken', 'invalid-token');
      localStorage.setItem('refreshToken', 'invalid-refresh');
      vi.mocked(authApi.getProfile).mockRejectedValue(new Error('Invalid token'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      expect(result.current.user).toBeNull();
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });
  });

  describe('login', () => {
    it('should login successfully and store tokens', async () => {
      const credentials: LoginRequest = {
        username: 'testuser',
        password: 'password123',
      };

      const loginResponse = {
        data: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          user: mockUser,
        },
      };

      vi.mocked(authApi.login).mockResolvedValue(loginResponse as any);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      await act(async () => {
        await result.current.login(credentials);
      });

      expect(authApi.login).toHaveBeenCalledWith(credentials);
      expect(localStorage.getItem('accessToken')).toBe('new-access-token');
      expect(localStorage.getItem('refreshToken')).toBe('new-refresh-token');
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should throw error when login fails', async () => {
      const credentials: LoginRequest = {
        username: 'testuser',
        password: 'wrongpassword',
      };

      const error = new Error('Invalid credentials');
      vi.mocked(authApi.login).mockRejectedValue(error);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      await expect(
        act(async () => {
          await result.current.login(credentials);
        })
      ).rejects.toThrow('Invalid credentials');

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should update existing user session when logging in again', async () => {
      // First login
      localStorage.setItem('accessToken', 'old-token');
      vi.mocked(authApi.getProfile).mockResolvedValue({ data: mockUser } as any);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(
        () => {
          expect(result.current.user).toEqual(mockUser);
        },
        { timeout: 3000 }
      );

      // Second login with different user
      const newUser: UserInfo = {
        id: 2,
        username: 'newuser',
        email: 'new@example.com',
        isAdmin: true,
      };

      vi.mocked(authApi.login).mockResolvedValue({
        data: {
          accessToken: 'new-token',
          refreshToken: 'new-refresh',
          user: newUser,
        },
      } as any);

      await act(async () => {
        await result.current.login({
          username: 'newuser',
          password: 'password',
        });
      });

      expect(result.current.user).toEqual(newUser);
      expect(localStorage.getItem('accessToken')).toBe('new-token');
    });
  });

  describe('logout', () => {
    it('should logout successfully and clear storage', async () => {
      localStorage.setItem('accessToken', 'token');
      localStorage.setItem('refreshToken', 'refresh');
      vi.mocked(authApi.getProfile).mockResolvedValue({ data: mockUser } as any);
      vi.mocked(authApi.logout).mockResolvedValue({} as any);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(
        () => {
          expect(result.current.user).toEqual(mockUser);
        },
        { timeout: 3000 }
      );

      await act(async () => {
        await result.current.logout();
      });

      expect(authApi.logout).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });

    it('should clear local state even if API call fails', async () => {
      localStorage.setItem('accessToken', 'token');
      localStorage.setItem('refreshToken', 'refresh');
      vi.mocked(authApi.getProfile).mockResolvedValue({ data: mockUser } as any);
      vi.mocked(authApi.logout).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(
        () => {
          expect(result.current.user).toEqual(mockUser);
        },
        { timeout: 3000 }
      );

      await act(async () => {
        await result.current.logout();
      });

      // Should still clear local state
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(localStorage.getItem('accessToken')).toBeNull();
    });

    it('should handle logout when already logged out', async () => {
      vi.mocked(authApi.logout).mockResolvedValue({} as any);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('refreshProfile', () => {
    it('should refresh user profile successfully', async () => {
      localStorage.setItem('accessToken', 'token');
      vi.mocked(authApi.getProfile).mockResolvedValue({ data: mockUser } as any);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(
        () => {
          expect(result.current.user).toEqual(mockUser);
        },
        { timeout: 3000 }
      );

      // Update mock to return updated user data
      const updatedUser = { ...mockUser, email: 'updated@example.com' };
      vi.mocked(authApi.getProfile).mockResolvedValue({ data: updatedUser } as any);

      await act(async () => {
        await result.current.refreshProfile();
      });

      expect(result.current.user).toEqual(updatedUser);
    });

    it('should throw error when refresh fails', async () => {
      localStorage.setItem('accessToken', 'token');
      vi.mocked(authApi.getProfile)
        .mockResolvedValueOnce({ data: mockUser } as any)
        .mockRejectedValueOnce(new Error('Token expired'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(
        () => {
          expect(result.current.user).toEqual(mockUser);
        },
        { timeout: 3000 }
      );

      await expect(
        act(async () => {
          await result.current.refreshProfile();
        })
      ).rejects.toThrow('Token expired');
    });
  });

  describe('Hook Constraints', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Mock console.error to suppress expected error output
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleError.mockRestore();
    });
  });

  describe('Authentication State', () => {
    it('should correctly report isAuthenticated based on user presence', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      // Initially not authenticated
      expect(result.current.isAuthenticated).toBe(false);

      // Login
      vi.mocked(authApi.login).mockResolvedValue({
        data: {
          accessToken: 'token',
          refreshToken: 'refresh',
          user: mockUser,
        },
      } as any);

      await act(async () => {
        await result.current.login({ username: 'test', password: 'pass' });
      });

      expect(result.current.isAuthenticated).toBe(true);

      // Logout
      vi.mocked(authApi.logout).mockResolvedValue({} as any);

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Loading State', () => {
    it('should complete loading and set user after initialization', async () => {
      localStorage.setItem('accessToken', 'token');
      vi.mocked(authApi.getProfile).mockResolvedValue({ data: mockUser } as any);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      expect(result.current.user).toEqual(mockUser);
    });
  });
});
