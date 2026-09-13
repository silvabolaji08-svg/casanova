import { useCallback, useEffect, useRef } from 'react'
import L from 'leaflet'

import { formatPriceShort } from '../lib/format.js'
import { useDebouncedCallback } from '../hooks/useDebounce.js'

/* Flip to true when the map misbehaves. */
const DEBUG_MAP = false

/**
 * OpenStreetMap's own tile server. Genuinely free, no key, no account.
 *
 * CARTO's basemaps now require an API key and watermark their tiles
 * without one, which is why this changed. There is no dark OSM tileset,
 * so dark mode inverts these with a CSS filter on the tile pane — see
 * section 23 of index.css.
 */
const TILES = {
  light: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  dark: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
}

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/* Central London, roughly. Where the map opens before anything is known. */
const DEFAULT_CENTRE = [51.5074, -0.1278]
const DEFAULT_ZOOM = 12

/**
 * How much the viewport must actually change before it counts as a new
 * search area, as a fraction of the viewport's own size.
 */
const BOUNDS_TOLERANCE = 0.01

/**
 * Smallest container we will do geometry on, in pixels.
 *
 * A hidden element measures 0×0. Leaflet's fitBounds divides by the
 * container size to work out a zoom level, so a zero-size map produces
 * Infinity, then a NaN centre, then a thrown error that takes the whole
 * React tree down with it. Everything that reads the map's geometry
 * checks this first.
 */
const MIN_USABLE_PX = 2

/**
 * Spreads markers that sit on top of each other.
 *
 * Two flats in the same building have coordinates within a few metres, so
 * their price pills land exactly on top of one another and one is simply
 * invisible. This nudges each duplicate outward along a golden-angle
 * spiral — the same arrangement as seeds in a sunflower head, which packs
 * points evenly without them lining up in spokes.
 */
