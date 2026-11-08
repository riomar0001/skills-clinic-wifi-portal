import { CircleCheck, CircleX, Wifi } from 'lucide-react'
import type { Connection } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime, timeAgo } from '@/lib/format'
import { EmptyState } from './states'

/** Wi-Fi login attempts, newest first: when, accepted or refused, and the device's MAC address. */
export function ConnectionTable({ connections, emptyText = 'No Wi-Fi login attempts yet.' }: { connections: Connection[]; emptyText?: string }) {
  if (connections.length === 0) {
    return <EmptyState icon={<Wifi />} title="Nothing yet">{emptyText}</EmptyState>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-4">When</TableHead>
          <TableHead>Result</TableHead>
          <TableHead className="pr-4">Device</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {connections.map((c, i) => (
          <TableRow key={`${c.at}-${i}`}>
            <TableCell className="pl-4">
              <div className="grid">
                <span>{timeAgo(c.at)}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(c.at)}</span>
              </div>
            </TableCell>
            <TableCell>
              {c.accepted ? (
                <Badge variant="outline" className="gap-1 border-success/30 text-success"><CircleCheck /> Connected</Badge>
              ) : (
                <Badge variant="outline" className="gap-1 border-destructive/30 text-destructive"><CircleX /> Refused</Badge>
              )}
            </TableCell>
            <TableCell className="pr-4 font-mono text-xs text-muted-foreground">{c.device || 'Unknown'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
