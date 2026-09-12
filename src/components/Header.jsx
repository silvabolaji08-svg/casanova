import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'

import Icon from './Icon.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { gsap, motionContext, prefersReducedMotion } from '../motion/gsap.js'

const links = [
  { label: 'Buy', to: '/search?listingType=sale', match: 'sale' },
  { label: 'Rent', to: '/search?listingType=rent', match: 'rent' },
]

export default function Header() {
  const { theme, toggleTheme, user, isAuthed, isAgent, logout, savedCount } = useStore()
  const location = useLocation()
  const navigate = useNavigate()

  /**
   * Two flags, not one.
   *
   * `mounted` controls whether the element is in the DOM; `open` controls
   * whether it is animated in. Closing sets `open` false, the exit animation
   * plays, and only then does `mounted` go false. With a single flag React
   * would remove the node instantly and there would be nothing left to
   * animate out.
   */
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  /* Close the menu whenever the route changes. */
  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.search])

  /* Escape closes it — expected of anything overlaying the page. */
  useEffect(() => {
    if (!mounted) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mounted])

  /* Opening mounts first, so the element exists before we animate it. */
  useEffect(() => {
    if (open) setMounted(true)
  }, [open])

  /* The animation itself. */
  useEffect(() => {
    if (!mounted) return

    const el = menuRef.current
    if (!el) return

    /* No GSAP for reduced-motion users — just show or remove it. */
    if (prefersReducedMotion()) {
      if (!open) setMounted(false)
      return
    }

    return motionContext(el, (q) => {
      if (open) {
        gsap.fromTo(
          el,
          { height: 0, opacity: 0 },
          { height: 'auto', opacity: 1, duration: 0.36, ease: 'power3.out' }
        )
        gsap.from(q('.mobile-link'), {
          y: 14,
          opacity: 0,
          duration: 0.3,
          stagger: 0.05,
          delay: 0.08,
          ease: 'power2.out',
        })
      } else {
        gsap.to(el, {
          height: 0,
          opacity: 0,
          duration: 0.26,
          ease: 'power2.in',
          /* Unmount only once the exit has finished. */
          onComplete: () => setMounted(false),
        })
      }
    })
  }, [open, mounted])

  /**
   * NavLink's `isActive` only compares the pathname, so /search?listingType=sale
   * and /search?listingType=rent would both look active on /search. This
   * reads the query string instead.
   */
  const isLinkActive = (link) =>
    location.pathname === '/search' && location.search.includes(link.match)

  const handleAccountClick = () => {
    navigate(isAuthed ? (isAgent ? '/agent' : '/account') : '/login')
  }

  return (
    <>
      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="brand" aria-label="Casanova home">
            Casanova
            <span className="brand-dot" aria-hidden="true" />
          </Link>

          <nav className="nav" aria-label="Main">
            {links.map((l) => (
              <NavLink
                key={l.label}
                to={l.to}
                className={`nav-link ${isLinkActive(l) ? 'active' : ''}`}
              >
                {l.label}
              </NavLink>
            ))}
            <NavLink
              to="/search"
              className={({ isActive }) =>
                `nav-link ${isActive && !location.search ? 'active' : ''}`
              }
            >
              Map search
            </NavLink>
          </nav>

          <div className="header-actions">
            <button
              className="btn-icon"
              onClick={toggleTheme}
              /* The label says what pressing it DOES, not what the current
                 state is — "Dark theme" alone is ambiguous. */
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} />
            </button>

            <Link
              to={isAuthed ? '/account/saved' : '/login'}
              className="btn-icon icon-badge"
              data-count={savedCount}
              aria-label={`Saved properties${savedCount ? ` (${savedCount})` : ''}`}
              title="Saved properties"
            >
              <Icon name="heart" size={19} />
            </Link>

            <button
              className="btn-icon"
              onClick={handleAccountClick}
              aria-label={isAuthed ? `Account — ${user.name}` : 'Sign in'}
              title={isAuthed ? user.name : 'Sign in'}
            >
              <Icon name="user" size={19} />
            </button>

            {isAuthed && (
              <button
                className="btn-icon"
                onClick={logout}
                aria-label="Sign out"
                title="Sign out"
              >
                <Icon name="logout" size={19} />
              </button>
            )}

            <button
              className="btn-icon menu-toggle"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
            >
              <Icon name={open ? 'close' : 'menu'} size={20} />
            </button>
          </div>
        </div>
      </header>

      {mounted && (
        <div className="mobile-menu" id="mobile-menu" ref={menuRef}>
          <div className="mobile-menu-inner">
            {links.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                className={`mobile-link ${isLinkActive(l) ? 'active' : ''}`}
              >
                {l.label}
              </Link>
            ))}
            <Link to="/search" className="mobile-link">
              Map search
            </Link>
            {isAuthed ? (
              <>
                <Link to={isAgent ? '/agent' : '/account'} className="mobile-link">
                  {isAgent ? 'Agent dashboard' : 'My account'}
                </Link>
                <Link to="/account/saved" className="mobile-link">
                  Saved ({savedCount})
                </Link>
                <button
                  className="mobile-link"
                  style={{ textAlign: 'left' }}
                  onClick={logout}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="mobile-link">
                  Sign in
                </Link>
                <Link to="/register" className="mobile-link">
                  Create an account
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}