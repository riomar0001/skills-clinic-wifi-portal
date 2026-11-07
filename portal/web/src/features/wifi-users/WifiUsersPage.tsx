import { Ban, CircleCheck, Eye, MoreHorizontal, Plus, Search, Trash2, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { errorMessage } from '@/api/client'
import type { WifiStatusFilter, WifiUser } from '@/api/types'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorAlert, ListSkeleton } from '@/components/common/states'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDateTime, timeAgo } from '@/lib/format'
import { useDeleteWifiUser, useSetWifiEnabled, useWifiUsers } from './api'
import { CreateWifiUserDialog } from './CreateWifiUserDialog'
import { CredentialsDialog, type Credentials } from './CredentialsDialog'
import { UserAvatar } from './UserAvatar'

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
  const statusParam = params.get('status')
  const status: WifiStatusFilter = statusParam === 'enabled' || statusParam === 'disabled' ? statusParam : 'all'
  const [search, setSearch] = useState(params.get('q') ?? '')
  const debouncedSearch = useDebounced(search.trim(), 250)
  const users = useWifiUsers(debouncedSearch, status)
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [toDelete, setToDelete] = useState<WifiUser | null>(null)
  const setEnabled = useSetWifiEnabled()
  const remove = useDeleteWifiUser()
  const navigate = useNavigate()
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

  const onSearch = (value: string) => {
    setSearch(value)
    updateParams({ q: value.trim() || null })
  }

  const toggle = (u: WifiUser) =>
    setEnabled.mutate(
      { username: u.username, enabled: !u.enabled },
      {
        onSuccess: () => toast.success(u.enabled ? `${u.username} is disabled` : `${u.username} can join again`),
        onError: (err) => toast.error(errorMessage(err)),
      },
    )

  const filtering = debouncedSearch !== '' || status !== 'all'
  const openNew = () => updateParams({ new: '1' })

  return (
    <>
      <PageHeader
        title="Wi-Fi users"
        description="People who can join the Wi-Fi with their own username and password."
        actions={<Button onClick={openNew}><Plus /> Add Wi-Fi user</Button>}
      />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <InputGroup className="sm:max-w-xs">
            <InputGroupAddon><Search /></InputGroupAddon>
            <InputGroupInput type="search" placeholder="Search name or username" aria-label="Search Wi-Fi users"
              value={search} onChange={(e) => onSearch(e.target.value)} maxLength={64} />
          </InputGroup>
          <Tabs value={status} onValueChange={(v) => updateParams({ status: v === 'all' ? null : v })}>
            <TabsList>
              {FILTERS.map((f) => <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>)}
            </TabsList>
          </Tabs>
        </div>

        {users.isPending ? (
          <ListSkeleton />
        ) : users.isError ? (
          <div className="p-4"><ErrorAlert message={errorMessage(users.error)} onRetry={() => users.refetch()} /></div>
        ) : users.data.length === 0 ? (
          filtering ? (
            <EmptyState icon={<Search />} title="No matches">Try a different search or filter.</EmptyState>
          ) : (
            <EmptyState icon={<Users />} title="No Wi-Fi users yet" action={<Button onClick={openNew}><Plus /> Add the first one</Button>}>
              Add a person to give them their own Wi-Fi login.
            </EmptyState>
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Note</TableHead>
                <TableHead className="hidden sm:table-cell">Updated</TableHead>
                <TableHead className="w-12 pr-4"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody aria-busy={users.isFetching || undefined}>
              {users.data.map((u) => (
                <TableRow key={u.username} className="cursor-pointer" onClick={() => navigate(`/wifi-users/${encodeURIComponent(u.username)}`)}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar username={u.username} fullName={u.full_name} />
                      <div className="grid min-w-0">
                        <Link to={`/wifi-users/${encodeURIComponent(u.username)}`} className="truncate font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}>
                          {u.username}
                        </Link>
                        <span className="truncate text-xs text-muted-foreground">{u.full_name || 'No name'}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge enabled={u.enabled} /></TableCell>
                  <TableCell className="hidden max-w-64 truncate text-muted-foreground md:table-cell">{u.note || '—'}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell" title={formatDateTime(u.updated_at)}>{timeAgo(u.updated_at)}</TableCell>
                  <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.username}`}><MoreHorizontal /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/wifi-users/${encodeURIComponent(u.username)}`}><Eye /> View details</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => toggle(u)}>
                          {u.enabled ? <><Ban /> Disable access</> : <><CircleCheck /> Enable access</>}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(u)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <CreateWifiUserDialog open={creating} onClose={() => updateParams({ new: null })} onCreated={setCredentials} />
      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Delete ${toDelete?.username ?? ''}?`}
        description="Their login is removed for good. To pause access instead, disable the account."
        confirmLabel="Delete user"
        destructive
        busy={remove.isPending}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.username, {
            onSuccess: () => {
              toast.success(`${toDelete.username} was deleted`)
              setToDelete(null)
            },
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </>
  )
}
