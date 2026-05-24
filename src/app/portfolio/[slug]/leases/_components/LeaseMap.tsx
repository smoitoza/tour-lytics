'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  APIProvider,
  Map,
  InfoWindow,
  useMap,
} from '@vis.gl/react-google-maps'

export type GeoLease = {
  id: string
  name: string
  status: string
  expiration_date: string | null
  location: {
    id: string
    address_line1: string
    city: string
    state_province: string | null
    country: string
    latitude: number
    longitude: number
  } | null
}

type Props = {
  slug: string
  leases: GeoLease[]
  height?: number
}

const STATUS_PIN_COLOR: Record<string, string> = {
  draft: '#9ca3af',
  pending_review: '#f59e0b',
  active: '#22c55e',
  expired: '#ef4444',
  terminated: '#6b7280',
}

// Builds a classic SVG marker icon as a data URL. Works without a Map ID.
function svgPin(color: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='40' viewBox='0 0 32 40'>
    <path d='M16 0C7.163 0 0 7.163 0 16c0 11 16 24 16 24s16-13 16-24C32 7.163 24.837 0 16 0z' fill='${color}' stroke='#fff' stroke-width='2'/>
    <circle cx='16' cy='16' r='5' fill='#fff'/>
  </svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

// Classic-marker layer that uses the imperative Google Maps API directly.
// This avoids the Map ID requirement of AdvancedMarker.
function MarkersLayer({
  slug,
  leases,
}: {
  slug: string
  leases: GeoLease[]
}) {
  const map = useMap()
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])

  useEffect(() => {
    if (!map) return
    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    const bounds = new google.maps.LatLngBounds()
    let count = 0

    leases.forEach((l) => {
      if (!l.location) return
      const color = STATUS_PIN_COLOR[l.status] || '#0070f3'
      const pos = { lat: l.location.latitude, lng: l.location.longitude }
      const marker = new google.maps.Marker({
        position: pos,
        map,
        title: l.name,
        icon: {
          url: svgPin(color),
          scaledSize: new google.maps.Size(32, 40),
          anchor: new google.maps.Point(16, 40),
        },
      })
      marker.addListener('click', () => setOpenId(l.id))
      markersRef.current.push(marker)
      bounds.extend(pos)
      count++
    })

    if (count === 1) {
      const single = markersRef.current[0].getPosition()
      if (single) {
        map.setCenter(single)
        map.setZoom(13)
      }
    } else if (count > 1) {
      map.fitBounds(bounds, 60)
    }

    return () => {
      markersRef.current.forEach((m) => m.setMap(null))
      markersRef.current = []
    }
  }, [map, leases])

  const open = openId ? leases.find((l) => l.id === openId) : null
  if (!open || !open.location) return null

  return (
    <InfoWindow
      position={{ lat: open.location.latitude, lng: open.location.longitude }}
      onCloseClick={() => setOpenId(null)}
      pixelOffset={[0, -40]}
    >
      <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, padding: 2, maxWidth: 240 }}>
        <div style={{ fontWeight: 600, marginBottom: 2, color: '#111' }}>{open.name}</div>
        <div style={{ color: '#666', fontSize: 12 }}>
          {open.location.address_line1}, {open.location.city}
          {open.location.state_province ? `, ${open.location.state_province}` : ''}
        </div>
        <div style={{ color: '#888', fontSize: 11, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {open.status.replace('_', ' ')}
        </div>
        <button
          onClick={() => router.push(`/portfolio/${slug}/leases/${open.id}`)}
          style={{
            marginTop: 8,
            padding: '6px 10px',
            background: '#0070f3',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Open lease →
        </button>
      </div>
    </InfoWindow>
  )
}

function LeaseMapInner({ slug, leases }: { slug: string; leases: GeoLease[] }) {
  const withCoords = useMemo(() => leases.filter((l) => l.location), [leases])

  const initial = useMemo(() => {
    if (withCoords.length === 0) {
      return { center: { lat: 39.8283, lng: -98.5795 }, zoom: 3 }
    }
    if (withCoords.length === 1 && withCoords[0].location) {
      return {
        center: { lat: withCoords[0].location.latitude, lng: withCoords[0].location.longitude },
        zoom: 13,
      }
    }
    let sumLat = 0
    let sumLng = 0
    for (const l of withCoords) {
      if (l.location) {
        sumLat += l.location.latitude
        sumLng += l.location.longitude
      }
    }
    return {
      center: { lat: sumLat / withCoords.length, lng: sumLng / withCoords.length },
      zoom: 5,
    }
  }, [withCoords])

  return (
    <Map
      defaultCenter={initial.center}
      defaultZoom={initial.zoom}
      gestureHandling="greedy"
      mapTypeControl={false}
      streetViewControl={false}
      fullscreenControl={false}
      style={{ width: '100%', height: '100%' }}
    >
      <MarkersLayer slug={slug} leases={leases} />
    </Map>
  )
}

export default function LeaseMap({ slug, leases, height = 360 }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    return (
      <div style={{
        height,
        background: '#f9fafb',
        border: '1px dashed #d1d5db',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6b7280',
        fontSize: 14,
        textAlign: 'center',
        padding: 20,
      }}>
        Map disabled. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in Vercel to enable the lease map.
      </div>
    )
  }

  return (
    <div style={{
      width: '100%',
      height,
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid #e5e7eb',
      position: 'relative',
    }}>
      <APIProvider apiKey={apiKey}>
        <LeaseMapInner slug={slug} leases={leases} />
      </APIProvider>
    </div>
  )
}
