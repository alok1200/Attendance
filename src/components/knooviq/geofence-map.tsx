'use client'

/**
 * Geofence map: office fence circle, optional draggable office pin (admin) and
 * the employee's GPS dot + accuracy circle. Client-only — load it through
 * `next/dynamic(..., { ssr: false })` because Leaflet touches `window`.
 */
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect } from 'react'
import { Circle, LayersControl, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { cn } from '@/lib/utils'

type LatLng = { lat: number; lng: number }

const INDIA: [number, number] = [20.5937, 78.9629]

// divIcons avoid Leaflet's default marker images (which break under bundlers).
const dot = (color: string, size: number) =>
  L.divIcon({
    className: '',
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35),0 1px 4px rgba(0,0,0,.4)"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
const officeIcon = dot('#047857', 20)
const userIcon = dot('#f59e0b', 16)

function boundsFor(center: LatLng, radius: number, user?: LatLng & { accuracy: number }) {
  const b = L.latLng(center.lat, center.lng).toBounds(Math.max(radius, 25) * 2.4)
  if (user) b.extend(L.latLng(user.lat, user.lng).toBounds(Math.max(user.accuracy, 10) * 2))
  return b
}

/** Keeps the view sensible: fit everything when read-only; when editing only pan if the pin left the view. */
function ViewController({ center, radius, user, editable }: { center: LatLng | null; radius: number; user?: LatLng & { accuracy: number }; editable: boolean }) {
  const map = useMap()
  // Dialog / card animations size the container after mount.
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250)
    return () => clearTimeout(t)
  }, [map])
  useEffect(() => {
    if (!center) return
    if (!editable) map.fitBounds(boundsFor(center, radius, user), { maxZoom: 19 })
    else if (!map.getBounds().contains([center.lat, center.lng])) map.setView([center.lat, center.lng], Math.max(map.getZoom(), 17))
  }, [map, center?.lat, center?.lng, radius, user?.lat, user?.lng, user?.accuracy, editable])
  return null
}

function ClickToPlace({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

export default function GeofenceMap({
  center,
  radius,
  onCenterChange,
  user,
  className,
}: {
  center: LatLng | null
  radius: number
  /** When set, the office pin is draggable and clicking the map moves it. */
  onCenterChange?: (p: LatLng) => void
  user?: LatLng & { accuracy: number }
  className?: string
}) {
  const editable = !!onCenterChange
  const initialBounds = center ? boundsFor(center, radius, user) : undefined

  return (
    // `isolate` keeps Leaflet's high z-indexes from covering app menus/headers.
    <div className={cn('isolate overflow-hidden rounded-md border', className)}>
      <MapContainer
        bounds={initialBounds}
        center={initialBounds ? undefined : INDIA}
        zoom={initialBounds ? undefined : 5}
        maxZoom={19}
        scrollWheelZoom={editable}
        className="h-full w-full"
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Satellite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri"
              maxZoom={19}
              // ponytail: Esri imagery has gaps at z19 outside big cities ("Map data not yet available"); upscale z18 instead.
              maxNativeZoom={18}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Streets">
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {center ? (
          <>
            <Circle center={[center.lat, center.lng]} radius={radius} pathOptions={{ color: '#047857', fillColor: '#10b981', fillOpacity: 0.15, weight: 2 }} />
            <Marker
              position={[center.lat, center.lng]}
              icon={officeIcon}
              draggable={editable}
              title="Office"
              eventHandlers={
                editable
                  ? {
                      dragend: (e) => {
                        const p = (e.target as L.Marker).getLatLng()
                        onCenterChange!({ lat: p.lat, lng: p.lng })
                      },
                    }
                  : undefined
              }
            />
          </>
        ) : null}

        {user ? (
          <>
            <Circle center={[user.lat, user.lng]} radius={user.accuracy} pathOptions={{ color: '#d97706', fillColor: '#f59e0b', fillOpacity: 0.15, weight: 1 }} />
            <Marker position={[user.lat, user.lng]} icon={userIcon} title="You" />
          </>
        ) : null}

        {editable ? <ClickToPlace onPick={onCenterChange!} /> : null}
        <ViewController center={center} radius={radius} user={user} editable={editable} />
      </MapContainer>
    </div>
  )
}
