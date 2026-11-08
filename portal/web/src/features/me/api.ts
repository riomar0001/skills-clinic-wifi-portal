import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Connection, Me } from '@/api/types'
import { authKeys } from '../auth/api'

const meKeys = {
  me: ['me'] as const,
  connections: ['me', 'connections'] as const,
}

export function useMe() {
  return useQuery({ queryKey: meKeys.me, queryFn: () => api.get<Me>('/api/me') })
}

export function useMyConnections() {
  return useQuery({
    queryKey: meKeys.connections,
    queryFn: () => api.get<Connection[]>('/api/me/connections?limit=100'),
    refetchInterval: 30_000,
  })
}

export function useUpdateMe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { first_name: string; last_name: string; email: string }) => api.patch<Me>('/api/me', body),
    onSuccess: (me) => {
      qc.setQueryData(meKeys.me, me)
      return qc.invalidateQueries({ queryKey: authKeys.status }) // the greeting uses the name
    },
  })
}

export function useChangeMyPassword() {
  return useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) => api.put<void>('/api/me/password', body),
  })
}
