import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { ActivityEntry } from '../../api/types'

export function useActivity(limit = 200) {
  return useQuery({
    queryKey: ['activity', limit],
    queryFn: () => api.get<ActivityEntry[]>(`/api/activity?limit=${limit}`),
  })
}
