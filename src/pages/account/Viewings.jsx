import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import Icon from '../../components/Icon.jsx'
import { viewingsApi, ApiError } from '../../lib/api.js'
import { formatDate, formatTime, formatRelative, formatAddress } from '../../lib/format.js'

const STATUS_TONE = {
  requested: 'badge-warn',
  confirmed: 'badge-positive',
  completed: 'badge',
  declined: 'badge-danger',
  cancelled: 'badge-danger',
}

const STATUS_LABEL = {
  requested: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
}

export default function Viewings() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  /* Holds a reference, not a boolean — so the confirmation appears on the
     right row rather than on all of them at once. */
  const [confirming, setConfirming] = useState(null)
  const [busy, setBusy] = useState('')

  const load = (signal) =>
    viewingsApi
      .mine({ signal })
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
    load(controller.signal)
    return () => controller.abort()
  }, [])

  /**
   * Split into upcoming and past.
   *
   * The API returns them newest-first, which is right for history and wrong
   * for a diary — so upcoming is re-sorted ascending. The next appointment
   * should be at the top of the list you act on.
   */
  const { upcoming, past } = useMemo(() => {
    const now = Date.now()
    const up = []
    const done = []

    for (const v of items) {
      const isFuture = new Date(v.endAt).getTime() >= now
      const isLive = v.status === 'requested' || v.status === 'confirmed'
      if (isFuture && isLive) up.push(v)
      else done.push(v)
    }

    up.sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
    return { upcoming: up, past: done }
  }, [items])

  const cancel = async (reference) => {
    setBusy(reference)
    try {
      await viewingsApi.cancel(reference, '')
      /* Refetch rather than patching local state — the server decides what
         a cancelled viewing looks like, including its cancelledAt. */
      await load()
      setConfirming(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel that viewing')
    } finally {
      setBusy('')
    }
  }

  if (loading) {
    return (
      <div className="stack">
        {[0, 1].map((i) => (
          <div key={i} className="skeleton" style={{ height: 96 }} />
        ))}
      </div>
    )
  }

  return (
    <div className="stack" style={{ gap: 'var(--space-6)' }}>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty">
          <Icon name="calendar" size={28} />
          <p className="empty-title">No viewings yet</p>
          <p>When you book one it will appear here, with the reference.</p>
          <Link to="/search" className="btn btn-primary btn-sm">
            Find something to view
          </Link>
        </div>
      ) : (
        <>
          <section>
            <div className="section-head" style={{ marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--text-xl)' }}>
                Upcoming {upcoming.length > 0 && <span className="muted">({upcoming.length})</span>}
              </h2>
            </div>

            {upcoming.length === 0 ? (
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                Nothing booked at the moment.
              </p>
            ) : (
              <div className="stack">
                {upcoming.map((v) => (
                  <div key={v.id} className="panel" style={{ padding: 'var(--space-4)' }}>
                    <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div>
                        <div className="row" style={{ marginBottom: 'var(--space-2)' }}>
                          <span className={`badge ${STATUS_TONE[v.status]}`}>
                            {STATUS_LABEL[v.status]}
                          </span>
                          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                            {v.reference}
                          </span>
                        </div>

                        <Link
                          to={`/property/${v.listing?.slug}`}
                          style={{ fontWeight: 500 }}
                          className="link"
                        >
                          {v.listing?.title ?? 'Property'}
                        </Link>

                        <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                          {formatAddress(v.listing?.address)}
                        </p>

                        <p
                          className="row"
                          style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-sm)', flexWrap: 'wrap' }}
                        >
                          <span className="row" style={{ gap: 'var(--space-1)' }}>
                            <Icon name="calendar" size={14} />
                            {formatDate(v.startAt, { weekday: 'short', month: 'long' })}
                          </span>
                          <span className="row" style={{ gap: 'var(--space-1)' }}>
                            <Icon name="clock" size={14} />
                            {formatTime(v.startAt)}–{formatTime(v.endAt)}
                          </span>
                          <span className="muted">{formatRelative(v.startAt)}</span>
                        </p>

                        {v.agent && (
                          <p className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)' }}>
                            With {v.agent.name}
                            {v.agent.phone ? ` · ${v.agent.phone}` : ''}
                          </p>
                        )}
                      </div>

                      <div>
                        {confirming === v.reference ? (
                          <div className="row">
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => cancel(v.reference)}
                              disabled={busy === v.reference}
                            >
                              {busy === v.reference ? <span className="spinner" /> : null}
                              Yes, cancel
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setConfirming(null)}
                            >
                              Keep it
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setConfirming(v.reference)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <div className="section-head" style={{ marginBottom: 'var(--space-4)' }}>
                <h2 style={{ fontSize: 'var(--text-xl)' }}>
                  Past <span className="muted">({past.length})</span>
                </h2>
              </div>

              <div className="panel">
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Property</th>
                        <th>When</th>
                        <th>Status</th>
                        <th>Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {past.map((v) => (
                        <tr key={v.id}>
                          <td>
                            <Link to={`/property/${v.listing?.slug}`} className="link">
                              {v.listing?.title ?? 'Property'}
                            </Link>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {formatDate(v.startAt)} · {formatTime(v.startAt)}
                          </td>
                          <td>
                            <span className={`badge ${STATUS_TONE[v.status]}`}>
                              {STATUS_LABEL[v.status]}
                            </span>
                          </td>
                          <td className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                            {v.reference}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}