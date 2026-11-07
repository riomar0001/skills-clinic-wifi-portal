import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'

interface FieldShellProps {
  label: string
  hint?: ReactNode
  error?: string
  id: string
  children: ReactNode
}

function FieldShell({ label, hint, error, id, children }: FieldShellProps) {
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">{label}</label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="field-error">{error}</p>
      ) : hint ? (
        <p id={`${id}-msg`} className="field-hint">{hint}</p>
      ) : null}
    </div>
  )
}

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: ReactNode
  error?: string
  addon?: ReactNode
}

export function InputField({ label, hint, error, addon, id, className, ...rest }: InputFieldProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const described = hint || error ? `${fieldId}-msg` : undefined
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId}>
      <div className={`input-group${addon ? ' has-addon' : ''}`}>
        <input
          id={fieldId}
          className={`input${className ? ` ${className}` : ''}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          {...rest}
        />
        {addon}
      </div>
    </FieldShell>
  )
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  hint?: ReactNode
  error?: string
}

export function TextAreaField({ label, hint, error, id, ...rest }: TextAreaFieldProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId}>
      <textarea
        id={fieldId}
        className="input textarea"
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${fieldId}-msg` : undefined}
        {...rest}
      />
    </FieldShell>
  )
}
