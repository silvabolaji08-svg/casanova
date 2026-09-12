import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import Icon from '../components/Icon.jsx'
import Gallery from '../components/Gallery.jsx'
import MapView from '../components/MapView.jsx'
import BookingPanel from '../components/BookingPanel.jsx'
import PropertyCard from '../components/PropertyCard.jsx'
import { listingsApi, ApiError } from '../lib/api.js'
import { useStore } from '../context/StoreContext.jsx'
import {
  formatPrice,
  formatArea,
  formatAddressFull,
  formatBeds,
  formatBaths,
  PROPERTY_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_TONE,
} from '../lib/format.js'

export default function Property() {
  const { slug } = useParams()
  const { theme, isSaved, toggleSaved, isAuthed } = useStore()

  const [listing, setListing] = useState(null)
  const [nearby, setNearby] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    setLoading(true)
    setNotFound(false)
    setError('')

    listingsApi
      .bySlug(slug, { signal: controller.signal })
      .then(({ listing: found }) => {
        setListing(found)
        /* Nearby is a second request rather than part of the first, because
           it is not needed to render anything above the fold — the page can
           paint without it. */
        return listingsApi.nearby(slug, { radiusKm: 2 }, { signal: controller.signal })
      })
      .then((res) => setNearby(res?.items ?? []))
      .catch((err) => {
        if (err.name === 'AbortError') return
        /* A 404 is a different page, not an error banner. */
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
        else setError(err.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [slug])

  /* The one pin for the locator map. Memoised so MapView's marker effect
     doesn't see a new array on every render and rebuild the marker. */
  const pins = useMemo(() => {
    if (!listing) return []
    return [
      {
        id: listing.id,
        slug: listing.slug,
        title: listing.title,
        price: listing.price,
        listingType: listing.listingType,
        rentPeriod: listing.rentPeriod,
        lat: listing.latitude,
        lng: listing.longitude,
      },
    ]
  }, [listing])

  const share = async () => {
    const url = window.location.href
    try {
      /* The native share sheet on mobile, clipboard everywhere else. */
      if (navigator.share) {
        await navigator.share({ title: listing.title, url })
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      /* The user dismissed the share sheet, or the clipboard was blocked.
         Neither is worth an error message. */
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ paddingBlock: 'var(--space-6)' }}>
        <div className="skeleton" style={{ aspectRatio: '3 / 2', marginBottom: 'var(--space-5)' }} />
        <div className="detail-layout">
          <div className="stack">
            <div className="skeleton" style={{ height: 120 }} />
            <div className="skeleton" style={{ height: 240 }} />
          </div>
          <div className="skeleton" style={{ height: 360 }} />
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="container-narrow" style={{ paddingBlock: 'var(--space-9)', textAlign: 'center' }}>
        <p className="eyebrow">Not found</p>
        <h1 style={{ marginBlock: 'var(--space-3) var(--space-4)' }}>
          That property isn’t listed
        </h1>
        <p className="lede" style={{ marginInline: 'auto', marginBottom: 'var(--space-6)' }}>
          It may have been sold, let, or withdrawn.
        </p>
        <Link to="/search" className="btn btn-primary">
          Search what’s available
        </Link>
      </div>
    )
  }

  if (error || !listing) {
    return (
      <div className="container-narrow" style={{ paddingBlock: 'var(--space-8)' }}>
        <div className="alert alert-error" role="alert">
          {error || 'Something went wrong loading this property.'}
        </div>
      </div>
    )
  }

  const saved = isSaved(listing.id)
  const agent = listing.agent

  return (
    <div className="container" style={{ paddingBlock: 'var(--space-6)' }}>
      {/* breadcrumb */}
      <div className="row" style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
        <Link to="/search" className="row muted" style={{ gap: 'var(--space-1)' }}>
          <Icon name="arrowLeft" size={14} />
          All properties
        </Link>
        <span className="muted">/</span>
        <Link
          to={`/search?listingType=${listing.listingType}`}
          className="muted"
        >
          {listing.listingType === 'rent' ? 'To rent' : 'For sale'}
        </Link>
        <span className="muted">/</span>
        <span>{listing.address.city}</span>
      </div>

      <Gallery images={listing.images} title={listing.title} />

      <div className="detail-layout">
        {/* ============ MAIN ============ */}
        <div>
          <header className="detail-header">
            <div className="row" style={{ marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
              <span className={`badge ${STATUS_TONE[listing.status]}`}>
                {STATUS_LABELS[listing.status]}
              </span>
              <span className="badge">{PROPERTY_TYPE_LABELS[listing.propertyType]}</span>
              <span className="badge">
                {listing.listingType === 'rent' ? 'To rent' : 'For sale'}
              </span>
              {listing.featured && <span className="badge badge-accent">Featured</span>}
            </div>

            <div className="detail-price">
              {formatPrice(listing.price, listing.listingType, listing.rentPeriod)}
              {listing.pricePerSqm && (
                <small> · £{listing.pricePerSqm.toLocaleString('en-GB')} per m²</small>
              )}
            </div>

            <h1 style={{ fontSize: 'var(--text-2xl)', marginBlock: 'var(--space-3) var(--space-2)' }}>
              {listing.title}
            </h1>

            <p className="muted row" style={{ gap: 'var(--space-2)' }}>
              <Icon name="pin" size={15} />
              {formatAddressFull(listing.address)}
            </p>

            <div className="row" style={{ marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
              <button
                className={`btn ${saved ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={async () => {
                  const res = await toggleSaved(listing.id)
                  if (!res.ok && res.reason === 'auth') {
                    window.location.assign(`/login?next=/property/${listing.slug}`)
                  }
                }}
                aria-pressed={saved}
              >
                <Icon name="heart" size={15} filled={saved} />
                {saved ? 'Saved' : 'Save'}
              </button>

              <button className="btn btn-secondary btn-sm" onClick={share}>
                <Icon name={copied ? 'check' : 'share'} size={15} />
                {copied ? 'Link copied' : 'Share'}
              </button>

              <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
                <Icon name="print" size={15} />
                Print
              </button>
            </div>
          </header>

          {/* key facts */}
          <div className="spec-grid">
            <div className="spec-item">
              <span className="spec-value">{listing.bedrooms || '—'}</span>
              <span className="spec-label">
                {listing.bedrooms === 0 ? 'Studio' : listing.bedrooms === 1 ? 'Bedroom' : 'Bedrooms'}
              </span>
            </div>
            <div className="spec-item">
              <span className="spec-value">{listing.bathrooms || '—'}</span>
              <span className="spec-label">
                {listing.bathrooms === 1 ? 'Bathroom' : 'Bathrooms'}
              </span>
            </div>
            <div className="spec-item">
              <span className="spec-value">{listing.floorArea ?? '—'}</span>
              <span className="spec-label">{listing.floorArea ? 'Square metres' : 'Floor area'}</span>
            </div>
            <div className="spec-item">
              <span className="spec-value">{listing.yearBuilt ?? '—'}</span>
              <span className="spec-label">Built</span>
            </div>
          </div>

          {/* description */}
          <section style={{ marginBottom: 'var(--space-7)' }}>
            <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-4)' }}>
              About this property
            </h2>
            <div className="prose">
              {/* Split on blank lines so a multi-paragraph description from
                  the database renders as paragraphs, not one wall of text. */}
              {listing.description.split(/\n\s*\n/).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
            {listing.floorArea && (
              <p className="muted" style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
                {formatArea(listing.floorArea)}
              </p>
            )}
          </section>

          {/* features */}
          {listing.features?.length > 0 && (
            <section style={{ marginBottom: 'var(--space-7)' }}>
              <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-4)' }}>
                Features
              </h2>
              <ul className="feature-list">
                {listing.features.map((f) => (
                  <li key={f} className="feature-item">
                    <Icon name="check" size={15} />
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* location */}
          <section style={{ marginBottom: 'var(--space-7)' }}>
            <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-4)' }}>
              Where it is
            </h2>
            <div className="detail-map">
              {/**
               * The same MapView as the search page, with one pin and no
               * onBoundsChange — so panning it does not trigger a search.
               * fitToken={1} centres it on the property once.
               */}
              <MapView pins={pins} theme={theme} fitToken={1} />
            </div>
            <p className="muted" style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
              {listing.address.postcode} · approximate location
            </p>
          </section>
        </div>

        {/* ============ ASIDE ============ */}
        <aside className="detail-aside">
          <BookingPanel listing={listing} />

          {agent && (
            <div className="agent-card">
              <div className="agent-avatar">
                {agent.avatar ? (
                  <img src={agent.avatar} alt="" />
                ) : (
                  /* Initials as a fallback — cheaper and more reliable than
                     a placeholder image request. */
                  agent.name
                    .split(' ')
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join('')
                )}
              </div>
              <div>
                <div style={{ fontWeight: 500 }}>{agent.name}</div>
                <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                  {agent.agency}
                </div>
                {agent.phone && (
                  <a
                    href={`tel:${agent.phone.replace(/\s/g, '')}`}
                    className="row link"
                    style={{ gap: 'var(--space-1)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}
                  >
                    <Icon name="phone" size={13} />
                    {agent.phone}
                  </a>
                )}
              </div>
            </div>
          )}

          {listing.listingType === 'sale' && <MortgageCalculator price={listing.price} />}
        </aside>
      </div>

      {/* ============ NEARBY ============ */}
      {nearby.length > 0 && (
        <section className="section" style={{ paddingBottom: 0 }}>
          <div className="section-head">
            <div>
              <p className="eyebrow">Within two kilometres</p>
              <h2>Also {listing.listingType === 'rent' ? 'to rent' : 'for sale'} nearby</h2>
            </div>
          </div>
          <div className="grid-cards">
            {nearby.map((l) => (
              <PropertyCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/**
 * Repayment calculator.
 *
 * Local to this file because it is used in exactly one place. Splitting
 * every component into its own file is a habit, not a rule — a component
 * with one caller and no independent meaning is clearer next to its use.
 */
function MortgageCalculator({ price }) {
  const [depositPct, setDepositPct] = useState(10)
  const [rate, setRate] = useState(4.5)
  const [years, setYears] = useState(25)

  const deposit = Math.round((price * depositPct) / 100)
  const loan = price - deposit

  /**
   * The standard amortising repayment formula:
   *
   *   M = P · r / (1 − (1 + r)^−n)
   *
   * where r is the MONTHLY rate and n the number of months. The zero-rate
   * case has to be special-cased, because r = 0 makes the denominator zero.
   */
  const monthly = useMemo(() => {
    const r = rate / 100 / 12
    const n = years * 12
    if (n <= 0) return 0
    if (r === 0) return loan / n
    return (loan * r) / (1 - Math.pow(1 + r, -n))
  }, [loan, rate, years])

  const totalPaid = monthly * years * 12
  const interest = totalPaid - loan

  const money = (n) => `£${Math.round(n).toLocaleString('en-GB')}`

  return (
    <div className="panel" style={{ padding: 'var(--space-5)' }}>
      <p className="panel-title" style={{ marginBottom: 'var(--space-4)' }}>
        Monthly repayment
      </p>

      <div className="detail-price" style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-5)' }}>
        {money(monthly)}
        <small> / month</small>
      </div>

      <div className="stack" style={{ gap: 'var(--space-5)' }}>
        <div className="field">
          <label className="label" htmlFor="mc-deposit">
            Deposit: {depositPct}% · {money(deposit)}
          </label>
          <input
            id="mc-deposit"
            type="range"
            min="5"
            max="50"
            step="1"
            value={depositPct}
            onChange={(e) => setDepositPct(Number(e.target.value))}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="mc-rate">
            Interest rate: {rate.toFixed(2)}%
          </label>
          <input
            id="mc-rate"
            type="range"
            min="0.5"
            max="10"
            step="0.05"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="mc-years">
            Term: {years} years
          </label>
          <input
            id="mc-years"
            type="range"
            min="5"
            max="40"
            step="1"
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
          />
        </div>
      </div>

      <dl
        style={{
          marginTop: 'var(--space-5)',
          paddingTop: 'var(--space-4)',
          borderTop: '1px solid var(--border)',
          fontSize: 'var(--text-sm)',
        }}
      >
        <div className="row-between">
          <dt className="muted">Borrowing</dt>
          <dd>{money(loan)}</dd>
        </div>
        <div className="row-between">
          <dt className="muted">Total interest</dt>
          <dd>{money(interest)}</dd>
        </div>
        <div className="row-between">
          <dt className="muted">Total repaid</dt>
          <dd>{money(totalPaid)}</dd>
        </div>
      </dl>

      <p className="form-note" style={{ marginTop: 'var(--space-4)' }}>
        An illustration only, not a mortgage quote or financial advice. Real
        offers depend on your circumstances and a lender’s assessment.
      </p>
    </div>
  )
}