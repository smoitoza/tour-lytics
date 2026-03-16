import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the app to access the embedded static HTML
  async headers() {
    return [
      {
        source: "/app/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
