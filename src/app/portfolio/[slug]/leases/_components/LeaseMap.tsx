'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useAdvancedMarkerRef,
} from '@vis.gl/react-google-maps'
import { useState } from 'react'

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

const STATUS_PIN_COLOR: Record<string, { bg: string; border: string; glyph: string }> = {
  draft: { bg: '#9ca3af', border: '#fff', glyph: '#fff' },
  pending_review: { bg: '#f59e0b', border: '#fff', glyph: '#fff' },
  active: { bg: '#22c55e', border: '#fff', glyph: '#fff' },
  expired: { bg: '#ef4444', border: '#fff', glyph: '#fff' },
  terminated: { bg: '#6b7280', border: '#fff', glyph: '#fff' },
}

// A Map ID is required for AdvancedMarker. This default is fine for most apps —
// styling is controlled by the standard Map theme. If you want custom map styling,
// create a Map ID in Google Cloud Console and override NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID.
const DEFAULT_MAP_ID = 'DEMO_MAP_ID'

function LeaseMapInner({ slug, leases }: { slug: string; leases: GeoLease[] }) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)

  const withCoords = useMemo(() => leases.filter((l) => l.location), [leases])

  const { center, zoom } = useMemo(() => {
    if (withCoords.length === 0) {
      return { center: { lat: 39.8283, lng: -98.5795 }, zoom: 3 }
    }
    if (withCoords.length === 1 && withCoords[0].location) {
      return {
        center: { lat: withCoords[0].location.latitude, lng: withCoords[0].location.longitude },
        zoom: 13,
      }
    }
    // Compute centroid + a fitted zoom (rough — Google fits via bounds below would
    // need imperative API access). Centroid is fine for now.
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

  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || DEFAULT_MAP_ID

  return (
    <Map
      defaultCenter={center}
      defaultZoom={zoom}
      mapId={mapId}
      gestureHandling="greedy"
      disableDefaultUI={false}
      mapTypeControl={false}
      streetViewControl={false}
      fullscreenControl={false}
      style={{ width: '100%', height: '100%' }}
    >
      {withCoords.map((l) => {
        if (!l.location) return null
        return (
          <LeasePin
            key={l.id}
            lease={l}
            isOpen={openId === l.id}
            onOpen={() => setOpenId(l.id)}
            onClose={() => setOpenId(null)}
            onNavigate={() => router.push(`/portfolio/${slug}/leases/${l.id}`)}
          />
        )
      })}
    </Map>
  )
}

function LeasePin({
  lease,
  isOpen,
  onOpen,
  onClose,
  onNavigate,
}: {
  lease: GeoLease
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  onNavigate: () => void
}) {
  const [markerRef, marker] = useAdvancedMarkerRef()
  if (!lease.location) return null
  const color = STATUS_PIN_COLOR[lease.status] || STATUS_PIN_COLOR.draft

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: lease.location.latitude, lng: lease.location.longitude }}
        onClick={onOpen}
      >
        <Pin background={color.bg} borderColor={color.border} glyphColor={color.glyph} />
      </AdvancedMarker>
      {isOpen && marker && (
        <InfoWindow anchor={marker} onClose={onClose}>
          <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, padding: 2, maxWidth: 240 }}>
            <div style={{ fontWeight: 600, marginBottom: 2, color: '#111' }}>{lease.name}</div>
            <div style={{ color: '#666', fontSize: 12 }}>
              {lease.location.address_line1}, {lease.location.city}
              {lease.location.state_province ? `, ${lease.location.state_province}` : ''}
            </div>
            <div style={{ color: '#888', fontSize: 11, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {lease.status.replace('_', ' ')}
            </div>
            <button
              onClick={onNavigate}
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
      )}
    </>
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
    }}>
      <APIProvider apiKey={apiKey}>
        <LeaseMapInner slug={slug} leases={leases} />
      </APIProvider>
    </div>
  )
}
