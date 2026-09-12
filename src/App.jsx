import { Routes, Route, Navigate } from 'react-router-dom'

import { StoreProvider } from './context/StoreContext.jsx'
import Layout, { MapLayout } from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

import Home from './pages/Home.jsx'
import Search from './pages/Search.jsx'
import Property from './pages/Property.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import StyleGuide from './pages/StyleGuide.jsx'
import NotFound from './pages/NotFound.jsx'

import AccountLayout from './pages/account/AccountLayout.jsx'
import Viewings from './pages/account/Viewings.jsx'
import Saved from './pages/account/Saved.jsx'
import Profile from './pages/account/Profile.jsx'

import AgentLayout from './pages/agent/AgentLayout.jsx'
import Schedule from './pages/agent/Schedule.jsx'
import AgentListings from './pages/agent/Listings.jsx'

export default function App() {
  return (
    <StoreProvider>
      <Routes>
        {/* Map search: its own frame, no footer, height-locked. */}
        <Route element={<MapLayout />}>
          <Route path="/search" element={<Search />} />
        </Route>

        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/property/:slug" element={<Property />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/styleguide" element={<StyleGuide />} />

          {/**
           * Signed-in area.
           *
           * ProtectedRoute renders an <Outlet />, so everything nested
           * inside it inherits the guard — one check covering four pages
           * rather than the same three lines repeated in each.
           */}
          <Route element={<ProtectedRoute />}>
            <Route path="/account" element={<AccountLayout />}>
              <Route index element={<Viewings />} />
              <Route path="viewings" element={<Navigate to="/account" replace />} />
              <Route path="saved" element={<Saved />} />
              <Route path="profile" element={<Profile />} />
            </Route>
          </Route>

          {/* Agents and admins only. */}
          <Route element={<ProtectedRoute agentOnly />}>
            <Route path="/agent" element={<AgentLayout />}>
              <Route index element={<Schedule />} />
              <Route path="listings" element={<AgentListings />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </StoreProvider>
  )
}