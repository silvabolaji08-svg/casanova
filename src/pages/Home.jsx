import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import Icon from '../components/Icon.jsx'
import PropertyCard from '../components/PropertyCard.jsx'
import { listingsApi } from '../lib/api.js'
import { useStore } from '../context/StoreContext.jsx'
import { motionContext, revealOnScroll, gsap } from '../motion/gsap.js'

const U = 'https://images.unsplash.com'

/* Curated rather than derived from the data — an editorial choice about
   which areas to lead with, which is a real thing an agency decides.
   Different crops of the same photographs, so the row reads as varied. */
const areas = [
  {
    name: 'Camden',
    query: 'Camden',
    blurb: 'Period conversions, market on the doorstep',
    image: `${U}/photo-1618660920685-4505debb785a?w=900&q=75&auto=format&fit=crop&crop=entropy`,
  },
  {
    name: 'Islington',
    query: 'Islington',
    blurb: 'Georgian terraces and garden squares',
    image: `${U}/photo-1611510631469-6df4a3e6edc8?w=900&q=75&auto=format&fit=crop&crop=top`,
  },
  {
    name: 'Notting Hill',
    query: 'Notting Hill',
    blurb: 'Stucco fronts, communal gardens',
    image: `${U}/photo-1611510631469-6df4a3e6edc8?w=900&q=75&auto=format&fit=crop&crop=right`,
  },
  {
    name: 'Clapham',
    query: 'Clapham',
    blurb: 'Family houses, common nearby',
    image: `${U}/photo-1618660920685-4505debb785a?w=900&q=75&auto=format&fit=crop&crop=left`,
  },
  {
    name: 'Greenwich',
    query: 'Greenwich',
    blurb: 'Listed cottages by the park',
    image: `${U}/photo-1611510631469-6df4a3e6edc8?w=900&q=75&auto=format&fit=crop&crop=bottom`,
  },
  {
    name: 'Shoreditch',
    query: 'Shoreditch',
    blurb: 'Warehouse lofts and studios',
    image: `${U}/photo-1783990349147-906f62b882c1?w=900&q=75&auto=format&fit=crop&crop=entropy`,
  },
]

