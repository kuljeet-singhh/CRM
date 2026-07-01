import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api, bootstrapSession, restoreSession } from '@/lib/api';
import { setAccessToken } from '@/lib/authStore';
import type { Me } from '@/types';

interface AuthResponse {
  user: Me;
  accessToken: string;
}

export function useAuth() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      await restoreSession();
      return api<{ user: Me | null }>('/auth/me');
    },
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  const applyAuth = (data: AuthResponse) => {
    setAccessToken(data.accessToken);
    queryClient.setQueryData(['auth', 'me'], { user: data.user });
  };

  const register = async (email: string, password: string, name?: string) => {
    const data = await api<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    applyAuth(data);
    return data.user;
  };

  const login = async (email: string, password: string) => {
    const data = await api<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    applyAuth(data);
    return data.user;
  };

  const captureOAuthToken = async (token: string) => {
    setAccessToken(token);
    await bootstrapSession(token);
    await queryClient.refetchQueries({ queryKey: ['auth', 'me'] });
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setAccessToken(null);
    queryClient.setQueryData(['auth', 'me'], { user: null });
    queryClient.invalidateQueries();
  };

  const isApiReachable = !query.isError;

  return {
    user: query.data?.user ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isAuthenticated: Boolean(query.data?.user),
    isError: query.isError,
    isApiReachable,
    register,
    login,
    captureOAuthToken,
    logout,
    refetch: query.refetch,
  };
}
