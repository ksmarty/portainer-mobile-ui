/// <reference types="vite/client" />

// Globals injected into index.html by the container entrypoint
interface Window {
  __PM_VERSION__?: string
  __PM_PROXY__?: number
}