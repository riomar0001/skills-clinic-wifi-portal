import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { AuthStatus } from '../../api/types'

export const authKeys = {
  status: ['auth', 'status'] as const,
}

export function useAuthStatus() {
  return useQuery({
    queryKey: authKeys.status,
    queryFn: () => api.get<AuthStatus>('/api/auth/status'),
    staleTime: 60_000,
  })
}

/** After signing in or out, drop every cached response so nothing leaks between accounts. */
function useStartFresh() {
  const qc = useQueryClient()
  return (status: AuthStatus) => {
    qc.clear()
    qc.setQueryData(authKeys.status, status)
  }
}

export function useLogin() {
  const startFresh = useStartFresh()
  return useMutation({
    mutationFn: (body: { username: string; password: string }) => api.post<AuthStatus>('/api/auth/login', body),
    onSuccess: startFresh,
  })
}

export function useSetup() {
  const startFresh = useStartFresh()
  return useMutation({
    mutationFn: (body: { setup_code: string; username: string; password: string }) =>
      api.post<AuthStatus>('/api/auth/setup', body),
    onSuccess: startFresh,
  })
}

export function useLogout() {
  const startFresh = useStartFresh()
  return useMutation({
    mutationFn: () => api.post<void>('/api/auth/logout'),
    onSettled: () => startFresh({ needs_setup: false, admin: null }),
  })
}
