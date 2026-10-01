/**
 * Accepts amounts as people type them in Argentina: "15000", "15.000", "15.000,50" or "15000.5".
 * Returns a plain decimal string ("15000.50") or null when it is not a number.
 */
export function parseAmount(input: string): string | null {
  let value = input.replace(/[\s$]/g, '')
  if (!value) return null

  if (value.includes(',')) {
    value = value.replace(/\./g, '').replace(',', '.')
  } else if ((value.match(/\./g) ?? []).length > 1 || /\.\d{3}$/.test(value)) {
    value = value.replace(/\./g, '')
  }

  return /^\d+(\.\d{1,4})?$/.test(value) ? value : null
}

/** The value of an <input type="datetime-local"> as an ISO instant, or null when empty. */
export function localToIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}
