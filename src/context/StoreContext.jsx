import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import {
  authApi,
  listingsApi,
  getToken,
  setToken,
  clearToken,
  ApiError,
} from '../lib/api.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'

const StoreContext = createContext(null)

export function useStore() {
  const ctx = useContext(StoreContext)
  /* A clear message beats "cannot read properties of null" from deep inside
     a component that forgot its provider. */
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}

export function StoreProvider({ children }) {
  /* ---------- theme ---------- */

  /**
   * index.html already set data-theme before React mounted, to avoid a flash
   * of the wrong palette. So the initial value is read from the DOM rather
   * than from storage — the DOM is the thing that is already true.
   */
  const [theme, setTheme] = useLocalStorage(
    'casanova.theme',
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  )

  useEffect(() => {
    if (theme === 'dark') document.documentElement.dataset.theme = 'dark'
    else delete document.documentElement.dataset.theme
  }, [theme])

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    [setTheme]
  )

  /* ---------- auth ---------- */

  const [user, setUser] = useState(null)

  /**
   * Starts true only if a token exists.
   *
   * Without this, every protected page would flash its signed-out state for
   * one render while /auth/me is in flight, and a route guard would redirect
   * a signed-in user to the login page on every refresh.
   */
  const [authLoading, setAuthLoading] = useState(() => Boolean(getToken()))

  /* Restore the session on mount. */
  useEffect(() => {
    if (!getToken()) return

    let cancelled = false

    authApi
      .me()
      .then(({ user: me }) => {
        if (!cancelled) setUser(me)
      })
      .catch(() => {
        /* Token expired, revoked, or the account is gone. Drop it rather
           than leaving it to fail on every later request. */
        clearToken()
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email, password) => {
    try {
      const { user: me, token } = await authApi.login({ email, password })
      setToken(token)
      setUser(me)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : 'Could not sign in' }
    }
  }, [])

  const register = useCallback(async (details) => {
    try {
      const { user: me, token } = await authApi.register(details)
      setToken(token)
      setUser(me)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : 'Could not register' }
    }
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  const updateProfile = useCallback(async (changes) => {
    try {
      const { user: me } = await authApi.updateProfile(changes)
      setUser(me)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : 'Could not save' }
    }
  }, [])

  /* ---------- saved properties ---------- */

  /**
   * A Set of ids, derived from the user document.
   *
   * A Set rather than an array because `isSaved` is called once per card on
   * every render — Set.has is constant time, Array.includes is not. With 24
   * cards it wouldn't matter; the habit is what matters.
   */
  const savedIds = useMemo(
    () => new Set((user?.savedListings ?? []).map(String)),
    [user]
  )

  const isSaved = useCallback((id) => savedIds.has(String(id)), [savedIds])

  const toggleSaved = useCallback(
    async (id) => {
      if (!user) return { ok: false, reason: 'auth' }

      const key = String(id)
      const wasSaved = savedIds.has(key)

      /**
       * Optimistic update: change the UI first, then tell the server.
       *
       * A heart that waits 200ms for a round trip feels broken. If the
       * request fails we put it back — which is why the previous value is
       * captured above rather than recomputed in the catch.
       */
      setUser((prev) => {
        if (!prev) return prev
        const next = wasSaved
          ? prev.savedListings.filter((s) => String(s) !== key)
          : [...prev.savedListings, key]
        return { ...prev, savedListings: next }
      })

      try {
        await authApi.toggleSaved(id)
        return { ok: true, saved: !wasSaved }
      } catch (err) {
        /* Roll back. */
        setUser((prev) => {
          if (!prev) return prev
          const next = wasSaved
            ? [...prev.savedListings, key]
            : prev.savedListings.filter((s) => String(s) !== key)
          return { ...prev, savedListings: next }
        })
        return { ok: false, error: err instanceof ApiError ? err.message : 'Could not save' }
      }
    },
    [user, savedIds]
  )

  /* ---------- filter metadata ---------- */

  /**
   * Cities, property types, features and price bounds for the filter panel.
   *
   * Fetched once and shared, because it is the same for everyone and never
   * changes during a session. This is the ONLY listing data held globally —
   * see the note below.
   */
  const [meta, setMeta] = useState(null)

  useEffect(() => {
    const controller = new AbortController()

    listingsApi
      .meta({ signal: controller.signal })
      .then(setMeta)
      .catch((err) => {
        if (err.name !== 'AbortError') {
          /* The filter panel degrades to free-text input; the app still
             works. Not worth blocking render over. */
          console.warn('Could not load filter metadata:', err.message)
        }
      })

    return () => controller.abort()
  }, [])

  /* ---------- value ---------- */

  /**
   * useMemo so the object identity is stable.
   *
   * Without it, a new object every render makes every consumer re-render
   * every time anything in the provider changes — which, since this sits at
   * the root, is the whole app.
   */
  const value = useMemo(
    () => ({
      theme,
      toggleTheme,

      user,
      authLoading,
      isAuthed: Boolean(user),
      isAgent: user?.role === 'agent' || user?.role === 'admin',
      login,
      register,
      logout,
      updateProfile,

      savedIds,
      savedCount: savedIds.size,
      isSaved,
      toggleSaved,

      meta,
    }),
    [
      theme,
      toggleTheme,
      user,
      authLoading,
      login,
      register,
      logout,
      updateProfile,
      savedIds,
      isSaved,
      toggleSaved,
      meta,
    ]
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}