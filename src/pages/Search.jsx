import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import Icon from '../components/Icon.jsx'
import PropertyCard from '../components/PropertyCard.jsx'
import MapView from '../components/MapView.jsx'
import Filters, { ActiveFilters } from '../components/Filters.jsx'
import { listingsApi, boundsToParam, polygonToParam } from '../lib/api.js'
import { useStore } from '../context/StoreContext.jsx'

const PER_PAGE = 20

export default function Search() {
  const { theme } = useStore()

  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => Object.fromEntries(searchParams), [searchParams])

  const [areaParam, setAreaParam] = useState('')
  const [useArea, setUseArea] = useState(true)

  const [drawing, setDrawing] = useState(false)
  const [drawPoints, setDrawPoints] = useState([])
  const [polygonParam, setPolygonParam] = useState('')

  const [items, setItems] = useState([])
  const [pins, setPins] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)

  /**
   * Two loading states, not one. This is the whole fix.
   *
   * `hasLoaded` — have we EVER got results? False only on the very first
   *   request, when there is genuinely nothing to show and skeletons are
   *   the honest answer.
   *
   * `busy` — is a request in flight right now? True on every fetch,
   *   including refreshes. Used to dim what's already there, not to
   *   remove it.
   *
   * Collapsing these into one `loading` flag is what made the list blank
   * out on every search: with results already on screen, throwing them
   * away to show grey boxes is strictly worse than leaving them up.
   */
  const [hasLoaded, setHasLoaded] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  const [activeId, setActiveId] = useState(null)
  const [view, setView] = useState('list')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [fitToken, setFitToken] = useState(0)

  const [term, setTerm] = useState(params.q ?? '')

  const resultsRef = useRef(null)
  const refitPendingRef = useRef(true)

  const page = Number(params.page) || 1

  /* Filters without pagination — changing a filter should re-frame the
     map, changing page should not. */
  const filterKey = useMemo(() => {
    const copy = new URLSearchParams(searchParams)
    copy.delete('page')
    return copy.toString()
  }, [searchParams])

  const prevFilterKey = useRef(filterKey)

  /* A new search forgets the old viewport — otherwise searching Camden
     while the map sits over Greenwich returns nothing, because the text
     search and the stale bounds contradict each other. */
  useEffect(() => {
    if (prevFilterKey.current === filterKey) return
    prevFilterKey.current = filterKey
    setAreaParam('')
    refitPendingRef.current = true
  }, [filterKey])

  const queryKey = `${searchParams.toString()}|${useArea ? areaParam : ''}|${polygonParam}`

  useEffect(() => {
    const controller = new AbortController()
    setBusy(true)

    const base = Object.fromEntries(new URLSearchParams(searchParams))
    delete base.page

    if (polygonParam) base.polygon = polygonParam
    else if (useArea && areaParam) base.bounds = areaParam

    /**
     * Both requests in one Promise.all, and every piece of state set in one
     * .then — so the list and the map change in the same render.
     *
     * That is what prevents the two halves disagreeing. React batches state
     * updates inside a single handler, so there is no moment where the map
     * shows the new results and the list still shows the old ones.
     *
     * Out-of-order responses are handled by the AbortController: starting a
     * new search aborts the previous one, so a slow earlier reply can never
     * land after a fast later one and overwrite it.
     */
    Promise.all([
      listingsApi.list(
        {
          ...base,
          page: Number(new URLSearchParams(searchParams).get('page')) || 1,
          limit: PER_PAGE,
        },
        { signal: controller.signal }
      ),
      listingsApi.pins(base, { signal: controller.signal }),
    ])
      .then(([list, pinData]) => {
        setItems(list.items)
        setTotal(list.total)
        setPages(list.pages)
        setPins(pinData.items)
        setError('')
        setHasLoaded(true)

        /* Re-frame the map, but only on a real filter change and only when
           there is something to frame. */
        if (refitPendingRef.current && pinData.items.length) {
          refitPendingRef.current = false
          setFitToken((n) => n + 1)
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false)
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey])

  useEffect(() => {
    setTerm(params.q ?? '')
  }, [params.q])

  /* ---------- handlers ---------- */

  const patch = useCallback(
    (changes) => {
      const next = new URLSearchParams(searchParams)
      for (const [key, value] of Object.entries(changes)) {
        if (value === '' || value === null || value === undefined) next.delete(key)
        else next.set(key, String(value))
      }
      next.delete('page')
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const reset = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
    setPolygonParam('')
    setDrawPoints([])
    setDrawing(false)
  }, [setSearchParams])

  const submitTerm = (e) => {
    e.preventDefault()
    setPolygonParam('')
    setDrawPoints([])
    patch({ q: term.trim() })
    setView('list')
  }

  const goToPage = (n) => {
    const next = new URLSearchParams(searchParams)
    if (n <= 1) next.delete('page')
    else next.set('page', String(n))
    setSearchParams(next, { replace: true })
    resultsRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBounds = useCallback((bounds) => {
    setAreaParam(boundsToParam(bounds))
  }, [])

  const handleDrawPoint = useCallback((latlng) => {
    setDrawPoints((prev) => [...prev, latlng])
  }, [])

  const applyShape = () => {
    if (drawPoints.length < 3) return
    setPolygonParam(polygonToParam(drawPoints))
    setDrawing(false)
  }

  const clearShape = () => {
    setPolygonParam('')
    setDrawPoints([])
    setDrawing(false)
  }

  const startDrawing = () => {
    setDrawPoints([])
    setPolygonParam('')
    setDrawing(true)
    setView('map')
  }

  const areaLabel = polygonParam
    ? 'Inside your shape'
    : useArea && areaParam
      ? 'In the map area'
      : params.q
        ? `matching “${params.q}”`
        : 'across London'

  /* Skeletons only when there is genuinely nothing to show. */
  const showSkeletons = !hasLoaded
  /* Dim what's there while fetching a replacement. */
  const refreshing = busy && hasLoaded

  return (
    <div className="search-page" data-view={view}>
      {/* ================= LEFT: filters + results ================= */}
      <div className="search-panel">
        <form className="search-bar" onSubmit={submitTerm}>
          <label htmlFor="search-term" className="sr-only">
            Search by area, postcode or keyword
          </label>
          <Icon name="search" size={16} className="muted" />
          <input
            id="search-term"
            className="input"
            type="search"
            placeholder="Camden, N1, garden…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            style={{ border: 'none', background: 'transparent' }}
          />
          <button type="submit" className="btn btn-primary btn-sm">
            Search
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setFiltersOpen(true)}
            aria-label="Open filters"
          >
            <Icon name="sliders" size={15} />
            Filters
          </button>
        </form>

        {/* A 2px bar rather than a layout change — nothing moves. */}
        {busy && <div className="search-progress" aria-hidden="true" />}

        <div
          ref={resultsRef}
          className="search-results"
          data-refreshing={refreshing ? 'true' : 'false'}
          /* Tells a screen reader the region is being updated, so it can
             wait rather than announcing half-changed content. */
          aria-busy={busy}
        >
          <div className="search-count">
            <span>
              {showSkeletons ? (
                'Searching…'
              ) : (
                <>
                  <strong style={{ color: 'var(--text)' }}>{total}</strong>{' '}
                  {total === 1 ? 'home' : 'homes'} {areaLabel}
                  {refreshing && <span className="muted"> · updating</span>}
                </>
              )}
            </span>
            {pages > 1 && (
              <span>
                Page {page} of {pages}
              </span>
            )}
          </div>

          <ActiveFilters params={params} onChange={patch} onReset={reset} />

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          {showSkeletons ? (
            <>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="skeleton"
                  style={{ height: 120, borderRadius: 'var(--radius)' }}
                />
              ))}
            </>
          ) : items.length === 0 ? (
            <div className="empty">
              <Icon name="search" size={28} />
              <p className="empty-title">Nothing matches</p>
              <p>
                {polygonParam || (useArea && areaParam)
                  ? 'Try zooming out, clearing the drawn area, or relaxing a filter.'
                  : 'Try a different area, or relax a filter.'}
              </p>
              <button className="btn btn-secondary btn-sm" onClick={reset}>
                Clear everything
              </button>
            </div>
          ) : (
            items.map((listing) => (
              <PropertyCard
                key={listing.id}
                listing={listing}
                compact
                isLinked={activeId === listing.id}
                onHoverStart={setActiveId}
                onHoverEnd={() => setActiveId(null)}
              />
            ))
          )}

          {pages > 1 && !showSkeletons && (
            <div
              className="row"
              style={{ justifyContent: 'center', paddingTop: 'var(--space-4)' }}
            >
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || busy}
              >
                <Icon name="chevronLeft" size={14} />
                Previous
              </button>
              <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                {page} / {pages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => goToPage(page + 1)}
                disabled={page >= pages || busy}
              >
                Next
                <Icon name="chevronRight" size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ================= RIGHT: map ================= */}
      <div className="search-map">
        <MapView
          pins={pins}
          theme={theme}
          activeId={activeId}
          onActiveChange={setActiveId}
          onBoundsChange={handleBounds}
          fitToken={fitToken}
          drawing={drawing}
          drawPoints={drawPoints}
          onDrawPoint={handleDrawPoint}
        />

        {/* Only on the first load. After that the 2px bar in the panel is
            enough — a badge appearing over the map on every pan is noise. */}
        {busy && !hasLoaded && (
          <div className="map-loading" role="status">
            Finding properties…
          </div>
        )}

        <div className="map-tools">
          {!drawing && !polygonParam && (
            <>
              <button
                type="button"
                className={`map-tool ${useArea ? 'is-active' : ''}`}
                onClick={() => setUseArea((v) => !v)}
                aria-pressed={useArea}
              >
                <Icon name="target" size={14} />
                Search this area
              </button>
              <button type="button" className="map-tool" onClick={startDrawing}>
                <Icon name="draw" size={14} />
                Draw an area
              </button>
            </>
          )}

          {drawing && (
            <>
              <span className="map-tool" style={{ cursor: 'default' }}>
                {drawPoints.length < 3
                  ? `Click the map — ${3 - drawPoints.length} more point${drawPoints.length === 2 ? '' : 's'}`
                  : `${drawPoints.length} points`}
              </span>
              <button
                type="button"
                className="map-tool is-active"
                onClick={applyShape}
                disabled={drawPoints.length < 3}
              >
                <Icon name="check" size={14} />
                Search this shape
              </button>
              <button type="button" className="map-tool" onClick={clearShape}>
                <Icon name="close" size={14} />
                Cancel
              </button>
            </>
          )}

          {polygonParam && !drawing && (
            <button type="button" className="map-tool is-active" onClick={clearShape}>
              <Icon name="close" size={14} />
              Clear drawn area
            </button>
          )}

          <button
            type="button"
            className="map-tool"
            onClick={() => setFitToken((n) => n + 1)}
            disabled={!pins.length}
          >
            <Icon name="target" size={14} />
            Fit to results
          </button>
        </div>
      </div>

      {/* ================= mobile: list/map switch ================= */}
      <button
        type="button"
        className="btn btn-primary view-toggle"
        onClick={() => setView((v) => (v === 'list' ? 'map' : 'list'))}
      >
        <Icon name={view === 'list' ? 'pin' : 'list'} size={16} />
        {view === 'list' ? `Map (${pins.length})` : `List (${total})`}
      </button>

      {/* ================= mobile: filter drawer ================= */}
      {filtersOpen && (
        <div className="filter-drawer" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="filter-drawer-backdrop" onClick={() => setFiltersOpen(false)} />
          <div className="filter-drawer-panel">
            <div className="panel-head">
              <span className="panel-title">Filters</span>
              <button
                className="btn-icon"
                onClick={() => setFiltersOpen(false)}
                aria-label="Close filters"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <Filters params={params} onChange={patch} onReset={reset} resultCount={total} />
            <div style={{ padding: 'var(--space-5)', paddingTop: 0 }}>
              <button className="btn btn-primary btn-block" onClick={() => setFiltersOpen(false)}>
                Show {total} {total === 1 ? 'home' : 'homes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}