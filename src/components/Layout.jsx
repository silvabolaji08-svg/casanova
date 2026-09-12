import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import Header from './Header.jsx'
import Footer from './Footer.jsx'

/**
 * A single-page app doesn't reload, so the browser keeps your scroll
 * position when the route changes — you click a property and arrive
 * halfway down its page. This resets it.
 *
 * `location.key` rather than `pathname`, so navigating to the same path
 * with different filters also resets.
 */
function ScrollToTop() {
  const { pathname, key } = useLocation()

  useEffect(() => {
    /* 'instant' deliberately. A smooth scroll on every navigation is
       nauseating, and it fights the page's own entry animation. */
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, key])

  return null
}

/**
 * The standard page frame: header, content, footer.
 *
 * `id="main"` gives the skip link somewhere to go — the first thing a
 * keyboard user wants is a way past the navigation.
 */
export default function Layout() {
  return (
    <>
      <ScrollToTop />
      <a href="#main" className="sr-only">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
    </>
  )
}

/**
 * For the map search page.
 *
 * No footer, because that page is sized to exactly fill the viewport below
 * the header — its two panes scroll independently and the page itself must
 * not scroll. A footer would push the map down and create an outer
 * scrollbar, which breaks the whole layout.
 */
export function MapLayout() {
  return (
    <>
      <ScrollToTop />
      <a href="#main" className="sr-only">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Outlet />
      </main>
    </>
  )
}