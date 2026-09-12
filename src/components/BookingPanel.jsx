import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import Icon from './Icon.jsx'
import { viewingsApi, ApiError } from '../lib/api.js'
import { useStore } from '../context/StoreContext.jsx'
import { formatDateTime } from '../lib/format.js'

/* A date as YYYY-MM-DD in UTC, matching what the API parses. Using the
   local date here would put someone in Sydney on the wrong day. */
function toApiDate(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

export default function BookingPanel({ listing }) {
  const { isAuthed, user } = useStore()

  const [days, setDays] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [notes, setNotes] = useState('')

  const [loadingDays, setLoadingDays] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [booked, setBooked] = useState(null)

  const unavailable = listing.status === 'sold' || listing.status === 'let'

  /* ---------- which days have anything free ---------- */

  useEffect(() => {
    if (unavailable) {
      setLoadingDays(false)
      return
    }

    const controller = new AbortController()

    viewingsApi
      .availabilityRange(listing.slug, 14, { signal: controller.signal })
      .then((data) => {
        setDays(data.days)
        /* Preselect the first day that actually has slots, rather than
           today — which for a Tuesday-to-Saturday agent is often empty. */
        const firstFree = data.days.find((d) => d.count > 0)
        if (firstFree) setSelectedDate(firstFree.date)
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingDays(false)
      })

    return () => controller.abort()
  }, [listing.slug, unavailable])

  /* ---------- slots for the chosen day ---------- */

  useEffect(() => {
    if (!selectedDate) return

    const controller = new AbortController()
    setLoadingSlots(true)
    setSelectedSlot('')

    viewingsApi
      .availability(listing.slug, selectedDate, { signal: controller.signal })
      .then((data) => setSlots(data.slots))
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingSlots(false)
      })

    return () => controller.abort()
  }, [listing.slug, selectedDate])

  /* ---------- submit ---------- */

  const submit = async (e) => {
    e.preventDefault()
    if (!selectedSlot || busy) return

    setBusy(true)
    setError('')

    try {
      const viewing = await viewingsApi.create({
        listing: listing.slug,
        startAt: selectedSlot,
        notes,
      })
      setBooked(viewing)
    } catch (err) {
      /**
       * 409 is the interesting case. It means someone booked that slot
       * between the page loading and this click — the partial unique index
       * on the API rejected the write. So refresh the slots rather than
       * leaving a stale list the user will fail against again.
       */
      if (err instanceof ApiError && err.status === 409) {
        setError(err.message)
        const fresh = await viewingsApi
          .availability(listing.slug, selectedDate)
          .catch(() => null)
        if (fresh) setSlots(fresh.slots)
        setSelectedSlot('')
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not book that viewing')
      }
    } finally {
      /* try/finally, so a thrown error can never leave the button stuck
         in its disabled "Booking…" state. */
      setBusy(false)
    }
  }

  /* ---------- states ---------- */

  if (unavailable) {
    return (
      <div className="booking-panel">
        <p className="booking-title">No longer available</p>
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          This property is {listing.status === 'sold' ? 'sold' : 'let'}. Have a look
          at what else is nearby.
        </p>
      </div>
    )
  }

  if (booked) {
    return (
      <div className="booking-panel">
        <p className="booking-title">Viewing requested</p>
        <div className="alert alert-success" role="status" style={{ marginBottom: 'var(--space-4)' }}>
          <strong>{booked.reference}</strong>
          <br />
          {formatDateTime(booked.startAt)}
        </div>
        <p className="muted" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
          {listing.agent?.name ?? 'The agent'} will confirm shortly. You can see
          it under your viewings.
        </p>
        <Link to="/account/viewings" className="btn btn-secondary btn-block">
          My viewings
        </Link>
      </div>
    )
  }

  if (!isAuthed) {
    return (
      <div className="booking-panel">
        <p className="booking-title">Book a viewing</p>
        <p className="muted" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
          Sign in to see available times and book. It takes a minute.
        </p>
        <Link
          to={`/login?next=/property/${listing.slug}`}
          className="btn btn-primary btn-block"
          style={{ marginBottom: 'var(--space-2)' }}
        >
          Sign in
        </Link>
        <Link to="/register" className="btn btn-secondary btn-block">
          Create an account
        </Link>
      </div>
    )
  }

  return (
    <form className="booking-panel" onSubmit={submit}>
      <p className="booking-title">Book a viewing</p>

      {error && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          {error}
        </div>
      )}

      {loadingDays ? (
        <div className="skeleton" style={{ height: 72, marginBottom: 'var(--space-4)' }} />
      ) : days.every((d) => d.count === 0) ? (
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          {listing.agent?.name ?? 'This agent'} has nothing free in the next
          fortnight. Try calling them directly.
        </p>
      ) : (
        <>
          <div className="date-strip" role="group" aria-label="Choose a date">
            {days.map((day) => {
              const ms = Date.parse(`${day.date}T00:00:00Z`)
              return (
                <button
                  key={day.date}
                  type="button"
                  className="date-cell"
                  aria-pressed={selectedDate === day.date}
                  disabled={day.count === 0}
                  onClick={() => setSelectedDate(day.date)}
                >
                  <span className="date-dow">
                    {new Date(ms).toLocaleDateString('en-GB', {
                      weekday: 'short',
                      timeZone: 'UTC',
                    })}
                  </span>
                  <span className="date-num">
                    {new Date(ms).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      timeZone: 'UTC',
                    })}
                  </span>
                  <span className="date-free">{day.count === 0 ? '—' : day.count}</span>
                </button>
              )
            })}
          </div>

          {loadingSlots ? (
            <div className="skeleton" style={{ height: 90, marginBottom: 'var(--space-4)' }} />
          ) : slots.length === 0 ? (
            <p className="muted" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
              Nothing free on that day.
            </p>
          ) : (
            <div className="slot-grid" role="group" aria-label="Choose a time">
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className="slot"
                  aria-pressed={selectedSlot === slot}
                  onClick={() => setSelectedSlot(slot)}
                >
                  {new Date(slot).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </button>
              ))}
            </div>
          )}

          <div className="field" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="label" htmlFor="booking-notes">
              Anything the agent should know?
            </label>
            <textarea
              id="booking-notes"
              className="textarea"
              rows={3}
              maxLength={500}
              placeholder="Interested in the garden, arriving by bike, bringing a builder…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={!selectedSlot || busy}
          >
            {busy ? 'Booking…' : 'Request this viewing'}
          </button>
        </>
      )}
    </form>
  )
}