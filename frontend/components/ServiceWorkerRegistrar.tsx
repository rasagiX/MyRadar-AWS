'use client'

/**
 * Registers /sw.js on first client render.
 * Mounted once in app/layout.tsx — no UI, no render output.
 */

import { useEffect } from 'react'

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[SW] registered, scope:', reg.scope)
      })
      .catch((err) => {
        console.warn('[SW] registration failed:', err)
      })
  }, [])

  return null
}