function spreadOverlapping(pins) {
  const seen = new Map()

  return pins.map((pin) => {
    const key = `${pin.lat.toFixed(4)},${pin.lng.toFixed(4)}`
    const n = seen.get(key) ?? 0
    seen.set(key, n + 1)

    if (n === 0) return pin

    /* 137.5° is the golden angle. The radius grows every six markers, so a
       big cluster expands in rings rather than one long line. */
    const angle = (n * 137.5 * Math.PI) / 180
    const radius = 0.00012 * Math.ceil(n / 6)

    /* A degree of longitude is shorter than a degree of latitude away from
       the equator, so the longitude offset is divided by cos(latitude) to
       keep the spiral circular on screen rather than squashed. */
    const latRad = (pin.lat * Math.PI) / 180

    return {
      ...pin,
      lat: pin.lat + radius * Math.sin(angle),
      lng: pin.lng + (radius * Math.cos(angle)) / Math.cos(latRad),
    }
  })
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/* A coordinate we can safely hand to Leaflet. */
function usablePin(pin) {
  return Number.isFinite(pin?.lat) && Number.isFinite(pin?.lng)
}

/**
 * Has the view moved enough to be worth a new search?
 *
 * Compared against the size of the viewport rather than a fixed number of
 * degrees, because a movement that is trivial at city zoom is enormous at
 * street zoom.
 */
function movedEnough(previous, next) {
  if (!previous) return true

  const latSpan = Math.abs(next.getNorth() - next.getSouth())
  const lngSpan = Math.abs(next.getEast() - next.getWest())
  const latTol = latSpan * BOUNDS_TOLERANCE
  const lngTol = lngSpan * BOUNDS_TOLERANCE

  return (
    Math.abs(previous.getNorth() - next.getNorth()) > latTol ||
    Math.abs(previous.getSouth() - next.getSouth()) > latTol ||
    Math.abs(previous.getEast() - next.getEast()) > lngTol ||
    Math.abs(previous.getWest() - next.getWest()) > lngTol
  )
}

/**
 * Leaflet, driven directly.
 *
 * React and Leaflet want opposite things: React describes what the DOM
 * should look like, Leaflet owns a piece of DOM and mutates it. So the
 * container div is the only thing React renders, and every change after
 * that is an imperative call inside an effect.
 *
 * @param interactive  true for the search page, where panning IS the
 *                     interface. false for the small locator maps, which
 *                     should not steal the page's scroll on a phone.
 * @param fitToken     bump this number to re-frame the view around the
 *                     current pins — how a search recentres the map.
 */
export default function MapView({
  pins = [],
  theme = 'light',
  activeId = null,
  onActiveChange,
  onBoundsChange,
  fitToken = 0,
  drawing = false,
  drawPoints = [],
  onDrawPoint,
  interactive = true,
  className = '',
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const tileRef = useRef(null)
  /* id → Leaflet marker, so a hover finds one marker in constant time
     rather than searching an array. */
  const markersRef = useRef(new Map())
  const layerRef = useRef(null)
  const drawLayerRef = useRef(null)

  /**
   * True while WE are moving the map, rather than the user.
   *
   * Without this there is a loop: a search re-frames the map, the fit fires
   * moveend, moveend reports a new viewport, and that viewport filters the
   * search you just ran. A user's pan should filter; our own fit should
   * not.
   */
  const programmaticRef = useRef(false)
  const programmaticTimerRef = useRef(null)

  /* The last viewport we actually told the page about. */
  const lastEmittedRef = useRef(null)

  /* A fit that was asked for while the map was hidden, still owed. */
  const pendingFitRef = useRef(false)

  /**
   * The current pins, readable from callbacks that must not re-subscribe.
   *
   * The fit runs from two places — the effect, and the resize handler
   * registered once at mount — and both need today's pins. A ref gives
   * them that without making either depend on the pins array, which would
   * mean tearing down and re-registering on every search.
   */
  const pinsRef = useRef(pins)
  useEffect(() => {
    pinsRef.current = pins
  }, [pins])

  /* Debounced so a drag produces one request, not forty. */
  const emitBounds = useDebouncedCallback((bounds) => {
    onBoundsChange?.(bounds)
  }, 400)

  /**
   * Frame the current pins. Returns false if it couldn't.
   *
   * "Couldn't" almost always means the map is hidden — the mobile layout
   * swaps the map out for the list with display:none, and a hidden element
   * measures 0×0. Asking Leaflet to fit a bounding box into zero pixels
   * throws, and an uncaught throw during a React update blanks the entire
   * page. Refusing and reporting back is the whole fix.
   */
  const fitToPins = useCallback(() => {
    const map = mapRef.current
    if (!map) return false

    const size = map.getSize()
    if (size.x < MIN_USABLE_PX || size.y < MIN_USABLE_PX) return false

    const usable = pinsRef.current.filter(usablePin)
    if (!usable.length) return false

    const bounds = L.latLngBounds(usable.map((p) => [p.lat, p.lng]))
    if (!bounds.isValid()) return false

    if (DEBUG_MAP) console.log('[map] FIT', bounds.toBBoxString())

    /* Flag BEFORE moving, so the moveend this causes is recognised as ours
       and does not kick off a bounds-filtered refetch. */
    programmaticRef.current = true

    /**
     * A safety net for the flag.
     *
     * If the map is already exactly where the fit wants it, Leaflet moves
     * nothing and fires no moveend — so the flag would stay raised and
     * silently swallow the user's next real pan. Clearing it after the
     * animation's own lifetime means a missing moveend costs nothing.
     */
    clearTimeout(programmaticTimerRef.current)
    programmaticTimerRef.current = setTimeout(() => {
      programmaticRef.current = false
    }, 1200)

    const options = {
      padding: [56, 56],
      /* Don't zoom past street level even for a single result — one pin
         filling the screen loses all context. */
      maxZoom: 15,
    }

    if (reducedMotion()) {
      map.fitBounds(bounds, { ...options, animate: false })
    } else {
      map.flyToBounds(bounds, { ...options, duration: 0.8 })
    }

    return true
  }, [])

  /* ---------- 1. create the map, once ---------- */

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    /**
     * StrictMode runs effects twice in development. Leaflet throws
     * "Map container is already initialized" on the second run if the
     * first map is still attached — so cleanup must genuinely remove it,
     * and this guard covers the window where it hasn't yet.
     */
    if (mapRef.current) return

    const map = L.map(el, {
      center: DEFAULT_CENTRE,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,

      /**
       * Scroll and drag behaviour, and this is a mobile decision.
       *
       * On a phone, one finger dragging a full-width map pans the map
       * instead of scrolling the page — so the reader gets stuck at the
       * map and cannot get past it.
       */
      scrollWheelZoom: interactive,
      dragging: interactive || !L.Browser.mobile,

      /* Stops the user panning off into grey nothing. */
      maxBounds: L.latLngBounds([51.15, -0.7], [51.8, 0.4]),
      maxBoundsViscosity: 0.7,
      minZoom: 9,
      maxZoom: 18,
      attributionControl: true,
    })

    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    drawLayerRef.current = L.layerGroup().addTo(map)

    map.on('moveend', () => {
      /* Our own fit — consume the flag and report nothing. */
      if (programmaticRef.current) {
        programmaticRef.current = false
        clearTimeout(programmaticTimerRef.current)
        if (DEBUG_MAP) console.log('[map] moveend — ours, ignored')
        return
      }

      /* Same zero-size trap as the fit, on the reading side. */
      const size = map.getSize()
      if (size.x < MIN_USABLE_PX || size.y < MIN_USABLE_PX) return

      const bounds = map.getBounds()
      const sw = bounds.getSouthWest()
      const ne = bounds.getNorthEast()
      /* A rectangle needs width AND height. */
      if (sw.lng === ne.lng || sw.lat === ne.lat) return

      /**
       * invalidateSize(), a nudge back inside maxBounds, an animation
       * landing a fraction off — all fire moveend without the user having
       * done anything. Comparing against the last viewport we reported
       * breaks the refetch loop no matter which of them caused it.
       */
      if (!movedEnough(lastEmittedRef.current, bounds)) {
        if (DEBUG_MAP) console.log('[map] moveend — too small, ignored')
        return
      }

      lastEmittedRef.current = bounds
      if (DEBUG_MAP) console.log('[map] moveend — EMIT', bounds.toBBoxString())
      emitBounds(bounds)
    })

    /**
     * Leaflet measures its container when created. If the container was
     * hidden or mid-layout at that moment — which happens with the mobile
     * list/map toggle, and with flex layouts generally — it computes the
     * wrong size and renders tiles into a strip.
     */
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ pan: false })

      /* The map has just become visible and we owe it a fit. This is how
         switching to Map view on a phone lands on the right area rather
         than on the default view of central London. */
      if (pendingFitRef.current && fitToPins()) {
        pendingFitRef.current = false
      }
    })
    ro.observe(el)

    /* One more nudge after the first paint, for the initial layout. */
    const raf = requestAnimationFrame(() => map.invalidateSize({ pan: false }))

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(programmaticTimerRef.current)
      ro.disconnect()
      map.remove()
      mapRef.current = null
      layerRef.current = null
      drawLayerRef.current = null
      markersRef.current.clear()
    }
    /* Deliberately minimal: the map is created once and never recreated. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------- 2. tiles follow the theme ---------- */

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (tileRef.current) map.removeLayer(tileRef.current)

    /* No detectRetina: OSM does not serve @2x tiles, so asking for them
       just doubles the requests for nothing. */
    tileRef.current = L.tileLayer(TILES[theme] ?? TILES.light, {
      attribution: ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map)
  }, [theme])

  /* ---------- 3. markers follow the pins ---------- */

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    layer.clearLayers()
    markersRef.current.clear()

    for (const pin of spreadOverlapping(pins.filter(usablePin))) {
      /**
       * A divIcon, not Leaflet's default marker.
       *
       * The default is a PNG referenced by a relative path inside the
       * package, which bundlers rewrite and break — the classic "invisible
       * markers" bug. Our own HTML avoids it entirely, and shows the price,
       * which is what someone scanning a property map actually wants.
       */
      const label = formatPriceShort(pin.price, pin.listingType, pin.rentPeriod)

      const icon = L.divIcon({
        className: '',
        html: `<span class="pin" data-pin-id="${pin.id}">${label}</span>`,
        /* Sized generously, anchored at the centre-bottom so the pill sits
           above the coordinate rather than covering it. */
        iconSize: [64, 22],
        iconAnchor: [32, 22],
      })

      /* Leaflet takes [lat, lng]. The API gave us lat and lng by name
         precisely so this line cannot be got the wrong way round. */
      const marker = L.marker([pin.lat, pin.lng], {
        icon,
        keyboard: false,
        title: pin.title,
      })

      /* The locator maps have nothing to navigate to — they are already
         showing that property. */
      if (interactive) {
        marker.bindPopup(
          `<div class="map-popup">
             <div class="map-popup-price">${label}</div>
             <div class="map-popup-title">${escapeHtml(pin.title)}</div>
             <a class="btn btn-primary btn-sm" href="/property/${pin.slug}">View property</a>
           </div>`,
          { closeButton: true, offset: [0, -14] }
        )

        marker.on('mouseover', () => onActiveChange?.(pin.id))
        marker.on('mouseout', () => onActiveChange?.(null))
      }

      marker.addTo(layer)
      markersRef.current.set(String(pin.id), marker)
    }
  }, [pins, onActiveChange, interactive])

  /* ---------- 4. highlight the active pin ---------- */

  useEffect(() => {
    /**
     * Reaching into the DOM rather than re-rendering the markers.
     *
     * Rebuilding every icon to change one class would destroy and recreate
     * the whole layer on each hover — hundreds of DOM operations to change
     * one border colour. This is why the pin markup carries a data-pin-id.
     */
    for (const [id, marker] of markersRef.current) {
      const el = marker.getElement()?.querySelector('.pin')
      if (!el) continue
      el.classList.toggle('is-active', String(activeId) === id)
    }
  }, [activeId, pins])

  /* ---------- 5. re-frame the view when asked ---------- */

  useEffect(() => {
    if (!fitToken) return

    /* If the map is hidden right now, remember that we owe it a fit and
       let the resize handler do it the moment it appears. */
    if (!fitToPins()) {
      pendingFitRef.current = true
      if (DEBUG_MAP) console.log('[map] fit deferred — map not visible')
    }
  }, [fitToken, fitToPins])

  /* ---------- 6. drawing a search area ---------- */

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    /* The cursor is the only affordance saying you are in draw mode. */
    map.getContainer().style.cursor = drawing ? 'crosshair' : ''

    if (!drawing) return

    const onClick = (e) => onDrawPoint?.(e.latlng)
    map.on('click', onClick)

    return () => {
      map.off('click', onClick)
      map.getContainer().style.cursor = ''
    }
  }, [drawing, onDrawPoint])

  /* Redraw the shape whenever its points change. */
  useEffect(() => {
    const layer = drawLayerRef.current
    if (!layer) return

    layer.clearLayers()
    if (!drawPoints.length) return

    const latlngs = drawPoints.map((p) => [p.lat, p.lng])

    /* Under three points it isn't an area yet, so show the line only. */
    if (drawPoints.length < 3) {
      L.polyline(latlngs, { color: '#8c4a2f', weight: 2, dashArray: '4 4' }).addTo(layer)
    } else {
      L.polygon(latlngs, {
        color: '#8c4a2f',
        weight: 2,
        fillColor: '#8c4a2f',
        fillOpacity: 0.08,
      }).addTo(layer)
    }

    /* Small handles on each vertex, so it reads as editable. */
    for (const p of drawPoints) {
      L.circleMarker([p.lat, p.lng], {
        radius: 4,
        color: '#8c4a2f',
        fillColor: '#fff',
        fillOpacity: 1,
        weight: 2,
      }).addTo(layer)
    }
  }, [drawPoints])

  return <div ref={containerRef} className={`map ${className}`} />
}

/* Popup content is set as HTML, and property titles are agent-supplied, so
   they are escaped before going in. Interpolating untrusted text into HTML
   is how cross-site scripting happens. */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}