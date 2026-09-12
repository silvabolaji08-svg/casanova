import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import Icon from '../../components/Icon.jsx'
import PropertyCard from '../../components/PropertyCard.jsx'
import { authApi } from '../../lib/api.js'
import { useStore } from '../../context/StoreContext.jsx'

export default function Saved() {
  const { savedIds } = useStore()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  /**
   * Refetches when savedIds changes size.
   *
   * Unhearting a card here removes it from the user document in context,
   * and this brings the list back in step. Depending on `savedIds.size`
   * rather than the Set itself avoids refetching when the Set is recreated
   * with the same contents.
   */
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)

    authApi
      .saved({ signal: controller.signal })
      .then((data) => {
        setItems(data.items)
        setError('')
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [savedIds.size])

  if (loading) {
    return (
      <div className="grid-cards">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton skeleton-card" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="alert alert-error" role="alert">
        {error}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="empty">
        <Icon name="heart" size={28} />
        <p className="empty-title">Nothing saved</p>
        <p>Tap the heart on any property and it will show up here.</p>
        <Link to="/search" className="btn btn-primary btn-sm">
          Start looking
        </Link>
      </div>
    )
  }

  return (
    <>
      <p className="muted" style={{ marginBottom: 'var(--space-5)', fontSize: 'var(--text-sm)' }}>
        {items.length} {items.length === 1 ? 'property' : 'properties'} saved
      </p>
      <div className="grid-cards">
        {items.map((l) => (
          <PropertyCard key={l.id} listing={l} />
        ))}
      </div>
    </>
  )
}