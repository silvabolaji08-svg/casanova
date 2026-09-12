import { useState } from 'react'

import { useStore } from '../../context/StoreContext.jsx'

export default function Profile() {
  const { user, updateProfile, isAgent } = useStore()

  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone ?? '',
    agency: user.agency ?? '',
    bio: user.bio ?? '',
    workStart: user.workingHours?.start ?? '09:00',
    workEnd: user.workingHours?.end ?? '18:00',
    slotMinutes: user.slotMinutes ?? 30,
    workingDays: user.workingDays ?? [1, 2, 3, 4, 5],
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  /* 0 = Sunday, matching JavaScript's getDay() and the API's workingDays. */
  const toggleDay = (day) =>
    setForm((f) => ({
      ...f,
      workingDays: f.workingDays.includes(day)
        ? f.workingDays.filter((d) => d !== day)
        : [...f.workingDays, day].sort(),
    }))

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return

    setBusy(true)
    setMessage(null)

    try {
      const res = await updateProfile({
        name: form.name.trim(),
        phone: form.phone.trim(),
        ...(isAgent
          ? {
              agency: form.agency.trim(),
              bio: form.bio.trim(),
              workingDays: form.workingDays,
              workingHours: { start: form.workStart, end: form.workEnd },
              slotMinutes: Number(form.slotMinutes),
            }
          : {}),
      })
      setMessage(res.ok ? { ok: true, text: 'Saved' } : { ok: false, text: res.error })
    } finally {
      setBusy(false)
    }
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <form className="panel" style={{ padding: 'var(--space-5)', maxWidth: 560 }} onSubmit={submit}>
      {message && (
        <div
          className={`alert ${message.ok ? 'alert-success' : 'alert-error'}`}
          role="status"
          style={{ marginBottom: 'var(--space-5)' }}
        >
          {message.text}
        </div>
      )}

      <div className="stack" style={{ gap: 'var(--space-5)' }}>
        <div className="field">
          <label className="label" htmlFor="pf-name">
            Full name
          </label>
          <input id="pf-name" className="input" value={form.name} onChange={set('name')} required />
        </div>

        <div className="field">
          <label className="label" htmlFor="pf-email">
            Email
          </label>
          {/* Read-only: changing an email is an identity change and needs
              verification, which this project doesn't implement. Showing it
              disabled is more honest than offering an input that lies. */}
          <input id="pf-email" className="input" value={user.email} disabled />
          <p className="form-note">Email changes aren’t supported yet.</p>
        </div>

        <div className="field">
          <label className="label" htmlFor="pf-phone">
            Phone
          </label>
          <input
            id="pf-phone"
            className="input"
            type="tel"
            value={form.phone}
            onChange={set('phone')}
          />
        </div>

        {isAgent && (
          <>
            <div className="field">
              <label className="label" htmlFor="pf-agency">
                Agency
              </label>
              <input id="pf-agency" className="input" value={form.agency} onChange={set('agency')} />
            </div>

            <div className="field">
              <label className="label" htmlFor="pf-bio">
                Bio
              </label>
              <textarea id="pf-bio" className="textarea" value={form.bio} onChange={set('bio')} />
            </div>

            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="label" style={{ marginBottom: 'var(--space-2)' }}>
                Working days
              </legend>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {dayNames.map((name, day) => (
                  <button
                    key={name}
                    type="button"
                    className={`btn btn-sm ${form.workingDays.includes(day) ? 'btn-primary' : 'btn-secondary'}`}
                    aria-pressed={form.workingDays.includes(day)}
                    onClick={() => toggleDay(day)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <p className="form-note" style={{ marginTop: 'var(--space-2)' }}>
                Viewings can only be booked on these days.
              </p>
            </fieldset>

            <div className="row" style={{ gap: 'var(--space-4)', alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: 1 }}>
                <label className="label" htmlFor="pf-start">
                  Start
                </label>
                <input
                  id="pf-start"
                  className="input"
                  type="time"
                  value={form.workStart}
                  onChange={set('workStart')}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label className="label" htmlFor="pf-end">
                  End
                </label>
                <input
                  id="pf-end"
                  className="input"
                  type="time"
                  value={form.workEnd}
                  onChange={set('workEnd')}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label className="label" htmlFor="pf-slot">
                  Viewing length
                </label>
                <select
                  id="pf-slot"
                  className="select"
                  value={form.slotMinutes}
                  onChange={set('slotMinutes')}
                >
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                </select>
              </div>
            </div>
          </>
        )}

        <button type="submit" className="btn btn-primary" disabled={busy} style={{ alignSelf: 'flex-start' }}>
          {busy ? (
            <>
              <span className="spinner" /> Saving…
            </>
          ) : (
            'Save changes'
          )}
        </button>
      </div>
    </form>
  )
}