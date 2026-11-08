'use client'

/**
 * Geolocation hook (spec §6.2/§9): GPS on demand with refresh, accuracy reporting
 * and a friendly step-by-step error help. Location is NEVER watched in the
 * background — only explicit punches / refresh calls, each a short sampling window.
 */
import { useCallback, useState } from 'react'

export type GpsState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  lat: number | null
  lng: number | null
  accuracy: number | null
  error: string | null
  help: string[]
  timestamp: number | null
}

export class GpsError extends Error {
  constructor(
    message: string,
    public help: string[],
    public denied = false,
  ) {
    super(message)
  }
}

const initial: GpsState = { status: 'idle', lat: null, lng: null, accuracy: null, error: null, help: [], timestamp: null }

function toGpsError(err: GeolocationPositionError): GpsError {
  if (err.code === err.PERMISSION_DENIED) {
    return new GpsError(
      'Location permission denied. Check In / Check Out need your location.',
      [
        'Click the lock / ⓘ icon in your browser address bar.',
        'Set "Location" permission to Allow for this site.',
        'Reload the page and press "Refresh GPS" again.',
        'Note: geolocation requires HTTPS (or localhost).',
      ],
      true,
    )
  }
  if (err.code === err.POSITION_UNAVAILABLE) {
    return new GpsError('Location unavailable — device GPS could not get a fix.', [
      'Move to an open area (better signal).',
      'Enable device location services (Settings → Location).',
      'Press "Refresh GPS" again.',
    ])
  }
  return new GpsError('GPS request timed out.', ['GPS took too long to respond.', 'Move near a window / open space.', 'Press "Refresh GPS" again.'])
}

/**
 * Sample GPS for up to `maxWaitMs` and resolve with the most accurate reading.
 * The first fix is often a coarse Wi-Fi/cell guess; a phone's GPS settles to
 * 3–15 m after a few seconds, so we keep watching and stop early once a
 * reading is within `goodEnoughM`. Never uses a cached position.
 */
export function bestFix({ maxWaitMs = 10000, goodEnoughM = 15 } = {}): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject(new GpsError('This browser does not support geolocation.', ['Use a modern browser (Chrome, Safari, Edge, Firefox).']))
      return
    }
    let best: GeolocationCoordinates | null = null
    let done = false
    const finish = (fn: () => void) => {
      if (done) return
      done = true
      clearTimeout(timer)
      navigator.geolocation.clearWatch(watchId)
      fn()
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.accuracy) best = pos.coords
        if (best.accuracy <= goodEnoughM) finish(() => resolve(best!))
      },
      (err) => {
        // Keep waiting on transient errors if we already have a reading; permission denial always ends it.
        if (err.code === err.PERMISSION_DENIED || !best) finish(() => reject(toGpsError(err)))
      },
      { enableHighAccuracy: true, timeout: maxWaitMs, maximumAge: 0 },
    )
    const timer = setTimeout(
      () => finish(() => (best ? resolve(best) : reject(new GpsError('GPS request timed out.', ['Move near a window / open space.', 'Press "Refresh GPS" again.'])))),
      maxWaitMs,
    )
  })
}

export function useGeolocation() {
  const [state, setState] = useState<GpsState>(initial)

  const locate = useCallback(async (): Promise<GeolocationCoordinates | null> => {
    setState((s) => ({ ...s, status: 'loading', error: null }))
    try {
      const c = await bestFix()
      setState({ status: 'ready', lat: c.latitude, lng: c.longitude, accuracy: c.accuracy, error: null, help: [], timestamp: Date.now() })
      return c
    } catch (e) {
      const err = e instanceof GpsError ? e : new GpsError('Could not get your location.', ['Press "Refresh GPS" again.'])
      setState({ ...initial, status: 'error', error: err.message, help: err.help })
      return null
    }
  }, [])

  return { ...state, locate }
}
