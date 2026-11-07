import { useOutletContext } from 'react-router'

/** Username of the signed-in admin, provided by RequireAuth through the router outlet. */
export const useCurrentAdmin = () => useOutletContext<string>()
