import { NavLink, Outlet } from 'react-router-dom'

import Icon from '../../components/Icon.jsx'
import { useStore } from '../../context/StoreContext.jsx'

export default function AgentLayout() {
  const { user, logout } = useStore()

  return (
    <div className="container" style={{ paddingBlock: 'var(--space-7)' }}>
      <div className="row-between" style={{ marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow">Agent dashboard</p>
          <h1 style={{ fontSize: 'var(--text-3xl)' }}>{user.name}</h1>
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            {user.agency || 'Casanova'} ·{' '}
            {user.workingHours?.start}–{user.workingHours?.end} ·{' '}
            {user.slotMinutes}-minute viewings
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={logout}>
          <Icon name="logout" size={15} />
          Sign out
        </button>
      </div>

      <nav className="agent-tabs" aria-label="Dashboard sections">
        <NavLink to="/agent" end className={({ isActive }) => `agent-tab ${isActive ? 'active' : ''}`}>
          Schedule
        </NavLink>
        <NavLink to="/agent/listings" className={({ isActive }) => `agent-tab ${isActive ? 'active' : ''}`}>
          My listings
        </NavLink>
        <NavLink to="/account/profile" className={({ isActive }) => `agent-tab ${isActive ? 'active' : ''}`}>
          Availability
        </NavLink>
      </nav>

      <Outlet />
    </div>
  )
}