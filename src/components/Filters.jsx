import Icon from './Icon.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { PROPERTY_TYPE_LABELS } from '../lib/format.js'

const BED_OPTIONS = [
  { label: 'Any', value: '' },
  { label: 'Studio', value: '0' },
  { label: '1+', value: '1' },
  { label: '2+', value: '2' },
  { label: '3+', value: '3' },
  { label: '4+', value: '4' },
]

const BATH_OPTIONS = [
  { label: 'Any', value: '' },
  { label: '1+', value: '1' },
  { label: '2+', value: '2' },
  { label: '3+', value: '3' },
]

const SORTS = [
  { label: 'Featured', value: 'featured' },
  { label: 'Newest', value: 'newest' },
  { label: 'Price: low to high', value: 'price-asc' },
  { label: 'Price: high to low', value: 'price-desc' },
  { label: 'Most bedrooms', value: 'beds-desc' },
]

/**
 * @param params    the current filter values, read from the URL
 * @param onChange  called with a partial patch, e.g. { minBeds: '2' }
 * @param onReset   clears everything
 */
export default function Filters({ params, onChange, onReset, resultCount }) {
  const { meta } = useStore()

  /* Price bounds differ enormously between sale and rent, so the hints
     shown next to the inputs follow whichever mode is active. */
  const bounds =
    params.listingType === 'rent' ? meta?.priceBounds?.rent : meta?.priceBounds?.sale

  /* A comma-separated URL value ("house,flat") as an array. */
  const selectedTypes = params.propertyType ? params.propertyType.split(',') : []
  const selectedFeatures = params.features ? params.features.split(',') : []

  const toggleInList = (key, current, value) => {
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    /* An empty list means "no constraint", which the API expects as an
       absent parameter rather than an empty string. */
    onChange({ [key]: next.length ? next.join(',') : '' })
  }

  return (
    <div className="filters">
      {/* ---------- sale / rent ---------- */}
      <fieldset className="filter-group" style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend className="filter-legend" style={{ marginBottom: 'var(--space-3)' }}>
          Looking to
        </legend>
        <div className="segmented" role="group" aria-label="Sale or rent">
          {[
            { label: 'Anything', value: '' },
            { label: 'Buy', value: 'sale' },
            { label: 'Rent', value: 'rent' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              /**
               * aria-pressed rather than a class alone.
               *
               * These are toggle buttons, not links. aria-pressed tells a
               * screen reader which one is on — and the CSS styles the
               * active state off that same attribute, so the visual and the
               * announced state cannot drift apart.
               */
              aria-pressed={(params.listingType ?? '') === opt.value}
              onClick={() => onChange({ listingType: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* ---------- price ---------- */}
      <div className="filter-group">
        <span className="filter-legend">Price</span>
        <div className="range-row">
          <input
            className="input"
            type="number"
            inputMode="numeric"
            placeholder={bounds ? `${bounds.min.toLocaleString('en-GB')}` : 'Min'}
            value={params.minPrice ?? ''}
            onChange={(e) => onChange({ minPrice: e.target.value })}
            aria-label="Minimum price"
          />
          <span className="range-sep">to</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            placeholder={bounds ? `${bounds.max.toLocaleString('en-GB')}` : 'Max'}
            value={params.maxPrice ?? ''}
            onChange={(e) => onChange({ maxPrice: e.target.value })}
            aria-label="Maximum price"
          />
        </div>
        {bounds && (
          <p className="form-note">
            {params.listingType === 'rent' ? 'Monthly rent' : 'Asking price'} ranges from £
            {bounds.min.toLocaleString('en-GB')} to £{bounds.max.toLocaleString('en-GB')}
          </p>
        )}
      </div>

      {/* ---------- bedrooms ---------- */}
      <fieldset className="filter-group" style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend className="filter-legend" style={{ marginBottom: 'var(--space-3)' }}>
          Bedrooms
        </legend>
        <div className="segmented" role="group" aria-label="Minimum bedrooms">
          {BED_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              aria-pressed={(params.minBeds ?? '') === opt.value}
              onClick={() => onChange({ minBeds: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* ---------- bathrooms ---------- */}
      <fieldset className="filter-group" style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend className="filter-legend" style={{ marginBottom: 'var(--space-3)' }}>
          Bathrooms
        </legend>
        <div className="segmented" role="group" aria-label="Minimum bathrooms">
          {BATH_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              aria-pressed={(params.minBaths ?? '') === opt.value}
              onClick={() => onChange({ minBaths: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* ---------- property type ---------- */}
      <fieldset className="filter-group" style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend className="filter-legend" style={{ marginBottom: 'var(--space-3)' }}>
          Property type
        </legend>
        <div className="check-list">
          {(meta?.propertyTypes ?? []).map((type) => (
            <label key={type} className="check">
              <input
                type="checkbox"
                checked={selectedTypes.includes(type)}
                onChange={() => toggleInList('propertyType', selectedTypes, type)}
              />
              {PROPERTY_TYPE_LABELS[type] ?? type}
            </label>
          ))}
          {!meta && <p className="form-note">Loading types…</p>}
        </div>
      </fieldset>

      {/* ---------- area ---------- */}
      <div className="filter-group">
        <label className="filter-legend" htmlFor="filter-city">
          Area
        </label>
        <select
          id="filter-city"
          className="select"
          value={params.city ?? ''}
          onChange={(e) => onChange({ city: e.target.value })}
        >
          <option value="">Anywhere</option>
          {(meta?.cities ?? []).map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>

      {/* ---------- features ---------- */}
      {meta?.features?.length ? (
        <fieldset className="filter-group" style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="filter-legend" style={{ marginBottom: 'var(--space-3)' }}>
            Must have
          </legend>
          <div className="check-list">
            {meta.features.map((feature) => (
              <label key={feature} className="check">
                <input
                  type="checkbox"
                  checked={selectedFeatures.includes(feature)}
                  onChange={() => toggleInList('features', selectedFeatures, feature)}
                />
                {feature}
              </label>
            ))}
          </div>
          <p className="form-note">
            Every ticked feature must be present, not just one of them.
          </p>
        </fieldset>
      ) : null}

      {/* ---------- sort ---------- */}
      <div className="filter-group">
        <label className="filter-legend" htmlFor="filter-sort">
          Order
        </label>
        <select
          id="filter-sort"
          className="select"
          value={params.sort ?? 'featured'}
          onChange={(e) => onChange({ sort: e.target.value })}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <button type="button" className="btn btn-secondary btn-block" onClick={onReset}>
        <Icon name="close" size={15} />
        Clear all filters
        {typeof resultCount === 'number' ? ` (${resultCount} shown)` : ''}
      </button>
    </div>
  )
}

/**
 * The row of removable chips shown above the results.
 *
 * Separate from the panel because it appears in a different place in the
 * layout, and because on mobile the panel is behind a drawer while these
 * stay visible — someone needs to see what is filtering their results
 * without opening anything.
 */
export function ActiveFilters({ params, onChange, onReset }) {
  const chips = []

  const push = (label, patch) => chips.push({ label, patch })

  if (params.q) push(`“${params.q}”`, { q: '' })
  if (params.listingType) push(params.listingType === 'rent' ? 'To rent' : 'For sale', { listingType: '' })
  if (params.city) push(params.city, { city: '' })
  if (params.minBeds) {
    push(params.minBeds === '0' ? 'Studio' : `${params.minBeds}+ beds`, { minBeds: '' })
  }
  if (params.minBaths) push(`${params.minBaths}+ baths`, { minBaths: '' })
  if (params.minPrice) push(`From £${Number(params.minPrice).toLocaleString('en-GB')}`, { minPrice: '' })
  if (params.maxPrice) push(`Up to £${Number(params.maxPrice).toLocaleString('en-GB')}`, { maxPrice: '' })

  for (const type of params.propertyType ? params.propertyType.split(',') : []) {
    push(PROPERTY_TYPE_LABELS[type] ?? type, {
      propertyType: params.propertyType
        .split(',')
        .filter((t) => t !== type)
        .join(','),
    })
  }

  for (const feature of params.features ? params.features.split(',') : []) {
    push(feature, {
      features: params.features
        .split(',')
        .filter((f) => f !== feature)
        .join(','),
    })
  }

  if (!chips.length) return null

  return (
    <div className="active-filters">
      {chips.map((chip) => (
        <span key={chip.label} className="chip">
          {chip.label}
          <button
            type="button"
            onClick={() => onChange(chip.patch)}
            aria-label={`Remove filter ${chip.label}`}
          >
            <Icon name="close" size={11} />
          </button>
        </span>
      ))}
      {chips.length > 1 && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onReset}>
          Clear all
        </button>
      )}
    </div>
  )
}