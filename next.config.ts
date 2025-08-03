import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Handle canvas module for PDF libraries
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
      };
    }
    return config;
  },
  images: {
    domains: ['localhost'],
    unoptimized: true
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/plant-images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600' // Cache for 1 hour
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          }
        ]
      }
    ]
  },
  // Ensure static files are served properly
  async rewrites() {
    return [
      {
        source: '/plant-images/:path*',
        destination: '/plant-images/:path*'
      }
    ]
  }
};

export default nextConfig;