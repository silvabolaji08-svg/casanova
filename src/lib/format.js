/**
 * Display formatting, in one place.
 *
 * Every price, date and measurement on the site goes through here, so
 * "£1,850 pcm" is written once rather than being reinvented in six
 * components with six slightly different results.
 */

/* en-GB gives us the £ and the comma grouping without hand-rolling either. */
const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
})

export function formatPrice(amount, listingType, rentPeriod) {
  if (amount === null || amount === undefined) return '—'
  const money = gbp.format(amount)
  if (listingType !== 'rent') return money
  /* pcm and pw are what property listings actually say. */
  return `${money} ${rentPeriod === 'week' ? 'pw' : 'pcm'}`
}

/**
 * Compact form for map pins, where horizontal space is the constraint.
 * £685,000 becomes £685k; £1,450,000 becomes £1.45m.
 */
export function formatPriceShort(amount, listingType, rentPeriod) {
  if (amount === null || amount === undefined) return '—'

  if (listingType === 'rent') {
    return `£${Math.round(amount).toLocaleString('en-GB')}${rentPeriod === 'week' ? 'pw' : 'pcm'}`
  }

  if (amount >= 1_000_000) {
    /* One decimal, but drop a trailing .0 — £2m, not £2.0m. */
    const m = (amount / 1_000_000).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
    return `£${m}m`
  }
  if (amount >= 1000) return `£${Math.round(amount / 1000)}k`
  return gbp.format(amount)
}

export function formatArea(sqm) {
  if (!sqm) return null
  /* Both units, because the UK property market stubbornly uses both. */
  const sqft = Math.round(sqm * 10.7639)
  return `${sqm} m² · ${sqft.toLocaleString('en-GB')} ft²`
}

export function formatAreaShort(sqm) {
  return sqm ? `${sqm} m²` : null
}

export function formatBeds(n) {
  if (n === 0) return 'Studio'
  return `${n} bed${n === 1 ? '' : 's'}`
}

export function formatBaths(n) {
  return `${n} bath${n === 1 ? '' : 's'}`
}

export function formatAddress(address) {
  if (!address) return ''
  return [address.city, address.postcode].filter(Boolean).join(' · ')
}

export function formatAddressFull(address) {
  if (!address) return ''
  return [address.line1, address.line2, address.city, address.postcode]
    .filter(Boolean)
    .join(', ')
}

export const PROPERTY_TYPE_LABELS = {
  house: 'House',
  flat: 'Flat',
  bungalow: 'Bungalow',
  studio: 'Studio',
  land: 'Land',
}

export const STATUS_LABELS = {
  available: 'Available',
  'under-offer': 'Under offer',
  sold: 'Sold',
  let: 'Let',
}

export const STATUS_TONE = {
  available: 'badge-positive',
  'under-offer': 'badge-warn',
  sold: 'badge-danger',
  let: 'badge-danger',
}

/* ---------- dates ---------- */

/**
 * The API sends UTC instants; these render them in the visitor's own
 * timezone, which is what a person expects to see.
 */
export function formatDate(iso, opts = {}) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: opts.weekday ?? undefined,
    day: 'numeric',
    month: opts.month ?? 'short',
    year: opts.year ?? undefined,
  })
}

export function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  return `${formatDate(iso, { weekday: 'short' })} at ${formatTime(iso)}`
}

/* "in 3 days", "tomorrow", "2 weeks ago" — for booking lists. */
export function formatRelative(iso) {
  if (!iso) return ''
  const diff = new Date(iso).getTime() - Date.now()
  const days = Math.round(diff / 86_400_000)

  const rtf = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' })
  if (Math.abs(days) < 1) {
    const hours = Math.round(diff / 3_600_000)
    return rtf.format(hours, 'hour')
  }
  if (Math.abs(days) < 14) return rtf.format(days, 'day')
  return rtf.format(Math.round(days / 7), 'week')
}