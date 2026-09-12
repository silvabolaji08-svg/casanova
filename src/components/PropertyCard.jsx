import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import Icon from './Icon.jsx'
import { useStore } from '../context/StoreContext.jsx'
import {
  formatPrice,
  formatAddress,
  formatBeds,
  formatBaths,
  formatAreaShort,
  PROPERTY_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_TONE,
} from '../lib/format.js'

export default function PropertyCard({
  listing,
  compact = false,
  /* Set by the search page so a hovered map pin can highlight its card. */
  isLinked = false,
  onHoverStart,
  onHoverEnd,
}) {
  const { isSaved, toggleSaved, isAuthed } = useStore()
  const [imgLoaded, setImgLoaded] = useState(false)
  const imgRef = useRef(null)

  const image = listing.images?.[0]
  const saved = isSaved(listing.id)

  /**
   * A cached image can finish loading before React attaches the onLoad
   * handler, in which case the event never fires and the image stays at
   * opacity 0 forever. Checking `.complete` on mount catches that.
   */
  useEffect(() => {
    if (imgRef.current?.complete) setImgLoaded(true)
  }, [image])

  const handleSave = async (e) => {
    /* The whole card is a link; without these the click would navigate. */
    e.preventDefault()
    e.stopPropagation()
    const res = await toggleSaved(listing.id)
    if (!res.ok && res.reason === 'auth') {
      window.location.assign('/login')
    }
  }

  return (
    <article
      className={`card ${compact ? 'card-compact' : ''} ${isLinked ? 'is-linked' : ''}`}
      onMouseEnter={() => onHoverStart?.(listing.id)}
      onMouseLeave={() => onHoverEnd?.(listing.id)}
      data-listing-id={listing.id}
    >
      <div className="card-media">
        {listing.status !== 'available' && (
          <span className={`badge badge-overlay`}>{STATUS_LABELS[listing.status]}</span>
        )}
        {listing.status === 'available' && listing.featured && (
          <span className="badge badge-overlay">Featured</span>
        )}

        {image ? (
          <img
            ref={imgRef}
            src={image}
            alt={listing.title}
            className={imgLoaded ? 'is-loaded' : ''}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            /* A broken path should still reveal the image element rather
               than leave an invisible box — a broken-image icon is more
               informative than nothing. */
            onError={() => setImgLoaded(true)}
          />
        ) : (
          <div className="card-media-empty">
            <Icon name="image" size={26} />
          </div>
        )}

        <button
          className={`card-save ${saved ? 'is-saved' : ''}`}
          onClick={handleSave}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${listing.title} from saved` : `Save ${listing.title}`}
        >
          <Icon name="heart" size={16} filled={saved} />
        </button>
      </div>

      <div className="card-body">
        <div className="card-price">
          {formatPrice(listing.price, listing.listingType, listing.rentPeriod)}
        </div>

        <h3 className="card-title">{listing.title}</h3>

        <p className="card-address">{formatAddress(listing.address)}</p>

        <div className="card-specs">
          <span className="card-spec">
            <Icon name="bed" size={15} />
            {formatBeds(listing.bedrooms)}
          </span>
          <span className="card-spec">
            <Icon name="bath" size={15} />
            {formatBaths(listing.bathrooms)}
          </span>
          {listing.floorArea && (
            <span className="card-spec">
              <Icon name="area" size={15} />
              {formatAreaShort(listing.floorArea)}
            </span>
          )}
          <span className="card-spec muted" style={{ marginLeft: 'auto' }}>
            {PROPERTY_TYPE_LABELS[listing.propertyType]}
          </span>
        </div>
      </div>

      {/**
       * A stretched link. It covers the card so the whole surface is
       * clickable, while the heart button sits above it on z-index 2.
       *
       * This is better than an onClick on the article: it is a real anchor,
       * so middle-click, cmd-click and "copy link address" all work, and
       * the accessible name comes from the property title.
       */}
      <Link
        to={`/property/${listing.slug}`}
        className="card-link"
        aria-label={`${listing.title}, ${formatPrice(listing.price, listing.listingType, listing.rentPeriod)}`}
      />
    </article>
  )
}