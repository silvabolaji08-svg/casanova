import { useEffect, useRef, useState } from 'react'

/**
 * Returns `value`, but only after it has stopped changing for `delay` ms.
 *
 * Dragging a map fires moveend continuously. Without this, every nudge is a
 * request to the API, and responses arrive out of order — so the list can
 * end up showing the results for a viewport you've already left.
 */
export function useDebouncedValue(value, delay = 350) {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delay)
    /* Each change cancels the previous timer, so only the last one fires. */
    return () => clearTimeout(id)
  }, [value, delay])

  return settled
}

/**
 * A stable debounced callback.
 *
 * The returned function keeps the same identity across renders, so it can
 * safely be handed to an effect's dependency array or to a DOM listener
 * without re-subscribing on every render.
 */
export function useDebouncedCallback(fn, delay = 350) {
  const timer = useRef(null)
  const latest = useRef(fn)

  /* Keep the newest function without changing the returned identity — so
     the callback always sees current props, but nothing re-subscribes. */
  useEffect(() => {
    latest.current = fn
  }, [fn])

  const debounced = useRef((...args) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => latest.current(...args), delay)
  })

  /* Clear a pending call on unmount, so it can't fire into a dead
     component. */
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  return debounced.current
}