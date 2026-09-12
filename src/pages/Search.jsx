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

  /**
   * The URL is the source of truth for filters.
   *
   * Three things fall out of that for free: the back button works, a search
   * can be copied and shared, and a refresh doesn't lose your filters. The
   * alternative — filters in useState — gives up all three.
   */
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => Object.fromEntries(searchParams), [searchParams])

  /**
   * The map viewport and the drawn shape are deliberately NOT in the URL.
   *
   * Panning fires constantly; writing each move to the URL would either
   * flood the history stack or churn it. The trade-off is that a shared
   * link carries the filters but not the exact viewport — which is the
   * right compromise, and worth knowing you made.
   */
  const [areaParam, setAreaParam] = useState('')
  const [useArea, setUseArea] = useState(true)

  const [drawing, setDrawing] = useState(false)
  const [drawPoints, setDrawPoints] = useState([])
  const [polygonParam, setPolygonParam] = useState('')

  const [items, setItems] = useState([])
  const [pins, setPins] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [mapBusy, setMapBusy] = useState(false)
  const [error, setError] = useState('')

  const [activeId, setActiveId] = useState(null)
  const [view, setView] = useState('list')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [fitToken, setFitToken] = useState(0)

  const [term, setTerm] = useState(params.q ?? '')

  const firstFitDone = useRef(false)
  const resultsRef = useRef(null)

  const page = Number(params.page) || 1

  /**
   * One string that changes exactly when the query should re-run.
   *
   * Using it as the dependency instead of the `params` object matters:
   * `Object.fromEntries` produces a new object every render, so depending on
   * it directly would refetch forever.
   */
  const queryKey = `${searchParams.toString()}|${useArea ? areaParam : ''}|${polygonParam}`

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setMapBusy(true)

    /* Rebuilt from searchParams inside the effect, so it always matches the
       queryKey that triggered this run. */
    const base = Object.fromEntries(new URLSearchParams(searchParams))
    delete base.page

    /* A drawn shape wins over the viewport — it is the more explicit
       request, and the API applies the same precedence. */
    if (polygonParam) base.polygon = polygonParam
    else if (useArea && areaParam) base.bounds = areaParam

    Promise.all([
      listingsApi.list(
        { ...base, page: Number(new URLSearchParams(searchParams).get('page')) || 1, limit: PER_PAGE },
        { signal: controller.signal }
      ),
      /* Pins are never paginated — hiding markers would misrepresent what
         is for sale. This is why the endpoint returns seven fields. */
      listingsApi.pins(base, { signal: controller.signal }),
    ])
      .then(([list, pinData]) => {
        setItems(list.items)
        setTotal(list.total)
        setPages(list.pages)
        setPins(pinData.items)
        setError('')

        /* Frame the results once, on the first load that returns anything.
           Doing it on every load would yank the map away from wherever the
           user had panned to. */
        if (!firstFitDone.current && pinData.items.length) {
          firstFitDone.current = true
          setFitToken((n) => n + 1)
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
          setMapBusy(false)
        }
      })

    return () => controller.abort()
    /* queryKey encodes every input; the others are read fresh inside. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey])

  /* Keep the search box in step when the URL changes from elsewhere — a
     footer link, the back button. */
  useEffect(() => {
    setTerm(params.q ?? '')
  }, [params.q])

  /* ---------- handlers ---------- */

  /**
   * Merge a partial change into the URL.
   *
   * An empty value deletes the parameter rather than setting it blank, which
   * keeps the URL readable and matches what the API treats as "no filter".
   */
  const patch = useCallback(
    (changes) => {
      const next = new URLSearchParams(searchParams)
      for (const [key, value] of Object.entries(changes)) {
        if (value === '' || value === null || value === undefined) next.delete(key)
        else next.set(key, String(value))
      }
      /* Any filter change invalidates the current page number — you should
         land on page 1 of the new results, not page 4 of nothing. */
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
    patch({ q: term.trim() })
  }

  const goToPage = (n) => {
    const next = new URLSearchParams(searchParams)
    if (n <= 1) next.delete('page')
    else next.set('page', String(n))
    setSearchParams(next, { replace: true })
    resultsRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /* MapView debounces before calling this, so it fires once per gesture. */
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

  /* ---------- render ---------- */

  const areaLabel = polygonParam
    ? 'Inside your shape'
    : useArea && areaParam
      ? 'In the map area'
      : 'Everywhere'

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

        <div ref={resultsRef} className="search-results">
          <div className="search-count">
            <span>
              {loading ? (
                'Searching…'
              ) : (
                <>
                  <strong style={{ color: 'var(--text)' }}>{total}</strong>{' '}
                  {total === 1 ? 'home' : 'homes'} · {areaLabel}
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

          {loading ? (
            <>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius)' }} />
              ))}
            </>
          ) : items.length === 0 ? (
            <div className="empty">
              <Icon name="search" size={28} />
              <p className="empty-title">Nothing matches</p>
              <p>
                {polygonParam || (useArea && areaParam)
                  ? 'Try zooming out, clearing the drawn area, or relaxing a filter.'
                  : 'Try relaxing a filter or widening the price range.'}
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

          {pages > 1 && !loading && (
            <div className="row" style={{ justifyContent: 'center', paddingTop: 'var(--space-4)' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
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
                disabled={page >= pages}
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

        {mapBusy && <div className="map-loading">Updating…</div>}

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