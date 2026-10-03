import { useId, type InputHTMLAttributes } from 'react'
import { fieldStyles } from './fieldStyles'
import { useLook } from './look'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
  /** Extra classes for the input itself, e.g. "text-right" for amounts. */
  inputClassName?: string
}

export function TextField({ label, error, hint, id, className = '', inputClassName = '', ...props }: TextFieldProps) {
  const styles = fieldStyles[useLook()]
  const generatedId = useId()
  const inputId = id ?? generatedId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className={className}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <input
        {...props}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${styles.control} ${error ? styles.invalid : styles.valid} ${inputClassName}`}
      />
      {error ? (
        <p id={`${inputId}-error`} className={styles.error}>
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${inputId}-hint`} className={styles.hint}>
            {hint}
          </p>
        )
      )}
    </div>
  )
}
