/**
 * The single place the frontend talks to the API.
 *
 * Every request goes through request(), so the base URL, the auth header,
 * JSON parsing and the error shape are decided once instead of at forty
 * call sites.
 */

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api'

const TOKEN_KEY = 'casanova.token'

/* Storage throws in private windows and when site data is blocked, so every
   access is guarded. */
export function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token)
    else window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* in-memory only for this session */
  }
}

export function clearToken() {
  setToken(null)
}

/* Carries the HTTP status so callers can branch on it — 401 means sign in
   again, 409 means a real conflict worth showing the user. */
export class ApiError extends Error {
  constructor(status, message, body) {
    super(message)
    this.status = status
    this.body = body
  }
}

async function request(path, { method = 'GET', body, auth = false, signal } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (err) {
    /**
     * fetch only rejects when the request never completed — server down, no
     * network, DNS failure, CORS blocked. An HTTP 500 is a RESOLVED promise
     * with ok === false, which is why there are two failure paths below.
     */
    if (err.name === 'AbortError') throw err
    throw new ApiError(0, 'Could not reach the server. Is the API running?')
  }

  /* 204 has no body; calling .json() on it throws. */
  const data = res.status === 204 ? null : await res.json().catch(() => null)

  if (!res.ok) {
    /* An expired or revoked token should not linger and keep failing. */
    if (res.status === 401) clearToken()
    throw new ApiError(res.status, data?.message ?? `Request failed (${res.status})`, data)
  }

  return data
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
}

/**
 * Turns a params object into a query string, skipping empty values.
 *
 * Arrays become comma-separated, matching what the API's buildFilter
 * expects for `brand` and `propertyType`.
 */
function toQuery(params) {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      search.set(key, value.join(','))
    } else {
      search.set(key, String(value))
    }
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

/* ---------- geometry helpers ---------- */

/**
 * Leaflet bounds → the string the API wants.
 *
 * THE CONVERSION HAPPENS HERE AND NOWHERE ELSE.
 *
 * Leaflet thinks in [lat, lng]. GeoJSON and MongoDB think in [lng, lat].
 * Both conventions exist in this project, so the flip lives in one named
 * function at the boundary rather than being remembered in every component.
 */
export function boundsToParam(bounds) {
  if (!bounds) return ''
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  /* lng first in the output — the API parses swLng,swLat,neLng,neLat. */
  return [sw.lng, sw.lat, ne.lng, ne.lat].map((n) => n.toFixed(6)).join(',')
}

/* A Leaflet LatLng (or {lat, lng}) → "lng,lat" for the ?near= parameter. */
export function pointToParam(latlng) {
  if (!latlng) return ''
  return `${Number(latlng.lng).toFixed(6)},${Number(latlng.lat).toFixed(6)}`
}

/* An array of Leaflet LatLngs → "lng,lat;lng,lat;..." for a drawn shape. */
export function polygonToParam(latlngs) {
  if (!Array.isArray(latlngs) || latlngs.length < 3) return ''
  return latlngs.map((p) => `${Number(p.lng).toFixed(6)},${Number(p.lat).toFixed(6)}`).join(';')
}

/* ---------- endpoints ---------- */

export const listingsApi = {
  list: (params, opts) => api.get(`/listings${toQuery(params)}`, opts),
  pins: (params, opts) => api.get(`/listings/pins${toQuery(params)}`, opts),
  meta: (opts) => api.get('/listings/meta', opts),
  bySlug: (slug, opts) => api.get(`/listings/${slug}`, { ...opts, auth: Boolean(getToken()) }),
  nearby: (slug, params, opts) => api.get(`/listings/nearby/${slug}${toQuery(params)}`, opts),
  mine: (opts) => api.get('/listings/mine', { ...opts, auth: true }),
  create: (data) => api.post('/listings', data, { auth: true }),
  update: (id, data) => api.put(`/listings/${id}`, data, { auth: true }),
  remove: (id) => api.del(`/listings/${id}`, { auth: true }),
}

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: (opts) => api.get('/auth/me', { ...opts, auth: true }),
  updateProfile: (data) => api.put('/auth/me', data, { auth: true }),
  saved: (opts) => api.get('/auth/saved', { ...opts, auth: true }),
  toggleSaved: (id) => api.post(`/auth/saved/${id}`, undefined, { auth: true }),
}

export const viewingsApi = {
  availability: (listing, date, opts) =>
    api.get(`/viewings/availability${toQuery({ listing, date })}`, opts),
  availabilityRange: (listing, days = 14, opts) =>
    api.get(`/viewings/availability/range${toQuery({ listing, days })}`, opts),
  create: (data) => api.post('/viewings', data, { auth: true }),
  mine: (opts) => api.get('/viewings/mine', { ...opts, auth: true }),
  schedule: (params, opts) => api.get(`/viewings/schedule${toQuery(params)}`, { ...opts, auth: true }),
  byReference: (reference, opts) => api.get(`/viewings/${reference}`, { ...opts, auth: true }),
  cancel: (reference, reason) =>
    api.patch(`/viewings/${reference}/cancel`, { reason }, { auth: true }),
  setStatus: (reference, status) =>
    api.patch(`/viewings/${reference}/status`, { status }, { auth: true }),
}