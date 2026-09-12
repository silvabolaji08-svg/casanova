import { useCallback, useEffect, useState } from 'react'

/**
 * State that survives a reload.
 *
 * Every access is wrapped, because localStorage doesn't just return null
 * when unavailable — it THROWS. Private windows, browsers set to block site
 * data, and some embedded webviews all raise on access. An unguarded read
 * here would crash the app on mount for those users.
 */
export function useLocalStorage(key, initialValue) {
  /* The initialiser is a function, so the read happens once on mount rather
     than on every render. */
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key)
      return raw === null ? initialValue : JSON.parse(raw)
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* In-memory only for this session. Losing persistence is acceptable;
         crashing is not. */
    }
  }, [key, value])

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }, [key])

  return [value, setValue, clear]
}