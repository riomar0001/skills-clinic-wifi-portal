import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { AccessRequest, WifiUser } from '../../api/types'
import { wifiKeys } from '../wifi-users/api'

const requestKeys = { all: ['access-requests'] as const }

export interface AccessRequestForm {
  username: string
  password: string
  first_name: string
  last_name: string
  email: string
}

/** Public: from the sign-in page. */
export function useSubmitAccessRequest() {
  return useMutation({
    mutationFn: (body: AccessRequestForm) => api.post<{ username: string }>('/api/access-requests', body),
  })
}

/** Admins: requests waiting for review. Polled so the sidebar count stays current. */
export function useAccessRequests() {
  return useQuery({
    queryKey: requestKeys.all,
    queryFn: () => api.get<AccessRequest[]>('/api/access-requests'),
    refetchInterval: 30_000,
  })
}

function useRefresh() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: requestKeys.all }),
      qc.invalidateQueries({ queryKey: wifiKeys.all }),
      qc.invalidateQueries({ queryKey: ['dashboard'] }),
      qc.invalidateQueries({ queryKey: ['activity'] }),
    ])
}

export function useApproveAccessRequest() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; expires_at: number | null; device_limit: number | null }) =>
      api.post<WifiUser>(`/api/access-requests/${id}/approve`, body),
    onSuccess: refresh,
  })
}

export function useRejectAccessRequest() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/api/access-requests/${id}`),
    onSuccess: refresh,
  })
}
