import type { NextConfig } from "next";

// ---------------------------------------------------------------------------
// Enterprise security headers
// These satisfy corporate proxy / firewall trust checks (Zscaler, Palo Alto,
// Cisco Umbrella, etc.) and meet OWASP recommended header policy.
// ---------------------------------------------------------------------------

// Domains the app legitimately loads resources from
// Use env var so dev/staging/prod each allow their own Supabase instance
const SUPABASE_DOMAIN =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("https://", "") ??
  "lsckcmvoqmwxovqejvyl.supabase.co";

const cspDirectives = [
  // Default: only same-origin
  "default-src 'self'",

  // Scripts: self + CDNs used by the static app portal + Google Identity Services
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' cdn.jsdelivr.net cdnjs.cloudflare.com unpkg.com accounts.google.com`,

  // Styles: self + Google Fonts + Fontshare + Leaflet CSS (unpkg) + Google GIS
  `style-src 'self' 'unsafe-inline' fonts.googleapis.com api.fontshare.com unpkg.com accounts.google.com cdn.jsdelivr.net`,

  // Fonts
  `font-src 'self' fonts.gstatic.com api.fontshare.com cdn.fontshare.com data:`,

  // Images: self + Supabase storage + tile servers + data URIs
  `img-src 'self' ${SUPABASE_DOMAIN} *.tile.openstreetmap.org carto.com *.basemaps.cartocdn.com data: blob:`,

  // API / fetch connections (includes Google Drive upload API)
  `connect-src 'self' ${SUPABASE_DOMAIN} maps.googleapis.com places.googleapis.com nominatim.openstreetmap.org smoitoza.github.io www.googleapis.com overpass-api.de`,

  // Frames: same-origin + Google OAuth popup
  "frame-src 'self' accounts.google.com",

  // No plugins / embeds
  "object-src 'none'",

  // Base URI locked to self
  "base-uri 'self'",

  // Form targets locked to self
  "form-action 'self'",

  // Block framing by third parties
  "frame-ancestors 'self'",
].join("; ");

const securityHeaders = [
  // Content-Security-Policy -- the big one for enterprise trust
  { key: "Content-Security-Policy", value: cspDirectives },

  // Strict-Transport-Security -- force HTTPS for 2 years, include subdomains
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },

  // Prevent MIME-type sniffing (stops drive-by downloads)
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Clickjacking protection (legacy browsers; CSP frame-ancestors is primary)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },

  // Referrer -- send origin only to cross-origin, full to same-origin
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Permissions-Policy -- disable hardware APIs we don't use
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()",
  },

  // XSS protection (legacy header, still respected by some proxies)
  { key: "X-XSS-Protection", value: "1; mode=block" },

  // Prevent DNS prefetch abuse
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  // pdfjs-dist uses the optional native 'canvas' module for server-side rendering.
  // Both must be excluded from the serverless function bundle so they load at runtime.
  serverExternalPackages: ['pdfjs-dist', 'canvas'],
  async headers() {
    return [
      // Global security headers on every route
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // App portal: also disable caching (dynamic content)
      {
        source: "/app/:path*",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
