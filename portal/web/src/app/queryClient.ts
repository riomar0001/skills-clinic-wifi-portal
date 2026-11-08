import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { SIGNED_OUT, type AuthStatus } from '../api/types'
import { authKeys } from '../features/auth/api'

/** A 401 anywhere means the session ended (expired or signed out elsewhere): show the sign-in page. */
function onError(err: unknown) {
  if (!(err instanceof ApiError) || err.status !== 401) return
  queryClient.setQueryData<AuthStatus>(authKeys.status, (s) => (s?.role ? { ...SIGNED_OUT, needs_setup: s.needs_setup } : s))
}

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      // Client errors won't fix themselves; retry only network and server errors.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
})