export default function Home() {
  const navigate = useNavigate()
  const { meta } = useStore()

  const [featured, setFeatured] = useState([])
  const [rentals, setRentals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [term, setTerm] = useState('')

  const scopeRef = useRef(null)

  /* Two requests in parallel — they don't depend on each other, so there is
     no reason to wait for the first before starting the second. */
  useEffect(() => {
    const controller = new AbortController()

    Promise.all([
      listingsApi.list({ sort: 'featured', limit: 6 }, { signal: controller.signal }),
      listingsApi.list({ listingType: 'rent', limit: 3 }, { signal: controller.signal }),
    ])
      .then(([f, r]) => {
        setFeatured(f.items)
        setRentals(r.items)
        setError('')
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message)
      })
      .finally(() => {
        /* An aborted request should not clear the loading state of the
           component that replaced this one. */
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [])

  /* Entrance and scroll animations, scoped to this page. */
  useEffect(() => {
    if (loading) return

    return motionContext(scopeRef.current, (q) => {
      gsap.from(q('[data-hero-item]'), {
        y: 26,
        opacity: 0,
        duration: 0.8,
        stagger: 0.09,
        ease: 'power3.out',
      })

      revealOnScroll(q, '[data-reveal-card]', { stagger: 0.06 })
      revealOnScroll(q, '[data-reveal-tile]', { stagger: 0.05, y: 18 })
      revealOnScroll(q, '[data-reveal]', { stagger: 0.1 })
    })
  }, [loading])

  const onSearch = (e) => {
    e.preventDefault()
    const q = term.trim()
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search')
  }

  const saleCount = meta?.priceBounds?.sale?.count ?? null
  const rentCount = meta?.priceBounds?.rent?.count ?? null

  return (
    <div ref={scopeRef}>
      {/* ---------- HERO ---------- */}
      <section className="hero">
        {/**
         * alt="" deliberately.
         *
         * This photograph is decorative — the headline beside it carries the
         * meaning. An empty alt tells a screen reader to skip it. Writing
         * alt="London street" here would make someone listen to a
         * description of wallpaper.
         */}
        <div className="hero-media">
          <img
            src={`${U}/photo-1524136861124-5e9a7b7f6145?w=2000&q=75&auto=format&fit=crop`}
            alt=""
            /* eager + high priority: this is the largest element on the page
               and the thing the visitor is waiting for. Everything else is
               lazy. */
            loading="eager"
            fetchPriority="high"
          />
        </div>

        <div className="container hero-inner">
          <p className="eyebrow" data-hero-item>
            London · {saleCount ?? '—'} for sale · {rentCount ?? '—'} to rent
          </p>

          <h1 data-hero-item>
            Fewer homes,
            <br />
            known properly.
          </h1>

          <p className="hero-lede" data-hero-item>
            We list a small number of London houses and flats and we have been
            inside every one. Search the map, book a viewing, speak to the
            person who actually knows the place.
          </p>

          <form className="hero-search" onSubmit={onSearch} data-hero-item>
            <label htmlFor="home-search" className="sr-only">
              Search by area, postcode or keyword
            </label>
            <input
              id="home-search"
              className="input"
              type="search"
              placeholder="Camden, N1, garden, warehouse…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              <Icon name="search" size={16} />
              Search
            </button>
          </form>

          <div
            className="row"
            style={{ marginTop: 'var(--space-4)', flexWrap: 'wrap' }}
            data-hero-item
          >
            <Link to="/search?listingType=sale" className="btn btn-secondary btn-sm">
              For sale
            </Link>
            <Link to="/search?listingType=rent" className="btn btn-secondary btn-sm">
              To rent
            </Link>
            <Link to="/search" className="btn btn-ghost btn-sm" style={{ color: '#fffdfa' }}>
              <Icon name="pin" size={15} />
              Open the map
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- FEATURED ---------- */}
      <section className="section">
        <div className="container">
          <div className="section-head" data-reveal>
            <div>
              <p className="eyebrow">Selected</p>
              <h2>Homes we would live in</h2>
            </div>
            <Link to="/search?listingType=sale" className="btn btn-ghost btn-sm">
              See all for sale
              <Icon name="arrowRight" size={15} />
            </Link>
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              Couldn’t load properties — {error}
            </div>
          )}

          {loading ? (
            <div className="grid-cards">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton skeleton-card" />
              ))}
            </div>
          ) : (
            <div className="grid-cards">
              {featured.map((l) => (
                <div key={l.id} data-reveal-card>
                  <PropertyCard listing={l} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------- AREAS ---------- */}
      <section className="section section-sunken">
        <div className="container">
          <div className="section-head" data-reveal>
            <div>
              <p className="eyebrow">Where</p>
              <h2>Areas we cover</h2>
            </div>
          </div>

          <div className="area-grid">
            {areas.map((area) => (
              <Link
                key={area.name}
                to={`/search?q=${encodeURIComponent(area.query)}`}
                className="area-tile"
                data-reveal-tile
              >
                <img src={area.image} alt="" loading="lazy" />
                <span className="area-tile-label">
                  <span className="area-tile-name">{area.name}</span>
                  <span className="area-tile-count">{area.blurb}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- BAND ---------- */}
      <section className="band">
        <div className="container" data-reveal>
          <p className="band-quote">
            The right house is usually the one you nearly didn’t view.
          </p>
        </div>
      </section>

      {/* ---------- RENTALS ---------- */}
      <section className="section">
        <div className="container">
          <div className="section-head" data-reveal>
            <div>
              <p className="eyebrow">Lettings</p>
              <h2>Available to rent now</h2>
            </div>
            <Link to="/search?listingType=rent" className="btn btn-ghost btn-sm">
              See all rentals
              <Icon name="arrowRight" size={15} />
            </Link>
          </div>

          {loading ? (
            <div className="grid-cards">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton skeleton-card" />
              ))}
            </div>
          ) : (
            <div className="grid-cards">
              {rentals.map((l) => (
                <div key={l.id} data-reveal-card>
                  <PropertyCard listing={l} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------- MAP CTA ---------- */}
      <section className="section section-sunken">
        <div className="container-narrow" style={{ textAlign: 'center' }} data-reveal>
          <p className="eyebrow">Search properly</p>
          <h2 style={{ marginBlock: 'var(--space-3) var(--space-4)' }}>
            Draw a shape on the map and we’ll look inside it
          </h2>
          <p className="lede" style={{ marginInline: 'auto', marginBottom: 'var(--space-6)' }}>
            Filter by walking distance from a station, a school, or anywhere
            else that matters — not by postcode districts drawn in 1917.
          </p>
          <Link to="/search" className="btn btn-primary btn-lg">
            <Icon name="pin" size={17} />
            Open the map search
          </Link>
        </div>
      </section>
    </div>
  )
}