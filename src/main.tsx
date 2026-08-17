import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Register the service worker for installable/offline support. Only in
// production builds — dev/preview never registers it.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Check for a newer service worker whenever the app comes back to the
        // foreground (open/close alone doesn't reliably trigger an update).
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) void reg.update()
        })
      })
      .catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
