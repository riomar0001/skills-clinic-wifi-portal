import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { errorMessage } from '@/api/client'
import type { WifiUser } from '@/api/types'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { fullName } from '@/lib/person'
import { useAdmins } from '../admins/api'
import { usePromoteWifiUser } from './api'

/** Promote a Wi-Fi user to admin: they sign in to the admin portal with their ID and Wi-Fi password. */
export function AdminAccessCard({ user }: { user: WifiUser }) {
  const admins = useAdmins()
  const promote = usePromoteWifiUser()
  const [confirming, setConfirming] = useState(false)
  const isAdmin = admins.data?.some((a) => a.username === user.username) ?? false
  const name = fullName(user) || user.username

  const confirm = () =>
    promote.mutate(user.username, {
      onSuccess: () => toast.success(`${name} is now an admin. They sign in with their ID and Wi-Fi password.`),
      onError: (err) => toast.error(errorMessage(err)),
      onSettled: () => setConfirming(false),
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin access</CardTitle>
        <CardDescription>
          {isAdmin
            ? 'This person can manage the portal. Remove it on the Admins page.'
            : 'Let this person manage the portal. They sign in with their ID and Wi-Fi password.'}
        </CardDescription>
        {isAdmin && <CardAction><Badge variant="secondary"><ShieldCheck /> Admin</Badge></CardAction>}
      </CardHeader>
      <CardFooter>
        {admins.isPending ? (
          <Skeleton className="h-9 w-32" />
        ) : admins.isError ? (
          <span className="text-sm text-destructive">{errorMessage(admins.error)}</span>
        ) : isAdmin ? (
          <Button variant="outline" asChild><Link to="/admins"><ShieldCheck /> Manage admins</Link></Button>
        ) : (
          <Button variant="outline" onClick={() => setConfirming(true)}><ShieldCheck /> Make admin</Button>
        )}
      </CardFooter>
      <ConfirmDialog
        open={confirming}
        title={`Make ${name} an admin?`}
        description={<>
          They can add, change and delete Wi-Fi users and admins, and see the router secret. They sign in with
          ID <span className="font-mono">{user.username}</span> and their current Wi-Fi password; nothing else changes.
        </>}
        confirmLabel="Make admin"
        busy={promote.isPending}
        onConfirm={confirm}
        onOpenChange={setConfirming}
      />
    </Card>
  )
}
