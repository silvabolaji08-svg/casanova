import { useEffect, useRef } from 'react'
import L from 'leaflet'

import { formatPriceShort } from '../lib/format.js'
import { useDebouncedCallback } from '../hooks/useDebounce.js'

/**
 * OpenStreetMap's own tile server. Genuinely free, no key, no account.
 *
 * CARTO's basemaps now require an API key and watermark their tiles
 * without one, which is why this changed. There is no dark OSM tileset,
 * so dark mode inverts these with a CSS filter on the tile pane — see
 * section 22 of index.css.
 *
 * OSM's tile policy is fine with a portfolio project's traffic. A real
 * site with real users would move to a paid provider (CARTO, Mapbox,
 * Stadia, MapTiler) — all of which need a key, which is the trade.
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
 * Spreads markers that sit on top of each other.
 *
 * Two flats in the same building have coordinates within a few metres, so
 * their price pills land exactly on top of one another and one is simply
 * invisible. This nudges each duplicate outward along a golden-angle
 * spiral — the same arrangement as seeds in a sunflower head, which packs
 * points evenly without them lining up in spokes.
 *
 * Grouping is on four decimal places, roughly 11 metres. Anything further
 * apart separates on its own once you zoom in.
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

/**
 * Leaflet, driven directly.
 *
 * React and Leaflet want opposite things: React describes what the DOM
 * should look like, Leaflet owns a piece of DOM and mutates it. So the
 * container div is the only thing React renders, and every change after
 * that is an imperative call inside an effect.
 *
 * The rule that keeps this sane: one effect per concern, each with its own
 * dependency list. Merge them and changing the theme would tear down and
 * rebuild the whole map, losing the user's pan position.
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
       * map and cannot get past it. Leaflet's answer is to disable
       * dragging on touch devices, which makes it show a "use two fingers
       * to move the map" hint.
       *
       * The search page needs panning and passes interactive={true}. The
       * small locator maps pass false: no wheel zoom (which on desktop
       * hijacks page scroll too) and no one-finger drag on touch.
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
        return
      }

      /**
       * A bounds is only meaningful once the container has been measured.
       * A hidden map (display:none, which the mobile toggle uses) reports
       * 0×0, and getBounds() then collapses to a single point. MongoDB
       * rejects the resulting polygon: "Loop must have at least 3 different
       * vertices".
       */
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

    for (const pin of spreadOverlapping(pins)) {
      /**
       * A divIcon, not Leaflet's default marker.
       *
       * The default is a PNG referenced by a relative path inside the
       * package, which bundlers rewrite and break — the classic "invisible
       * markers" bug. Our own HTML avoids it entirely, and shows the price,
       * which is what someone scanning a property map actually wants.
       *
       * Leaflet already stacks markers by latitude, so a southern pin draws
       * in front of a northern one; hovering raises the active pin above
       * everything via z-index in the CSS.
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
    const map = mapRef.current
    if (!map || !fitToken) return

    /* Nothing to frame — leave the map where it is. A search with no
       results should not jump the view somewhere arbitrary. */
    if (!pins.length) return

    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng]))

    /* Flag BEFORE moving, so the moveend this causes is recognised as ours
       and does not kick off a bounds-filtered refetch. */
    programmaticRef.current = true

    const options = {
      padding: [56, 56],
      /* Don't zoom past street level even for a single result — one pin
         filling the screen loses all context. */
      maxZoom: 15,
    }

    if (reducedMotion()) {
      map.fitBounds(bounds, { ...options, animate: false })
    } else {
      /* flyToBounds fires moveend exactly once, when it lands — so the
         guard above is consumed at the right moment. A plain animated
         fitBounds fires it repeatedly and would not be safe here. */
      map.flyToBounds(bounds, { ...options, duration: 0.8 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToken])

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
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}