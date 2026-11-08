// Self-check for the geofence rule. Run: npx tsx src/lib/geo.check.ts
import assert from 'node:assert'
import { evaluateGeofence, haversineMeters } from './geo'
const o = { officeLat: 12.9716, officeLng: 77.5946, radiusMeters: 100, maxAccuracyMeters: 50 }
// point ~120 m north
const north = (m: number) => 12.9716 + m / 111320
assert(Math.abs(haversineMeters(north(120), 77.5946, 12.9716, 77.5946) - 120) < 1)
assert.equal(evaluateGeofence({ ...o, lat: north(60), lng: 77.5946, accuracy: 10 }).allowed, true, 'inside passes')
assert.equal(evaluateGeofence({ ...o, lat: north(120), lng: 77.5946, accuracy: 40 }).allowed, false, 'old slack case now rejected')
assert.equal(evaluateGeofence({ ...o, lat: north(10), lng: 77.5946, accuracy: 80 }).allowed, false, 'too imprecise rejected')
assert.equal(evaluateGeofence({ ...o, lat: north(100), lng: 77.5946, accuracy: 50 }).allowed, true, 'edge passes')
console.log('geo checks ok')
