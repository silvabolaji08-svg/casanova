import { Link } from 'react-router-dom'

import Icon from './Icon.jsx'

const columns = [
  {
    heading: 'Buying',
    items: [
      { label: 'Houses for sale', to: '/search?listingType=sale&propertyType=house' },
      { label: 'Flats for sale', to: '/search?listingType=sale&propertyType=flat' },
      { label: 'New homes', to: '/search?listingType=sale&sort=newest' },
      { label: 'Land & plots', to: '/search?listingType=sale&propertyType=land' },
    ],
  },
  {
    heading: 'Renting',
    items: [
      { label: 'Flats to rent', to: '/search?listingType=rent&propertyType=flat' },
      { label: 'Houses to rent', to: '/search?listingType=rent&propertyType=house' },
      { label: 'Studios', to: '/search?listingType=rent&propertyType=studio' },
      { label: 'Two bedrooms +', to: '/search?listingType=rent&minBeds=2' },
    ],
  },
  {
    heading: 'Areas',
    items: [
      { label: 'Camden', to: '/search?q=Camden' },
      { label: 'Islington', to: '/search?q=Islington' },
      { label: 'Clapham', to: '/search?q=Clapham' },
      { label: 'Greenwich', to: '/search?q=Greenwich' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link to="/" className="brand" style={{ marginBottom: 'var(--space-3)' }}>
              Casanova
              <span className="brand-dot" aria-hidden="true" />
            </Link>
            <p className="muted" style={{ fontSize: 'var(--text-sm)', maxWidth: '34ch' }}>
              A smaller, slower estate agent. We list fewer homes and know each
              one properly.
            </p>
            <div className="row" style={{ marginTop: 'var(--space-4)' }}>
              <a className="row" href="tel:+442079460100" style={{ fontSize: 'var(--text-sm)' }}>
                <Icon name="phone" size={15} />
                020 7946 0100
              </a>
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.heading}>
              {/* A real <h2> rather than a styled div — the footer is a
                  landmark and its sections should appear in the document
                  outline a screen reader builds. */}
              <h2 className="footer-heading">{col.heading}</h2>
              <ul className="footer-list">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <Link to={item.to}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="footer-bottom">
          {/* Unsplash's licence asks for attribution when you use their
              photography. One sentence, and it keeps the project honest. */}
          <span>
            © {new Date().getFullYear()} Casanova. A portfolio project — not a real agency.
            {' '}Photography from{' '}
            <a href="https://unsplash.com" target="_blank" rel="noreferrer" className="link">
              Unsplash
            </a>
            .
          </span>
          <span className="row" style={{ gap: 'var(--space-4)' }}>
            <Link to="/styleguide">Style guide</Link>
            <a
              href="https://github.com/silvabolaji08-svg"
              target="_blank"
              rel="noreferrer"
              className="row"
              style={{ gap: 'var(--space-1)' }}
            >
              Source
              <Icon name="external" size={13} />
            </a>
          </span>
        </div>
      </div>
    </footer>
  )
}