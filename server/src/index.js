import 'dotenv/config'
import app from './app.js'

const PORT = process.env.PORT || 5000

/**
 * Vercel imports this module and drives the app itself — calling listen()
 * there would bind a port nothing is watching. So only listen when the
 * process was started directly (npm run dev / npm start).
 */
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Casanova API listening on http://localhost:${PORT}`))
}

export default app