/**
 * Geofence utilities (spec §6.2) — pure functions, safe on client and server.
 * Server computes Haversine distance; a punch is accepted when the reported
 * position is inside the fence (distance <= radiusMeters) AND the fix is precise
 * enough (accuracy <= maxAccuracyMeters). Poor accuracy never widens the fence.
 */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export interface GeofenceResult {
  distance: number
  accuracy: number
  inside: boolean
  allowed: boolean
  reason?: string
}

export function evaluateGeofence(opts: {
  lat: number
  lng: number
  accuracy: number
  officeLat: number
  officeLng: number
  radiusMeters: number
  maxAccuracyMeters: number
}): GeofenceResult {
  const { lat, lng, accuracy, officeLat, officeLng, radiusMeters, maxAccuracyMeters } = opts
  const distance = haversineMeters(lat, lng, officeLat, officeLng)
  const inside = distance <= radiusMeters

  if (accuracy > maxAccuracyMeters) {
    return {
      distance,
      accuracy,
      inside,
      allowed: false,
      reason: `GPS accuracy too low: ±${Math.round(accuracy)} m (maximum allowed is ±${maxAccuracyMeters} m). Move to an open area and retry.`,
    }
  }
  if (!inside) {
    return {
      distance,
      accuracy,
      inside,
      allowed: false,
      reason: `You are ${Math.round(distance)} m from the office — you must be within ${radiusMeters} m (GPS accuracy ±${Math.round(accuracy)} m).`,
    }
  }
  return { distance, accuracy, inside, allowed: true }
}
