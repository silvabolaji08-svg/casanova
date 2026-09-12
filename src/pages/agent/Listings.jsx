import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import Icon from '../../components/Icon.jsx'
import MapView from '../../components/MapView.jsx'
import { listingsApi, ApiError } from '../../lib/api.js'
import { useStore } from '../../context/StoreContext.jsx'
import {
  formatPrice,
  formatAddress,
  PROPERTY_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_TONE,
} from '../../lib/format.js'

/* Central London, as a starting point for a new listing's coordinates. */
const BLANK = {
  id: null,
  title: '',
  description: '',
  price: '',
  listingType: 'sale',
  rentPeriod: 'month',
  propertyType: 'flat',
  bedrooms: '1',
  bathrooms: '1',
  floorArea: '',
  yearBuilt: '',
  line1: '',
  line2: '',
  city: 'London',
  postcode: '',
  latitude: '51.5074',
  longitude: '-0.1278',
  features: '',
  images: '',
  status: 'available',
  featured: false,
}

export default function Listings() {
  const { theme } = useStore()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () =>
    listingsApi
      .mine()
      .then((data) => {
        setItems(data.items)
        setError('')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

  const startEdit = (listing) => {
    setEditing({
      id: listing.id,
      title: listing.title,
      description: listing.description,
      price: String(listing.price),
      listingType: listing.listingType,
      rentPeriod: listing.rentPeriod ?? 'month',
      propertyType: listing.propertyType,
      bedrooms: String(listing.bedrooms),
      bathrooms: String(listing.bathrooms),
      floorArea: listing.floorArea ? String(listing.floorArea) : '',
      yearBuilt: listing.yearBuilt ? String(listing.yearBuilt) : '',
      line1: listing.address.line1,
      line2: listing.address.line2 ?? '',
      city: listing.address.city,
      postcode: listing.address.postcode,
      /* The virtuals on the model, so the flip out of GeoJSON order happens
         once on the server rather than here. */
      latitude: String(listing.latitude),
      longitude: String(listing.longitude),
      features: (listing.features ?? []).join(', '),
      images: (listing.images ?? []).join(', '),
      status: listing.status,
      featured: Boolean(listing.featured),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const save = async (e) => {
    e.preventDefault()
    if (busy) return

    setBusy(true)
    setError('')

    /**
     * Build the payload the API expects.
     *
     * Two conversions matter here:
     *
     * 1. Every form input is a STRING. Number() at this boundary means the
     *    API never receives "685000" where it expects 685000 — Mongoose
     *    would cast it, but relying on that is how you end up with a price
     *    of NaN from an empty field.
     *
     * 2. location is GeoJSON, so [longitude, latitude] — longitude first.
     *    The form collects them in the human order and this is the one
     *    place they get swapped.
     */
    const body = {
      title: editing.title.trim(),
      description: editing.description.trim(),
      price: Number(editing.price),
      listingType: editing.listingType,
      rentPeriod: editing.listingType === 'rent' ? editing.rentPeriod : null,
      propertyType: editing.propertyType,
      bedrooms: Number(editing.bedrooms),
      bathrooms: Number(editing.bathrooms),
      floorArea: editing.floorArea ? Number(editing.floorArea) : null,
      yearBuilt: editing.yearBuilt ? Number(editing.yearBuilt) : null,
      address: {
        line1: editing.line1.trim(),
        line2: editing.line2.trim(),
        city: editing.city.trim(),
        postcode: editing.postcode.trim().toUpperCase(),
      },
      location: {
        type: 'Point',
        coordinates: [Number(editing.longitude), Number(editing.latitude)],
      },
      /* Split, trim, drop blanks — so "Garden, , Parking" doesn't become a
         feature called "". */
      features: editing.features
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      images: editing.images
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      status: editing.status,
      featured: editing.featured,
    }

    try {
      if (editing.id) await listingsApi.update(editing.id, body)
      else await listingsApi.create(body)
      await load()
      setEditing(null)
    } catch (err) {
      /* Mongoose validation errors arrive as an array in `details`, which
         is far more useful to show than the generic message. */
      const details = err instanceof ApiError ? err.body?.details : null
      setError(details ? details.join(' · ') : err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id) => {
    setBusy(true)
    try {
      await listingsApi.remove(id)
      await load()
      setDeleting(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  /* The live preview pin. Guarded, because a half-typed coordinate is NaN
     and Leaflet throws on an invalid LatLng. */
  const previewPins = useMemo(() => {
    if (!editing) return []
    const lat = Number(editing.latitude)
    const lng = Number(editing.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return []
    return [
      {
        id: 'preview',
        slug: '',
        title: editing.title || 'New listing',
        price: Number(editing.price) || 0,
        listingType: editing.listingType,
        rentPeriod: editing.rentPeriod,
        lat,
        lng,
      },
    ]
  }, [editing])

  const set = (key) => (e) =>
    setEditing((f) => ({
      ...f,
      [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }))

  const counts = useMemo(() => {
    const out = { available: 0, 'under-offer': 0, sold: 0, let: 0 }
    for (const l of items) out[l.status] = (out[l.status] ?? 0) + 1
    return out
  }, [items])

  return (
    <div className="stack" style={{ gap: 'var(--space-6)' }}>
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-value">{items.length}</div>
          <div className="stat-label">Total listings</div>
        </div>
        <div className="stat">
          <div className="stat-value">{counts.available}</div>
          <div className="stat-label">Available</div>
        </div>
        <div className="stat">
          <div className="stat-value">{counts['under-offer']}</div>
          <div className="stat-label">Under offer</div>
        </div>
        <div className="stat">
          <div className="stat-value">{counts.sold + counts.let}</div>
          <div className="stat-label">Sold or let</div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {/* ---------- form ---------- */}
      {editing ? (
        <form className="panel" onSubmit={save}>
          <div className="panel-head">
            <span className="panel-title">{editing.id ? 'Edit listing' : 'New listing'}</span>
            <button type="button" className="btn-icon" onClick={() => setEditing(null)} aria-label="Close">
              <Icon name="close" size={18} />
            </button>
          </div>

          <div style={{ padding: 'var(--space-5)' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 'var(--space-4)',
              }}
            >
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label className="label" htmlFor="li-title">Title</label>
                <input id="li-title" className="input" required value={editing.title} onChange={set('title')} />
                <p className="form-note">The slug is generated from this on the server.</p>
              </div>

              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label className="label" htmlFor="li-desc">Description</label>
                <textarea id="li-desc" className="textarea" rows={5} required value={editing.description} onChange={set('description')} />
                <p className="form-note">Leave a blank line between paragraphs.</p>
              </div>

              <div className="field">
                <label className="label" htmlFor="li-type">Sale or rent</label>
                <select id="li-type" className="select" value={editing.listingType} onChange={set('listingType')}>
                  <option value="sale">For sale</option>
                  <option value="rent">To rent</option>
                </select>
              </div>

              <div className="field">
                <label className="label" htmlFor="li-price">
                  {editing.listingType === 'rent' ? 'Rent (£)' : 'Asking price (£)'}
                </label>
                <input id="li-price" className="input" type="number" min="0" required value={editing.price} onChange={set('price')} />
              </div>

              {editing.listingType === 'rent' && (
                <div className="field">
                  <label className="label" htmlFor="li-period">Per</label>
                  <select id="li-period" className="select" value={editing.rentPeriod} onChange={set('rentPeriod')}>
                    <option value="month">Month</option>
                    <option value="week">Week</option>
                  </select>
                </div>
              )}

              <div className="field">
                <label className="label" htmlFor="li-ptype">Property type</label>
                <select id="li-ptype" className="select" value={editing.propertyType} onChange={set('propertyType')}>
                  {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="label" htmlFor="li-beds">Bedrooms</label>
                <input id="li-beds" className="input" type="number" min="0" required value={editing.bedrooms} onChange={set('bedrooms')} />
              </div>

              <div className="field">
                <label className="label" htmlFor="li-baths">Bathrooms</label>
                <input id="li-baths" className="input" type="number" min="0" required value={editing.bathrooms} onChange={set('bathrooms')} />
              </div>

              <div className="field">
                <label className="label" htmlFor="li-area">Floor area (m²)</label>
                <input id="li-area" className="input" type="number" min="0" value={editing.floorArea} onChange={set('floorArea')} />
              </div>

              <div className="field">
                <label className="label" htmlFor="li-year">Year built</label>
                <input id="li-year" className="input" type="number" min="1000" max="2100" value={editing.yearBuilt} onChange={set('yearBuilt')} />
              </div>

              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label className="label" htmlFor="li-line1">Address line 1</label>
                <input id="li-line1" className="input" required value={editing.line1} onChange={set('line1')} />
              </div>

              <div className="field">
                <label className="label" htmlFor="li-line2">Line 2</label>
                <input id="li-line2" className="input" value={editing.line2} onChange={set('line2')} />
              </div>

              <div className="field">
                <label className="label" htmlFor="li-city">City</label>
                <input id="li-city" className="input" required value={editing.city} onChange={set('city')} />
              </div>

              <div className="field">
                <label className="label" htmlFor="li-post">Postcode</label>
                <input id="li-post" className="input" required value={editing.postcode} onChange={set('postcode')} />
              </div>

              <div className="field">
                <label className="label" htmlFor="li-lat">Latitude</label>
                <input id="li-lat" className="input" type="number" step="0.000001" required value={editing.latitude} onChange={set('latitude')} />
              </div>

              <div className="field">
                <label className="label" htmlFor="li-lng">Longitude</label>
                <input id="li-lng" className="input" type="number" step="0.000001" required value={editing.longitude} onChange={set('longitude')} />
                <p className="form-note">
                  Right-click a spot in Google Maps and the first menu item is
                  the coordinates — latitude first there too.
                </p>
              </div>

              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <span className="label">Check the pin</span>
                <div className="detail-map" style={{ height: 220 }}>
                  <MapView pins={previewPins} theme={theme} fitToken={1} />
                </div>
              </div>

              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label className="label" htmlFor="li-features">Features</label>
                <input id="li-features" className="input" value={editing.features} onChange={set('features')} placeholder="Garden, Freehold, Parking" />
                <p className="form-note">Comma separated. These become filter options.</p>
              </div>

              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label className="label" htmlFor="li-images">Image paths</label>
                <input id="li-images" className="input" value={editing.images} onChange={set('images')} placeholder="/listings/example-1.jpg, /listings/example-2.jpg" />
                <p className="form-note">Comma separated. Files live in public/.</p>
              </div>

              <div className="field">
                <label className="label" htmlFor="li-status">Status</label>
                <select id="li-status" className="select" value={editing.status} onChange={set('status')}>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <label className="check">
                  <input type="checkbox" checked={editing.featured} onChange={set('featured')} />
                  Feature on the homepage
                </label>
              </div>
            </div>

            <div className="row" style={{ marginTop: 'var(--space-5)' }}>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? <><span className="spinner" /> Saving…</> : editing.id ? 'Save changes' : 'Create listing'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      ) : (
        <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => setEditing(BLANK)}>
          <Icon name="plus" size={16} />
          Add a listing
        </button>
      )}

      {/* ---------- table ---------- */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">My listings</span>
          <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            {items.length} total
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 'var(--space-5)' }}>
            <div className="skeleton" style={{ height: 140 }} />
          </div>
        ) : items.length === 0 ? (
          <div className="empty">
            <Icon name="home" size={28} />
            <p className="empty-title">No listings yet</p>
            <p>Add your first property above.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Type</th>
                  <th className="table-num">Price</th>
                  <th className="table-num">Beds</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link to={`/property/${l.slug}`} className="link" style={{ fontWeight: 500 }}>
                        {l.title}
                      </Link>
                      <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                        {formatAddress(l.address)}
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {PROPERTY_TYPE_LABELS[l.propertyType]}
                      <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                        {l.listingType === 'rent' ? 'To rent' : 'For sale'}
                      </div>
                    </td>
                    <td className="table-num" style={{ whiteSpace: 'nowrap' }}>
                      {formatPrice(l.price, l.listingType, l.rentPeriod)}
                    </td>
                    <td className="table-num">{l.bedrooms}</td>
                    <td>
                      <span className={`badge ${STATUS_TONE[l.status]}`}>{STATUS_LABELS[l.status]}</span>
                    </td>
                    <td>
                      {deleting === l.id ? (
                        <div className="row">
                          <button className="btn btn-danger btn-sm" onClick={() => remove(l.id)} disabled={busy}>
                            Delete
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setDeleting(null)}>
                            Keep
                          </button>
                        </div>
                      ) : (
                        <div className="row">
                          <button className="btn-icon" onClick={() => startEdit(l)} aria-label={`Edit ${l.title}`}>
                            <Icon name="edit" size={16} />
                          </button>
                          <button className="btn-icon" onClick={() => setDeleting(l.id)} aria-label={`Delete ${l.title}`}>
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}