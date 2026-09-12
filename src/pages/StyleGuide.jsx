import { useEffect, useState } from 'react'

/**
 * A living reference for the design system.
 *
 * Useful in its own right, and right now it is how we verify that the fonts
 * loaded, the palette is applied, and the dark theme works — before we build
 * fifteen components on top of all three.
 */
export default function StyleGuide() {
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || 'light'
  )
  const [apiStatus, setApiStatus] = useState('checking…')

  /* Reflect the theme onto <html> and remember the choice. The inline script
     in index.html reads this back on the next page load. */
  useEffect(() => {
    if (theme === 'dark') document.documentElement.dataset.theme = 'dark'
    else delete document.documentElement.dataset.theme
    try {
      window.localStorage.setItem('casanova.theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  /* Prove the API is reachable and CORS is configured, before any real page
     depends on it. */
  useEffect(() => {
    const controller = new AbortController()
    const base = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api'

    fetch(`${base}/listings?limit=1`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => setApiStatus(`connected — ${d.total} listings`))
      .catch((e) => {
        if (e.name !== 'AbortError') setApiStatus(`failed — ${e.message}`)
      })

    return () => controller.abort()
  }, [])

  const swatches = [
    ['--bg', 'bg'],
    ['--bg-sunken', 'bg-sunken'],
    ['--surface', 'surface'],
    ['--surface-2', 'surface-2'],
    ['--surface-3', 'surface-3'],
    ['--border', 'border'],
    ['--text', 'text'],
    ['--text-muted', 'text-muted'],
    ['--accent', 'accent'],
    ['--accent-soft', 'accent-soft'],
  ]

  return (
    <div className="container" style={{ paddingBlock: 'var(--space-7)' }}>
      <div className="row-between" style={{ marginBottom: 'var(--space-7)' }}>
        <div>
          <p className="eyebrow">Casanova</p>
          <h1 style={{ fontSize: 'var(--text-3xl)' }}>Style guide</h1>
        </div>
        <button className="btn btn-secondary" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? 'Light theme' : 'Dark theme'}
        </button>
      </div>

      <div
        className={`alert ${apiStatus.startsWith('connected') ? 'alert-success' : apiStatus.startsWith('failed') ? 'alert-error' : 'alert-info'}`}
        style={{ marginBottom: 'var(--space-7)' }}
        role="status"
      >
        API: {apiStatus}
      </div>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <div className="section-head">
          <h2>Type</h2>
        </div>
        <p className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
          Eyebrow · Instrument Serif below
        </p>
        <h1>Tech that earns its place</h1>
        <h2>A quieter kind of estate agent</h2>
        <h3>Twenty-four homes across London</h3>
        <h4>Book a viewing in three clicks</h4>
        <p className="lede" style={{ marginTop: 'var(--space-4)' }}>
          This is the lede style — one size up from body copy, slightly muted,
          capped at 62 characters per line so it stays readable.
        </p>
        <p style={{ marginTop: 'var(--space-4)', maxWidth: '68ch' }}>
          And this is body copy in Inter at 1rem with a 1.6 line height. If the
          headings above are rendering in a serif and this paragraph is not,
          both fonts loaded correctly. If everything looks like Times New
          Roman, the Google Fonts link in <code>index.html</code> did not load.
        </p>
        <p className="serif-italic" style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-xl)' }}>
          A serif italic, for pull quotes.
        </p>
      </section>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <div className="section-head">
          <h2>Colour</h2>
        </div>
        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
          {swatches.map(([token, label]) => (
            <div key={token} className="panel" style={{ padding: 'var(--space-3)' }}>
              <div
                style={{
                  height: 56,
                  borderRadius: 'var(--radius-sm)',
                  background: `var(${token})`,
                  border: '1px solid var(--border)',
                  marginBottom: 'var(--space-2)',
                }}
              />
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500 }}>{label}</div>
              <div className="muted" style={{ fontSize: 10 }}>{token}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <div className="section-head">
          <h2>Buttons</h2>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <button className="btn btn-primary">Book a viewing</button>
          <button className="btn btn-secondary">Save property</button>
          <button className="btn btn-ghost">Share</button>
          <button className="btn btn-danger">Cancel booking</button>
          <button className="btn btn-primary btn-lg">Large</button>
          <button className="btn btn-secondary btn-sm">Small</button>
          <button className="btn btn-primary" disabled>
            Disabled
          </button>
          <button className="btn btn-primary">
            <span className="spinner" /> Working
          </button>
        </div>
      </section>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <div className="section-head">
          <h2>Badges</h2>
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className="badge">Freehold</span>
          <span className="badge badge-accent">Featured</span>
          <span className="badge badge-positive">Available</span>
          <span className="badge badge-warn">Under offer</span>
          <span className="badge badge-danger">Sold</span>
        </div>
      </section>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <div className="section-head">
          <h2>Form</h2>
        </div>
        <div className="stack" style={{ maxWidth: 420 }}>
          <div className="field">
            <label className="label" htmlFor="sg-city">
              Area
            </label>
            <input id="sg-city" className="input" placeholder="Camden, N1, Hackney…" />
          </div>
          <div className="field">
            <label className="label" htmlFor="sg-type">
              Property type
            </label>
            <select id="sg-type" className="select" defaultValue="flat">
              <option value="house">House</option>
              <option value="flat">Flat</option>
              <option value="bungalow">Bungalow</option>
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="sg-notes">
              Notes
            </label>
            <textarea id="sg-notes" className="textarea" placeholder="Anything the agent should know" />
          </div>
          <div className="segmented" role="group" aria-label="Listing type">
            <button aria-pressed="true">For sale</button>
            <button aria-pressed="false">To rent</button>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <div className="section-head">
          <h2>Pins &amp; stats</h2>
        </div>
        <div className="row" style={{ marginBottom: 'var(--space-5)' }}>
          <span className="pin">£685k</span>
          <span className="pin is-active">£1.2m</span>
          <span className="pin is-visited">£1,850 pcm</span>
        </div>
        <div className="stat-grid">
          <div className="stat">
            <div className="stat-value">24</div>
            <div className="stat-label">Homes listed</div>
          </div>
          <div className="stat">
            <div className="stat-value">3</div>
            <div className="stat-label">Agents</div>
          </div>
          <div className="stat">
            <div className="stat-value">48h</div>
            <div className="stat-label">Average response</div>
          </div>
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>Loading</h2>
        </div>
        <div className="grid-cards">
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
        </div>
      </section>
    </div>
  )
}