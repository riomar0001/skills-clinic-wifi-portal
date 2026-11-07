import { useId, type ReactElement, type ReactNode } from 'react'
import { cloneElement, isValidElement } from 'react'
import { Label } from '@/components/ui/label'

interface FormFieldProps {
  label: string
  hint?: ReactNode
  error?: string
  /** A single input-like element; it gets the id and aria attributes. */
  children: ReactElement<Record<string, unknown>>
}

export function FormField({ label, hint, error, children }: FormFieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': hint || error ? messageId : undefined,
      })
    : children

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {control}
      {error ? (
        <p id={messageId} className="text-sm font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
