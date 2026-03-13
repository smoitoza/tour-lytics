import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone for Vercel deployment
  output: "standalone",
  
  // Allow the app to access the embedded static HTML
  async headers() {
    return [
      {
        source: "/app/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
