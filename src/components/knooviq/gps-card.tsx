'use client'

import dynamic from 'next/dynamic'
import { MapPin, RefreshCw, ShieldCheck, Wifi, WifiOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { haversineMeters } from '@/lib/geo'
import type { GpsState } from '@/hooks/use-geolocation'

const GeofenceMap = dynamic(() => import('./geofence-map'), {
  ssr: false,
  loading: () => <div className="h-48 animate-pulse rounded-md bg-muted" />,
})

/**
 * Live GPS geofence card (spec §9): zone status, distance, allowed radius,
 * GPS signal, map with fence + your position, privacy badge. Location only on
 * demand — never tracked in the background (spec §6.6).
 */
export function GpsCard({
  office,
  gps,
  maxAccuracyMeters,
  onRefresh,
}: {
  office: { name: string; lat: number; lng: number; radiusMeters: number } | null
  gps: GpsState
  maxAccuracyMeters: number
  onRefresh: () => void
}) {
  const radius = office?.radiusMeters ?? 25
  const hasFix = gps.status === 'ready' && gps.lat !== null && gps.lng !== null && office
  const distance = hasFix && office ? haversineMeters(gps.lat!, gps.lng!, office.lat, office.lng) : null
  const accuracy = gps.accuracy ?? 0

  const zone = !hasFix ? 'UNKNOWN' : distance! <= radius ? 'INSIDE' : distance! <= radius * 6 ? 'NEAR' : 'OUTSIDE'
  const tooImprecise = !!hasFix && accuracy > maxAccuracyMeters
  const zoneLabel = { UNKNOWN: 'No GPS fix', INSIDE: 'Inside zone', NEAR: 'Near zone', OUTSIDE: 'Outside zone' }[zone]
  const zoneClass = {
    UNKNOWN: 'bg-slate-100 text-slate-700 border-slate-200',
    INSIDE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    NEAR: 'bg-amber-100 text-amber-800 border-amber-200',
    OUTSIDE: 'bg-rose-100 text-rose-800 border-rose-200',
  }[zone]
  const signal = !hasFix ? 0 : accuracy <= 10 ? 3 : accuracy <= 30 ? 2 : 1

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4 text-emerald-700" aria-hidden />
          GPS Geofence
        </CardTitle>
        <CardDescription>{office ? office.name : 'No office assigned'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={zoneClass}>{zoneLabel}</Badge>
          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
            Radius {radius} m
          </Badge>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-900 border-emerald-200">
            <ShieldCheck className="mr-1 h-3 w-3" aria-hidden /> Privacy: checked only at punch
          </Badge>
        </div>

        {office ? (
          <GeofenceMap
            className="h-48"
            center={{ lat: office.lat, lng: office.lng }}
            radius={radius}
            user={hasFix ? { lat: gps.lat!, lng: gps.lng!, accuracy } : undefined}
          />
        ) : null}

        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md border bg-muted/40 p-2">
            <dt className="text-[10px] font-medium uppercase text-muted-foreground">Distance</dt>
            <dd className="text-sm font-bold">{distance === null ? '—' : fmtDistance(distance)}</dd>
          </div>
          <div className="rounded-md border bg-muted/40 p-2">
            <dt className="text-[10px] font-medium uppercase text-muted-foreground">Accuracy</dt>
            <dd className={cn('text-sm font-bold', tooImprecise && 'text-rose-600')}>
              {gps.accuracy === null ? '—' : `±${Math.round(gps.accuracy)} m`}
            </dd>
          </div>
          <div className="rounded-md border bg-muted/40 p-2">
            <dt className="flex items-center justify-center gap-1 text-[10px] font-medium uppercase text-muted-foreground">
              {signal === 0 ? <WifiOff className="h-3 w-3" /> : <Wifi className="h-3 w-3" />} GPS
            </dt>
            <dd className="flex items-end justify-center gap-0.5 pt-0.5" aria-label={`Signal ${signal} of 3`}>
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn('w-1.5 rounded-sm', i <= signal ? 'bg-emerald-600' : 'bg-slate-200')}
                  style={{ height: 4 + i * 4 }}
                />
              ))}
            </dd>
          </div>
        </dl>

        {hasFix && distance !== null && zone !== 'INSIDE' ? (
          <div
            className={cn(
              'rounded-md border p-3 text-xs',
              zone === 'OUTSIDE' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-amber-200 bg-amber-50 text-amber-900',
            )}
          >
            <p className="font-semibold">
              You are {fmtDistance(distance)} from {office?.name ?? 'the office'} (fence {radius} m).
            </p>
            <p className="mt-1.5 font-medium">Why this happens:</p>
            <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
              <li>Desktops/laptops have no GPS chip — they guess from Wi-Fi or IP, often hundreds of metres off. Use your phone.</li>
              <li>Indoors GPS drifts — step near a window and press Refresh GPS.</li>
              <li>If the map pin isn’t on your building, ask HR to fix it in Admin → Offices.</li>
            </ul>
          </div>
        ) : null}

        {tooImprecise ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
            GPS accuracy is ±{Math.round(accuracy)} m — punches need ±{maxAccuracyMeters} m or better. Move near a window or open space, then press Refresh GPS.
          </div>
        ) : null}

        {gps.status === 'error' ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-semibold">{gps.error}</p>
            <p className="mt-1 font-medium">Try these steps:</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              {gps.help.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ol>
          </div>
        ) : null}

        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={onRefresh} disabled={gps.status === 'loading'}>
            <RefreshCw className={cn('mr-1 h-3.5 w-3.5', gps.status === 'loading' && 'animate-spin')} aria-hidden />
            {gps.status === 'loading' ? 'Locating…' : 'Refresh GPS'}
          </Button>
        </div>
        <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
          Location is required for Check In / Check Out and is read only then or when you press Refresh. Never in the background.
        </p>
      </CardContent>
    </Card>
  )
}

/** Human-friendly distance: metres below 1 km, kilometres above. */
function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 })} km`
}
