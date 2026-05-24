'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

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

export default function LeaseMap({ slug, leases, height = 360 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const router = useRouter()

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  useEffect(() => {
    if (!token || !containerRef.current) return
    if (mapRef.current) return

    mapboxgl.accessToken = token

    const withCoords = leases.filter((l) => l.location)
    const bounds = new mapboxgl.LngLatBounds()
    withCoords.forEach((l) => {
      if (l.location) bounds.extend([l.location.longitude, l.location.latitude])
    })

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: withCoords[0]?.location
        ? [withCoords[0].location.longitude, withCoords[0].location.latitude]
        : [-98.5795, 39.8283], // continental US fallback
      zoom: withCoords.length > 0 ? 4 : 3,
    })

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('load', () => {
      if (withCoords.length > 1 && !bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 0 })
      } else if (withCoords.length === 1) {
        map.setZoom(13)
      }
    })

    mapRef.current = map

    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Rebuild markers when leases change.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    const withCoords = leases.filter((l) => l.location)
    withCoords.forEach((l) => {
      if (!l.location) return
      const color = STATUS_PIN_COLOR[l.status] || '#0070f3'

      const el = document.createElement('div')
      el.style.width = '20px'
      el.style.height = '20px'
      el.style.borderRadius = '50%'
      el.style.background = color
      el.style.border = '3px solid #fff'
      el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)'
      el.style.cursor = 'pointer'

      const popup = new mapboxgl.Popup({ offset: 14, closeButton: false }).setHTML(
        `<div style="font-family: system-ui, sans-serif; font-size: 13px; padding: 4px 6px;">
          <div style="font-weight: 600; margin-bottom: 2px;">${escapeHtml(l.name)}</div>
          <div style="color: #666; font-size: 12px;">${escapeHtml(
            `${l.location.address_line1}, ${l.location.city}${l.location.state_province ? ', ' + l.location.state_province : ''}`,
          )}</div>
          <div style="color: #888; font-size: 11px; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">${l.status.replace('_', ' ')}</div>
        </div>`,
      )

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([l.location.longitude, l.location.latitude])
        .setPopup(popup)
        .addTo(map)

      el.addEventListener('mouseenter', () => popup.addTo(map))
      el.addEventListener('mouseleave', () => popup.remove())
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        router.push(`/portfolio/${slug}/leases/${l.id}`)
      })

      markersRef.current.push(marker)
    })

    // Re-fit bounds if multiple
    if (withCoords.length > 1) {
      const bounds = new mapboxgl.LngLatBounds()
      withCoords.forEach((l) => {
        if (l.location) bounds.extend([l.location.longitude, l.location.latitude])
      })
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 600 })
      }
    } else if (withCoords.length === 1 && withCoords[0].location) {
      map.flyTo({
        center: [withCoords[0].location.longitude, withCoords[0].location.latitude],
        zoom: 13,
        duration: 600,
      })
    }
  }, [leases, router, slug])

  if (!token) {
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
        Map disabled. Set NEXT_PUBLIC_MAPBOX_TOKEN in Vercel to enable the lease map.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height,
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid #e5e7eb',
      }}
    />
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
