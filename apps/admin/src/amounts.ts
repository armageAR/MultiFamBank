/** The value of an <input type="datetime-local"> as an ISO instant, or null when empty. */
export function localToIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}
