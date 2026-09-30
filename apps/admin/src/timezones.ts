/** Argentine zones first, then every zone the browser knows. */
const preferred = [
  'America/Argentina/Buenos_Aires',
  'America/Argentina/Cordoba',
  'America/Argentina/Mendoza',
  'America/Argentina/Salta',
  'America/Argentina/Ushuaia',
  'America/Montevideo',
  'America/Santiago',
  'America/Sao_Paulo',
]

export function timezoneOptions(current?: string): string[] {
  const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
  const rest = all.filter((zone) => !preferred.includes(zone))
  const options = [...preferred, ...rest]
  return current && !options.includes(current) ? [current, ...options] : options
}
