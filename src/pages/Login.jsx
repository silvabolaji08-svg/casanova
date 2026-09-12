import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import Icon from '../components/Icon.jsx'
import { useStore } from '../context/StoreContext.jsx'

/* The seeded accounts, so the site is explorable without registering.
   These exist in server/src/data/users.js. */
const DEMO = [
  { label: 'Buyer', email: 'demo@casanova.homes', password: 'demo1234' },
  { label: 'Agent', email: 'amara@casanova.homes', password: 'agent1234' },
  { label: 'Admin', email: 'admin@casanova.homes', password: 'admin1234' },
]

export default function Login() {
  const { login } = useStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  /**
   * Where to go after signing in.
   *
   * Only ever a path on this site. Taking an absolute URL from a query
   * parameter and navigating to it is an open redirect — an attacker sends
   * someone /login?next=https://evil.example, they sign in, and get bounced
   * to a convincing fake. Requiring a leading slash closes it.
   */
  const raw = searchParams.get('next') ?? '/account'
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/account'

  const submit = async (e) => {
    e.preventDefault()
    /* Guard against a double submit from an impatient double-click. */
    if (busy) return

    setBusy(true)
    setError('')

    try {
      const res = await login(email.trim(), password)
      if (res.ok) navigate(next, { replace: true })
      else setError(res.error)
    } finally {
      /* finally, so a thrown error can't leave the button stuck. */
      setBusy(false)
    }
  }

  const useDemo = (account) => {
    setEmail(account.email)
    setPassword(account.password)
    setError('')
  }

  return (
    <div className="container-narrow" style={{ paddingBlock: 'var(--space-8)', maxWidth: 460 }}>
      <p className="eyebrow">Welcome back</p>
      <h1 style={{ fontSize: 'var(--text-3xl)', marginBlock: 'var(--space-2) var(--space-6)' }}>
        Sign in
      </h1>

      {error && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: 'var(--space-5)' }}>
          {error}
        </div>
      )}

      <form className="stack" onSubmit={submit} style={{ gap: 'var(--space-5)' }}>
        <div className="field">
          <label className="label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className="input"
            type="email"
            /* Tells a password manager which field is which, so autofill
               works properly. */
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? (
            <>
              <span className="spinner" /> Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      <p className="form-note" style={{ marginTop: 'var(--space-5)', textAlign: 'center' }}>
        No account?{' '}
        <Link to="/register" className="link">
          Create one
        </Link>
      </p>

      <div
        style={{
          marginTop: 'var(--space-7)',
          paddingTop: 'var(--space-5)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <p className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
          Demo accounts
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {DEMO.map((account) => (
            <button
              key={account.email}
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => useDemo(account)}
            >
              <Icon name="user" size={14} />
              {account.label}
            </button>
          ))}
        </div>
        <p className="form-note" style={{ marginTop: 'var(--space-3)' }}>
          Fills the form in — this is a portfolio project, so the seeded
          accounts are public on purpose.
        </p>
      </div>
    </div>
  )
}