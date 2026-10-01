import { useId, type SelectHTMLAttributes } from 'react'
import { fieldStyles } from './fieldStyles'
import { useLook } from './look'

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  hint?: string
}

export function SelectField({ label, error, hint, id, className = '', children, ...props }: SelectFieldProps) {
  const styles = fieldStyles[useLook()]
  const generatedId = useId()
  const selectId = id ?? generatedId
  const describedBy = error || hint ? `${selectId}-help` : undefined

  return (
    <div className={className}>
      <label htmlFor={selectId} className={styles.label}>
        {label}
      </label>
      <select
        {...props}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${styles.control} ${error ? styles.invalid : styles.valid}`}
      >
        {children}
      </select>
      {(error || hint) && (
        <p id={`${selectId}-help`} className={error ? styles.error : styles.hint}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}
