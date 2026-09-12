import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { useStore } from '../context/StoreContext.jsx'

export default function Register() {
  const { register } = useStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const raw = searchParams.get('next') ?? '/account'
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/account'

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return

    /**
     * Client-side checks for immediate feedback only.
     *
     * The server validates independently — minlength on the schema, the
     * email format, the unique index. These are a courtesy so the user
     * doesn't wait for a round trip to learn they mistyped, NOT the
     * security boundary. Anyone can POST straight to the API.
     */
    if (form.password !== form.confirm) {
      setError('Those passwords don’t match')
      return
    }
    if (form.password.length < 8) {
      setError('Use at least 8 characters')
      return
    }

    setBusy(true)
    setError('')

    try {
      const res = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      })
      if (res.ok) navigate(next, { replace: true })
      else setError(res.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container-narrow" style={{ paddingBlock: 'var(--space-8)', maxWidth: 460 }}>
      <p className="eyebrow">Join Casanova</p>
      <h1 style={{ fontSize: 'var(--text-3xl)', marginBlock: 'var(--space-2) var(--space-4)' }}>
        Create an account
      </h1>
      <p className="lede" style={{ marginBottom: 'var(--space-6)', fontSize: 'var(--text-base)' }}>
        You’ll be able to save properties and book viewings.
      </p>

      {error && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: 'var(--space-5)' }}>
          {error}
        </div>
      )}

      <form className="stack" onSubmit={submit} style={{ gap: 'var(--space-5)' }}>
        <div className="field">
          <label className="label" htmlFor="reg-name">
            Full name
          </label>
          <input
            id="reg-name"
            className="input"
            autoComplete="name"
            required
            value={form.name}
            onChange={set('name')}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="reg-email">
            Email
          </label>
          <input
            id="reg-email"
            className="input"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={set('email')}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="reg-phone">
            Phone <span className="muted">(optional)</span>
          </label>
          <input
            id="reg-phone"
            className="input"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={set('phone')}
            placeholder="07700 900000"
          />
          <p className="form-note">Agents use this to confirm viewings.</p>
        </div>

        <div className="field">
          <label className="label" htmlFor="reg-password">
            Password
          </label>
          <input
            id="reg-password"
            className="input"
            type="password"
            /* new-password, not current-password — this is what makes a
               password manager offer to GENERATE one rather than autofill
               an existing one. */
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={set('password')}
          />
          <p className="form-note">At least 8 characters.</p>
        </div>

        <div className="field">
          <label className="label" htmlFor="reg-confirm">
            Confirm password
          </label>
          <input
            id="reg-confirm"
            className="input"
            type="password"
            autoComplete="new-password"
            required
            value={form.confirm}
            onChange={set('confirm')}
          />
        </div>

        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? (
            <>
              <span className="spinner" /> Creating account…
            </>
          ) : (
            'Create account'
          )}
        </button>
      </form>

      <p className="form-note" style={{ marginTop: 'var(--space-5)', textAlign: 'center' }}>
        Already registered?{' '}
        <Link to="/login" className="link">
          Sign in
        </Link>
      </p>
    </div>
  )
}