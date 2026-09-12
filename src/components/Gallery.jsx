import { useCallback, useEffect, useRef, useState } from 'react'

import Icon from './Icon.jsx'

/**
 * Property gallery with a full-screen lightbox.
 *
 * Keyboard is a first-class input here, not an afterthought: arrows move
 * between images, Escape closes. Someone reviewing forty flats does not
 * want to reach for the mouse each time.
 */
export default function Gallery({ images = [], title = '' }) {
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)
  const closeRef = useRef(null)
  const openerRef = useRef(null)

  const count = images.length

  const go = useCallback(
    (delta) => {
      if (!count) return
      /* Modulo wrap, with the +count so a negative index stays positive —
         (-1 % 5) is -1 in JavaScript, not 4. */
      setIndex((i) => (i + delta + count) % count)
    },
    [count]
  )

  /* Keyboard control while the lightbox is open. */
  useEffect(() => {
    if (!open) return

    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, go])

  /**
   * Stop the page behind the lightbox from scrolling.
   *
   * Without this, a scroll gesture over the overlay moves the page
   * underneath, so closing it leaves you somewhere unexpected.
   */
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  /**
   * Move focus into the lightbox when it opens, and back to the button
   * that opened it when it closes.
   *
   * Without this, a keyboard user opens the lightbox and their focus is
   * still on the page behind — tabbing moves through content they cannot
   * see.
   */
  useEffect(() => {
    if (open) closeRef.current?.focus()
    else openerRef.current?.focus({ preventScroll: true })
  }, [open])

  if (!count) {
    return (
      <div className="gallery">
        <div className="gallery-main">
          <div className="card-media-empty" style={{ height: '100%' }}>
            <Icon name="image" size={34} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="gallery">
        <button
          ref={openerRef}
          type="button"
          className="gallery-main"
          onClick={() => setOpen(true)}
          aria-label={`View photograph ${index + 1} of ${count} full screen`}
        >
          <img src={images[index]} alt={`${title} — photograph ${index + 1}`} />
          <span
            className="badge badge-overlay"
            style={{ top: 'auto', bottom: 'var(--space-3)', left: 'var(--space-3)' }}
          >
            <Icon name="zoomIn" size={13} />
            {index + 1} / {count}
          </span>
        </button>

        {count > 1 && (
          <div className="gallery-thumbs">
            {images.map((src, i) => (
              <button
                key={src + i}
                type="button"
                className="gallery-thumb"
                /* aria-current, not aria-selected — these are not tabs.
                   The CSS styles the active thumb off this attribute. */
                aria-current={i === index}
                onClick={() => setIndex(i)}
                aria-label={`Show photograph ${i + 1}`}
              >
                <img src={src} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} — photographs`}
          /* Clicking the backdrop closes; clicking the image does not,
             which is why the check is against the event target. */
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <img src={images[index]} alt={`${title} — photograph ${index + 1}`} />

          <button
            ref={closeRef}
            type="button"
            className="lightbox-close"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <Icon name="close" size={20} />
          </button>

          {count > 1 && (
            <>
              <button
                type="button"
                className="lightbox-nav lightbox-prev"
                onClick={() => go(-1)}
                aria-label="Previous photograph"
              >
                <Icon name="chevronLeft" size={22} />
              </button>
              <button
                type="button"
                className="lightbox-nav lightbox-next"
                onClick={() => go(1)}
                aria-label="Next photograph"
              >
                <Icon name="chevronRight" size={22} />
              </button>
              <span className="lightbox-count">
                {index + 1} of {count}
              </span>
            </>
          )}
        </div>
      )}
    </>
  )
}