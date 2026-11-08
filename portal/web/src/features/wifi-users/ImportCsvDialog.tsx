import { CircleAlert, CircleCheck, Download, FileSpreadsheet, TriangleAlert } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { errorMessage } from '@/api/client'
import type { ImportResult } from '@/api/types'
import { CopyButton } from '@/components/common/CopyButton'
import { FormField } from '@/components/common/FormField'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadText, toCsv } from '@/lib/csv'
import { DEFAULT_DEVICE_LIMIT, ID_LABEL } from '@/lib/person'
import { cn } from '@/lib/utils'
import { useImportWifiUsers } from './api'
import { DeviceLimitPicker } from './DeviceLimitPicker'
import { ExpiryPicker } from './ExpiryPicker'

const MAX_FILE_BYTES = 1_000_000
const TEMPLATE = toCsv([
  ['Student ID', 'First Name', 'Last Name', 'UMindanao Email', 'Password'],
  ['123456', 'Juan', 'Dela Cruz', 'j.delacruz.123456@umindanao.edu.ph', ''],
])

interface Props {
  open: boolean
  onClose: () => void
}

/** Pick a file → check it (nothing is added) → add everyone → show and download the passwords once. */
export function ImportCsvDialog({ open, onClose }: Props) {
  const importer = useImportWifiUsers()
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<{ name: string; text: string } | null>(null)
  const [fileError, setFileError] = useState('')
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [deviceLimit, setDeviceLimit] = useState<number | null>(DEFAULT_DEVICE_LIMIT)
  const [checked, setChecked] = useState<ImportResult | null>(null)
  const [added, setAdded] = useState<ImportResult | null>(null)
  const [pickerKey, setPickerKey] = useState(0)

  const close = () => {
    setFile(null)
    setFileError('')
    setExpiresAt(null)
    setDeviceLimit(DEFAULT_DEVICE_LIMIT)
    setChecked(null)
    setAdded(null)
    setPickerKey((k) => k + 1)
    importer.reset()
    onClose()
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    e.target.value = '' // so choosing the same (fixed) file again fires onChange
    setChecked(null)
    importer.reset()
    if (!picked) return
    if (picked.size > MAX_FILE_BYTES) {
      setFile(null)
      setFileError('That file is larger than 1 MB. Split it into smaller files.')
      return
    }
    try {
      setFile({ name: picked.name, text: await picked.text() })
      setFileError('')
    } catch {
      setFile(null)
      setFileError('Couldn’t read that file. Save it as CSV and try again.')
    }
  }

  const run = (dryRun: boolean) => {
    if (!file) return
    importer.mutate(
      { csv: file.text, expires_at: expiresAt, device_limit: deviceLimit, dry_run: dryRun },
      { onSuccess: (result) => (dryRun ? setChecked(result) : setAdded(result)) },
    )
  }

  const downloadPasswords = () => {
    if (!added) return
    const rows = added.rows.map((r) => [r.username, r.first_name, r.last_name, r.email, r.password ?? ''])
    downloadText('wifi-passwords.csv', toCsv([[ID_LABEL, 'First Name', 'Last Name', 'Email', 'Password'], ...rows], [4]))
  }

  const busy = importer.isPending

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && !added && close()}>
      <DialogContent className="sm:max-w-3xl" onInteractOutside={(e) => added && e.preventDefault()}>
        {added ? (
          <>
            <DialogHeader>
              <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-success/10 text-success" aria-hidden>
                <CircleCheck className="size-5" />
              </div>
              <DialogTitle>{added.added} Wi-Fi {added.added === 1 ? 'user' : 'users'} added</DialogTitle>
              <DialogDescription>
                These passwords won’t be shown again. Download them now and give each person their own.
              </DialogDescription>
            </DialogHeader>
            <RowsTable result={added} showPasswords />
            <DialogFooter>
              <Button variant="outline" onClick={close}>Done</Button>
              <Button onClick={downloadPasswords}><Download /> Download passwords (CSV)</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Import Wi-Fi users from CSV</DialogTitle>
              <DialogDescription>
                One person per row. Columns: {ID_LABEL}, First Name, Last Name, UMindanao Email, and optionally
                Password (left empty, one is made up). In Excel use <b>Save As → CSV UTF-8</b>.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5">
              <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center">
                <FileSpreadsheet className="size-8 shrink-0 text-muted-foreground" aria-hidden />
                <div className="grid min-w-0 flex-1">
                  <span className="truncate font-medium">{file ? file.name : 'No file chosen'}</span>
                  <span className="text-xs text-muted-foreground">CSV, up to 1 MB and 1000 people</span>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => downloadText('wifi-users-template.csv', TEMPLATE)}>
                    <Download /> Template
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={busy}>
                    {file ? 'Choose another' : 'Choose file'}
                  </Button>
                </div>
                <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile}
                  aria-label="CSV file" />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Access expires" hint="Applies to everyone in the file.">
                  <ExpiryPicker key={pickerKey} value={expiresAt} onChange={(v) => { setExpiresAt(v); setChecked(null) }} />
                </FormField>
                <FormField label="Device limit" hint="Applies to everyone in the file.">
                  <DeviceLimitPicker value={deviceLimit} onChange={(v) => { setDeviceLimit(v); setChecked(null) }} />
                </FormField>
              </div>

              {(fileError || importer.isError) && (
                <Alert variant="destructive">
                  <CircleAlert />
                  <AlertDescription>{fileError || errorMessage(importer.error)}</AlertDescription>
                </Alert>
              )}

              {checked && (
                checked.error_count > 0 ? (
                  <Alert variant="destructive">
                    <TriangleAlert />
                    <AlertTitle>{checked.error_count} of {checked.rows.length} rows need fixing</AlertTitle>
                    <AlertDescription>Nobody was added. Fix these rows in the file, then choose it again.</AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <CircleCheck />
                    <AlertTitle>All {checked.rows.length} rows look good</AlertTitle>
                    <AlertDescription>Nobody has been added yet. Review the list, then add them.</AlertDescription>
                  </Alert>
                )
              )}
              {checked && <RowsTable result={checked} />}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={busy}>Cancel</Button>
              {checked && checked.error_count === 0 ? (
                <Button onClick={() => run(false)} disabled={busy}>
                  {busy ? 'Adding…' : `Add ${checked.rows.length} ${checked.rows.length === 1 ? 'user' : 'users'}`}
                </Button>
              ) : (
                <Button onClick={() => run(true)} disabled={busy || !file}>{busy ? 'Checking…' : 'Check file'}</Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function RowsTable({ result, showPasswords = false }: { result: ImportResult; showPasswords?: boolean }) {
  // Rows with problems first, so they're visible without scrolling.
  const rows = showPasswords ? result.rows : [...result.rows].sort((a, b) => Number(b.errors.length > 0) - Number(a.errors.length > 0))
  return (
    <div className="max-h-80 overflow-auto rounded-lg border">
      <Table>
        <TableHeader className="sticky top-0 bg-background">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-14 pl-3">Line</TableHead>
            <TableHead>ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>{showPasswords ? 'Password' : 'Email / problems'}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.line} className={cn(r.errors.length > 0 && 'bg-destructive/5')}>
              <TableCell className="pl-3 tabular-nums text-muted-foreground">{r.line}</TableCell>
              <TableCell className="font-mono text-xs">{r.username || '—'}</TableCell>
              <TableCell className="max-w-48 truncate">{`${r.first_name} ${r.last_name}`.trim() || '—'}</TableCell>
              <TableCell className="whitespace-normal">
                {showPasswords ? (
                  <div className="flex items-center gap-1">
                    <code className="font-mono text-sm">{r.password}</code>
                    {r.password && <CopyButton value={r.password} label={`Copy password of ${r.username}`} />}
                  </div>
                ) : r.errors.length > 0 ? (
                  <ul className="space-y-0.5 text-sm text-destructive">{r.errors.map((e) => <li key={e}>{e}</li>)}</ul>
                ) : (
                  <span className="text-muted-foreground">{r.email}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
