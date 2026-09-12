import { NavLink, Outlet } from 'react-router-dom'

import Icon from '../../components/Icon.jsx'
import { useStore } from '../../context/StoreContext.jsx'

export default function AccountLayout() {
  const { user, savedCount, logout } = useStore()

  return (
    <div className="container" style={{ paddingBlock: 'var(--space-7)' }}>
      <div className="row-between" style={{ marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow">Your account</p>
          <h1 style={{ fontSize: 'var(--text-3xl)' }}>{user.name}</h1>
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            {user.email}
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={logout}>
          <Icon name="logout" size={15} />
          Sign out
        </button>
      </div>

      <nav className="agent-tabs" aria-label="Account sections">
        {/**
         * `end` on the index tab.
         *
         * Without it, "Viewings" at /account would stay active on
         * /account/saved too, because NavLink treats a parent path as
         * matching its children by default.
         */}
        <NavLink
          to="/account"
          end
          className={({ isActive }) => `agent-tab ${isActive ? 'active' : ''}`}
        >
          Viewings
        </NavLink>
        <NavLink
          to="/account/saved"
          className={({ isActive }) => `agent-tab ${isActive ? 'active' : ''}`}
        >
          Saved{savedCount ? ` (${savedCount})` : ''}
        </NavLink>
        <NavLink
          to="/account/profile"
          className={({ isActive }) => `agent-tab ${isActive ? 'active' : ''}`}
        >
          Details
        </NavLink>
      </nav>

      <Outlet />
    </div>
  )
}