import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="container-narrow" style={{ paddingBlock: 'var(--space-9)', textAlign: 'center' }}>
      <p className="eyebrow">404</p>
      <h1 style={{ marginBlock: 'var(--space-3) var(--space-4)' }}>
        Nothing here
      </h1>
      <p className="lede" style={{ marginInline: 'auto', marginBottom: 'var(--space-6)' }}>
        This page either moved or was never built. Both are possible.
      </p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <Link to="/" className="btn btn-primary">
          Back to the homepage
        </Link>
        <Link to="/search" className="btn btn-secondary">
          Search the map
        </Link>
      </div>
    </div>
  )
}