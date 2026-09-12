import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

/* Leaflet's own stylesheet, before ours — so our overrides in index.css
   win without needing !important on everything. Import order in a bundler
   is cascade order. */
import 'leaflet/dist/leaflet.css'
import './index.css'

import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)