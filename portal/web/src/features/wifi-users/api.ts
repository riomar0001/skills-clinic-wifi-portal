import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Connection, WifiStatusFilter, WifiUser } from '../../api/types'

export const wifiKeys = {
  all: ['wifi-users'] as const,
  list: (search: string, status: WifiStatusFilter) => ['wifi-users', 'list', { search, status }] as const,
  detail: (username: string) => ['wifi-users', 'detail', username] as const,
}

const path = (username: string) => `/api/wifi-users/${encodeURIComponent(username)}`

export function useWifiUsers(search: string, status: WifiStatusFilter) {
  return useQuery({
    queryKey: wifiKeys.list(search, status),
    queryFn: () => {
      const params = new URLSearchParams({ status })
      if (search) params.set('search', search)
      return api.get<WifiUser[]>(`/api/wifi-users?${params}`)
    },
    placeholderData: keepPreviousData,
  })
}

export function useWifiUserConnections(username: string) {
  return useQuery({
    queryKey: [...wifiKeys.detail(username), 'connections'],
    queryFn: () => api.get<Connection[]>(`${path(username)}/connections?limit=20`),
    refetchInterval: 30_000,
  })
}

export function useWifiUser(username: string) {
  return useQuery({ queryKey: wifiKeys.detail(username), queryFn: () => api.get<WifiUser>(path(username)) })
}

/** Any change can affect lists, counts and the activity log, so refresh them all. */
function useInvalidateAfterChange() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: wifiKeys.all }),
      qc.invalidateQueries({ queryKey: ['dashboard'] }),
      qc.invalidateQueries({ queryKey: ['activity'] }),
    ])
}

export interface NewWifiUser {
  username: string
  password: string
  first_name: string
  last_name: string
  email: string
  note: string
  expires_at: number | null
}

export function useCreateWifiUser() {
  const invalidate = useInvalidateAfterChange()
  return useMutation({
    mutationFn: (body: NewWifiUser) => api.post<WifiUser>('/api/wifi-users', body),
    onSuccess: invalidate,
  })
}

export function useUpdateWifiUser(username: string) {
  const invalidate = useInvalidateAfterChange()
  return useMutation({
    // expires_at: null removes the expiry; leaving it out keeps it.
    mutationFn: (body: Partial<Pick<WifiUser, 'first_name' | 'last_name' | 'note' | 'enabled' | 'expires_at'> & { email: string }>) =>
      api.patch<WifiUser>(path(username), body),
    onSuccess: invalidate,
  })
}

/** Enable or disable any user (row actions in the list). */
export function useSetWifiEnabled() {
  const invalidate = useInvalidateAfterChange()
  return useMutation({
    mutationFn: ({ username, enabled }: { username: string; enabled: boolean }) =>
      api.patch<WifiUser>(path(username), { enabled }),
    onSuccess: invalidate,
  })
}

export function useSetWifiPassword(username: string) {
  const invalidate = useInvalidateAfterChange()
  return useMutation({
    mutationFn: (password: string) => api.put<void>(`${path(username)}/password`, { password }),
    onSuccess: invalidate,
  })
}

export function useDeleteWifiUser() {
  const qc = useQueryClient()
  const invalidate = useInvalidateAfterChange()
  return useMutation({
    mutationFn: (username: string) => api.delete<void>(path(username)),
    onSuccess: (_, username) => {
      qc.removeQueries({ queryKey: wifiKeys.detail(username) })
      return invalidate()
    },
  })
}
