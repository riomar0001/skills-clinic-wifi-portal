/**
 * Builds CSV text. Cells a spreadsheet would run as a formula (=, +, -, @) get a leading ' so they stay text,
 * except in exactColumns (e.g. passwords, which must come out exactly as they are).
 */
export function toCsv(rows: string[][], exactColumns: number[] = []): string {
  const cell = (value: string, column: number) => {
    const safe = !exactColumns.includes(column) && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
    return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
  }
  // BOM so Excel opens it as UTF-8 (names with ñ stay readable).
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
