import { ChevronRight, Plus, Search, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { errorMessage } from '../../api/client'
import type { WifiStatusFilter } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { Badge, Card, EmptyState, ErrorNotice, PageHeader, Spinner } from '../../components/ui/misc'
import { timeAgo } from '../../lib/format'
import { useWifiUsers } from './api'
import { CreateWifiUserDialog } from './CreateWifiUserDialog'
import { CredentialsDialog, type Credentials } from './CredentialsDialog'

const FILTERS: { value: WifiStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'enabled', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
]

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function WifiUsersPage() {
  const [params, setParams] = useSearchParams()
  const status = (FILTERS.some((f) => f.value === params.get('status')) ? params.get('status') : 'all') as WifiStatusFilter
  const [search, setSearch] = useState(params.get('q') ?? '')
  const debouncedSearch = useDebounced(search.trim(), 250)
  const users = useWifiUsers(debouncedSearch, status)
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const creating = params.get('new') === '1'

  const updateParams = (changes: Record<string, string | null>) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(changes)) {
        if (v === null || v === '') next.delete(k)
        else next.set(k, v)
      }
      return next
    }, { replace: true })

  useEffect(() => updateParams({ q: debouncedSearch || null }), [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtering = debouncedSearch !== '' || status !== 'all'

  return (
    <>
      <PageHeader
        title="Wi-Fi users"
        description="People who can join the Wi-Fi with their own username and password."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => updateParams({ new: '1' })}>
            Add Wi-Fi user
          </Button>
        }
      />

      <Card>
        <div className="toolbar">
          <label className="search">
            <Search size={16} aria-hidden />
            <span className="sr-only">Search</span>
            <input
              type="search"
              placeholder="Search by username or name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={64}
            />
          </label>
          <div className="segmented" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={status === f.value ? 'active' : undefined}
                aria-pressed={status === f.value}
                onClick={() => updateParams({ status: f.value === 'all' ? null : f.value })}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {users.isPending ? (
          <Spinner />
        ) : users.isError ? (
          <ErrorNotice message={errorMessage(users.error)} onRetry={() => users.refetch()} />
        ) : users.data.length === 0 ? (
          filtering ? (
            <EmptyState icon={<Search size={22} />} title="No matches">Try a different search or filter.</EmptyState>
          ) : (
            <EmptyState
              icon={<Users size={22} />}
              title="No Wi-Fi users yet"
              action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => updateParams({ new: '1' })}>Add the first one</Button>}
            >
              Add a person to give them their own Wi-Fi login.
            </EmptyState>
          )
        ) : (
          <ul className="list" aria-busy={users.isFetching || undefined}>
            {users.data.map((u) => (
              <li key={u.username}>
                <Link to={`/wifi-users/${encodeURIComponent(u.username)}`} className="list-row">
                  <span className="avatar" aria-hidden>{(u.full_name || u.username).charAt(0).toUpperCase()}</span>
                  <span className="list-main">
                    <span className="list-title">{u.username}</span>
                    <span className="list-sub">{u.full_name || <span className="muted">No name</span>}</span>
                  </span>
                  <span className="list-meta">
                    {u.enabled ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Disabled</Badge>}
                    <span className="muted small hide-sm">Updated {timeAgo(u.updated_at)}</span>
                  </span>
                  <ChevronRight size={18} className="list-chevron" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CreateWifiUserDialog open={creating} onClose={() => updateParams({ new: null })} onCreated={setCredentials} />
      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </>
  )
}
