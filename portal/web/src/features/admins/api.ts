import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Admin } from '../../api/types'

const adminKeys = { all: ['admins'] as const }

export function useAdmins() {
  return useQuery({ queryKey: adminKeys.all, queryFn: () => api.get<Admin[]>('/api/admins') })
}

function useRefresh() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: adminKeys.all }),
      qc.invalidateQueries({ queryKey: ['dashboard'] }),
      qc.invalidateQueries({ queryKey: ['activity'] }),
    ])
}

export function useCreateAdmin() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (body: { username: string; password: string }) => api.post<Admin>('/api/admins', body),
    onSuccess: refresh,
  })
}

export function useDeleteAdmin() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (username: string) => api.delete<void>(`/api/admins/${encodeURIComponent(username)}`),
    onSuccess: refresh,
  })
}

export function useChangeMyPassword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) => api.put<void>('/api/account/password', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activity'] }),
  })
}
