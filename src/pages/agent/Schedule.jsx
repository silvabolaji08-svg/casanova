import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import Icon from '../../components/Icon.jsx'
import { viewingsApi, ApiError } from '../../lib/api.js'
import { formatDate, formatTime, formatAddress } from '../../lib/format.js'

const STATUS_TONE = {
  requested: 'badge-warn',
  confirmed: 'badge-positive',
  completed: 'badge',
  declined: 'badge-danger',
  cancelled: 'badge-danger',
}

const STATUS_LABEL = {
  requested: 'Requested',
  confirmed: 'Confirmed',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
}

/* A date as YYYY-MM-DD in UTC — the format the API's `from` parameter
   parses, and the same basis the slots were generated on. */
function utcDay(offsetDays = 0) {
  const now = new Date()
  const ms = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) +
    offsetDays * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

export default function Schedule() {
  const [items, setItems] = useState([])
  const [from, setFrom] = useState(utcDay(0))
  const [days, setDays] = useState(14)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const load = (signal) =>
    viewingsApi
      .schedule({ from, days }, { signal })
      .then((data) => {
        setItems(data.items)
        setError('')
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message)
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false)
      })

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    load(controller.signal)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, days])

  /**
   * Group into days.
   *
   * A flat list of thirty appointments is not a diary. A Map preserves
   * insertion order, and the API already returns them ascending by
   * startAt, so grouping by date key gives days in order for free — no
   * second sort.
   */
  const byDay = useMemo(() => {
    const map = new Map()
    for (const v of items) {
      const key = new Date(v.startAt).toISOString().slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(v)
    }
    return map
  }, [items])

  const counts = useMemo(() => {
    const out = { requested: 0, confirmed: 0, total: 0 }
    for (const v of items) {
      out.total += 1
      if (v.status === 'requested') out.requested += 1
      if (v.status === 'confirmed') out.confirmed += 1
    }
    return out
  }, [items])

  const act = async (reference, status) => {
    setBusy(reference)
    setError('')
    try {
      await viewingsApi.setStatus(reference, status)
      /* Refetch — the API enforces the state machine, so it is the
         authority on what the status actually became. */
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update that viewing')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="stack" style={{ gap: 'var(--space-6)' }}>
      {/* summary */}
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-value">{counts.requested}</div>
          <div className="stat-label">Awaiting your reply</div>
        </div>
        <div className="stat">
          <div className="stat-value">{counts.confirmed}</div>
          <div className="stat-label">Confirmed</div>
        </div>
        <div className="stat">
          <div className="stat-value">{counts.total}</div>
          <div className="stat-label">In this window</div>
        </div>
      </div>

      {/* range controls */}
      <div className="panel" style={{ padding: 'var(--space-4)' }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div className="field" style={{ minWidth: 160 }}>
            <label className="label" htmlFor="sch-from">
              From
            </label>
            <input
              id="sch-from"
              className="input"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="field" style={{ minWidth: 140 }}>
            <label className="label" htmlFor="sch-days">
              Showing
            </label>
            <select
              id="sch-days"
              className="select"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
            </select>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ alignSelf: 'flex-end' }}
            onClick={() => setFrom(utcDay(0))}
          >
            Today
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="stack">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 88 }} />
          ))}
        </div>
      ) : byDay.size === 0 ? (
        <div className="empty">
          <Icon name="calendar" size={28} />
          <p className="empty-title">Nothing booked</p>
          <p>No viewings in this window. Try widening the range.</p>
        </div>
      ) : (
        [...byDay.entries()].map(([date, viewings]) => (
          <section key={date}>
            <div
              className="row-between"
              style={{
                paddingBottom: 'var(--space-2)',
                marginBottom: 'var(--space-3)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <h2 style={{ fontSize: 'var(--text-lg)' }}>
                {formatDate(`${date}T12:00:00Z`, { weekday: 'long', month: 'long' })}
              </h2>
              <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                {viewings.length} {viewings.length === 1 ? 'viewing' : 'viewings'}
              </span>
            </div>

            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              {viewings.map((v) => (
                <div key={v.id} className="panel" style={{ padding: 'var(--space-4)' }}>
                  <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                    <div className="row" style={{ alignItems: 'flex-start', gap: 'var(--space-4)' }}>
                      {/* tabular-nums keeps the times in a straight column
                          instead of jittering with digit widths */}
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: 'var(--text-xl)',
                          fontVariantNumeric: 'tabular-nums',
                          minWidth: 64,
                        }}
                      >
                        {formatTime(v.startAt)}
                      </div>

                      <div>
                        <div className="row" style={{ marginBottom: 'var(--space-1)' }}>
                          <span className={`badge ${STATUS_TONE[v.status]}`}>
                            {STATUS_LABEL[v.status]}
                          </span>
                          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                            {v.reference}
                          </span>
                        </div>

                        <Link to={`/property/${v.listing?.slug}`} className="link" style={{ fontWeight: 500 }}>
                          {v.listing?.title ?? 'Property'}
                        </Link>
                        <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                          {formatAddress(v.listing?.address)}
                        </p>

                        <p style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
                          <strong>{v.contact?.name}</strong>
                          {v.contact?.phone ? (
                            <>
                              {' · '}
                              <a href={`tel:${v.contact.phone.replace(/\s/g, '')}`} className="link">
                                {v.contact.phone}
                              </a>
                            </>
                          ) : null}
                          {v.contact?.email ? (
                            <>
                              {' · '}
                              <a href={`mailto:${v.contact.email}`} className="link">
                                {v.contact.email}
                              </a>
                            </>
                          ) : null}
                        </p>

                        {v.notes && (
                          <p
                            className="muted"
                            style={{
                              fontSize: 'var(--text-sm)',
                              marginTop: 'var(--space-2)',
                              paddingLeft: 'var(--space-3)',
                              borderLeft: '2px solid var(--border)',
                            }}
                          >
                            “{v.notes}”
                          </p>
                        )}
                      </div>
                    </div>

                    {/**
                     * Actions are driven by the same state machine the API
                     * enforces: requested → confirmed | declined,
                     * confirmed → completed. Showing a button the server
                     * would reject is worse than showing none.
                     */}
                    <div className="row" style={{ flexWrap: 'wrap' }}>
                      {v.status === 'requested' && (
                        <>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => act(v.reference, 'confirmed')}
                            disabled={busy === v.reference}
                          >
                            {busy === v.reference ? <span className="spinner" /> : <Icon name="check" size={14} />}
                            Confirm
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => act(v.reference, 'declined')}
                            disabled={busy === v.reference}
                          >
                            Decline
                          </button>
                        </>
                      )}

                      {v.status === 'confirmed' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => act(v.reference, 'completed')}
                          disabled={busy === v.reference}
                        >
                          {busy === v.reference ? <span className="spinner" /> : <Icon name="check" size={14} />}
                          Mark as done
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}