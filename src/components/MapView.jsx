import { useEffect, useRef } from 'react'
import L from 'leaflet'

import { formatPriceShort } from '../lib/format.js'
import { useDebouncedCallback } from '../hooks/useDebounce.js'

/**
 * Tile sources.
 *
 * CARTO's basemaps, which render OpenStreetMap data in a deliberately muted
 * style — far better for a property map than standard OSM tiles, where the
 * road colours fight the markers. Free, no API key, attribution required.
 *
 * The {r} placeholder becomes "@2x" on high-density screens.
 */
const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
}

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

/* Central London, roughly. Where the map opens before anything is known. */
const DEFAULT_CENTRE = [51.5074, -0.1278]
const DEFAULT_ZOOM = 12

/**
 * Leaflet, driven directly.
 *
 * React and Leaflet want opposite things: React describes what the DOM
 * should look like, Leaflet owns a piece of DOM and mutates it. So the
 * container div is the only thing React renders, and every change after
 * that is an imperative call inside an effect.
 *
 * The rule that keeps this sane: one effect per concern. Creating the map,
 * swapping tiles, syncing markers and wiring drawing are four separate
 * effects with four separate dependency lists. Combining them is how you
 * end up recreating the map every time a price changes.
 */
export default function MapView({
  pins = [],
  theme = 'light',
  activeId = null,
  onActiveChange,
  onBoundsChange,
  /* Bump this number to re-fit the view around the current pins. */
  fitToken = 0,
  drawing = false,
  drawPoints = [],
  onDrawPoint,
  className = '',
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const tileRef = useRef(null)
  /* id → Leaflet marker, so a hover can find one marker in constant time
     instead of searching an array. */
  const markersRef = useRef(new Map())
  const layerRef = useRef(null)
  const drawLayerRef = useRef(null)

  /* Debounced so a drag produces one request, not forty. */
  const emitBounds = useDebouncedCallback((bounds) => {
    onBoundsChange?.(bounds)
  }, 400)

  /* ---------- 1. create the map, once ---------- */

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    /**
     * StrictMode runs effects twice in development. Leaflet throws
     * "Map container is already initialized" on the second run if the
     * first map is still attached — so cleanup must genuinely remove it,
     * and this guard covers the case where it hasn't yet.
     */
    if (mapRef.current) return

    const map = L.map(el, {
      center: DEFAULT_CENTRE,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      /* Leaflet's default is a slightly rubbery scroll zoom; this is
         calmer and matches how other map UIs behave. */
      scrollWheelZoom: true,
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

        /**
     * moveend covers panning and zooming; zoomend alone would miss drags.
     *
     * But a bounds is only meaningful if the container has actually been
     * measured. When the map is hidden — which is exactly what the mobile
     * list/map toggle does with `display: none` — Leaflet reports a size of
     * 0×0 and getBounds() collapses to a single point. Sending that to the
     * API produces a polygon with five identical corners, and MongoDB
     * rejects it: "Loop must have at least 3 different vertices".
     *
     * So: measure first, and refuse to emit anything degenerate.
     */
    map.on('moveend', () => {
      const size = map.getSize()
      if (size.x < 2 || size.y < 2) return

      const bounds = map.getBounds()
      const sw = bounds.getSouthWest()
      const ne = bounds.getNorthEast()
      /* A rectangle needs width AND height. */
      if (sw.lng === ne.lng || sw.lat === ne.lat) return

      emitBounds(bounds)
    })

    /**
     * Leaflet measures its container when created. If the container was
     * hidden or mid-layout at that moment — which happens with the mobile
     * list/map toggle, and with flex layouts generally — it computes the
     * wrong size and renders tiles into a strip.
     *
     * A ResizeObserver tells it to re-measure whenever the box changes.
     */
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)

    /* One more nudge after the first paint, for the initial layout. */
    const raf = requestAnimationFrame(() => map.invalidateSize())

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      map.remove()
      mapRef.current = null
      layerRef.current = null
      drawLayerRef.current = null
      markersRef.current.clear()
    }
    /* Deliberately empty: the map is created once and never recreated.
       Everything else is handled by the effects below. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------- 2. tiles follow the theme ---------- */

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (tileRef.current) map.removeLayer(tileRef.current)

    tileRef.current = L.tileLayer(TILES[theme] ?? TILES.light, {
      attribution: ATTRIBUTION,
      maxZoom: 19,
      /* Serves @2x tiles on retina screens, so labels aren't soft. */
      detectRetina: true,
    }).addTo(map)

    /* Tiles must sit beneath markers. Leaflet puts layers in panes, and
       the tile pane is already below the marker pane, so nothing else is
       needed — but the order of add matters if both were in one pane. */
  }, [theme])

  /* ---------- 3. markers follow the pins ---------- */

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    layer.clearLayers()
    markersRef.current.clear()

    for (const pin of pins) {
      /**
       * A divIcon, not the default marker.
       *
       * Leaflet's default marker is a PNG referenced by a relative path
       * inside the package. Bundlers rewrite that path and the image 404s,
       * which is the classic "my markers are invisible" bug. Supplying our
       * own HTML sidesteps it entirely — and lets the marker show a price,
       * which is what someone scanning a property map actually wants.
       */
      const label = formatPriceShort(pin.price, pin.listingType, pin.rentPeriod)

      const icon = L.divIcon({
        className: '',
        /* textContent-safe: the label comes from our own formatter, never
           from user input, so there is nothing to escape here. */
        html: `<span class="pin" data-pin-id="${pin.id}">${label}</span>`,
        /* Sized generously and anchored at the centre-bottom so the pill
           sits above the coordinate rather than covering it. */
        iconSize: [64, 22],
        iconAnchor: [32, 22],
      })

      /* Leaflet takes [lat, lng]. The API gave us lat and lng by name
         precisely so this line can't be got the wrong way round. */
      const marker = L.marker([pin.lat, pin.lng], {
        icon,
        keyboard: false,
        title: pin.title,
      })

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

      marker.addTo(layer)
      markersRef.current.set(String(pin.id), marker)
    }
  }, [pins, onActiveChange])

  /* ---------- 4. highlight the active pin ---------- */

  useEffect(() => {
    /**
     * Reaching into the DOM rather than re-rendering the markers.
     *
     * Rebuilding every icon to change one class would destroy and recreate
     * the whole layer on each hover. Toggling a class on one element is the
     * cheap, correct move — and it is why the pin markup carries a
     * data-pin-id.
     */
    for (const [id, marker] of markersRef.current) {
      const el = marker.getElement()?.querySelector('.pin')
      if (!el) continue
      el.classList.toggle('is-active', String(activeId) === id)
    }
  }, [activeId, pins])

  /* ---------- 5. fit the view to the pins on request ---------- */

  useEffect(() => {
    const map = mapRef.current
    if (!map || !pins.length || !fitToken) return

    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng]))

    /**
     * `animate: false` matters. An animated fitBounds fires moveend
     * partway through, which triggers a bounds query for an intermediate
     * viewport — and that result arrives after the one we wanted.
     */
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15, animate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToken])

  /* ---------- 6. drawing a search area ---------- */

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    /* The cursor is the only affordance telling someone they're in draw
       mode, so it matters. */
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

/* Popup content is set as HTML, so anything from the database is escaped
   before it goes in. Property titles are agent-supplied — not trusted. */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}