import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useStore } from '../context/StoreContext.jsx'

/**
 * Wraps routes that need a signed-in user.
 *
 * @param agentOnly  also require the agent or admin role
 */
export default function ProtectedRoute({ agentOnly = false }) {
  const { isAuthed, isAgent, authLoading } = useStore()
  const location = useLocation()

  /**
   * THE IMPORTANT BRANCH.
   *
   * On a refresh, restoring the session is an async round trip to
   * /auth/me. During it, `isAuthed` is false — not because the user is
   * signed out, but because we don't know yet.
   *
   * Without this check, refreshing /account would redirect a signed-in
   * user to the login page every single time. That is the classic auth bug,
   * and `authLoading` starting as Boolean(getToken()) is what makes it
   * avoidable.
   */
  if (authLoading) {
    return (
      <div className="container" style={{ paddingBlock: 'var(--space-9)', textAlign: 'center' }}>
        <span className="spinner" style={{ marginInline: 'auto', width: 24, height: 24 }} />
        <p className="muted" style={{ marginTop: 'var(--space-4)' }}>
          Checking your session…
        </p>
      </div>
    )
  }

  if (!isAuthed) {
    /**
     * Remember where they were going so sign-in can send them back.
     *
     * `replace` so the protected URL doesn't sit in the history — pressing
     * back from the login page shouldn't bounce them through a redirect
     * loop.
     */
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }

  if (agentOnly && !isAgent) {
    return (
      <div className="container-narrow" style={{ paddingBlock: 'var(--space-9)', textAlign: 'center' }}>
        <p className="eyebrow">Not allowed</p>
        <h1 style={{ marginBlock: 'var(--space-3) var(--space-4)' }}>Agents only</h1>
        <p className="lede" style={{ marginInline: 'auto' }}>
          This area is for Casanova agents. Your account is a buyer account.
        </p>
      </div>
    )
  }

  return <Outlet />
}