/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  // Allow AWS SDK packages to be bundled in server-side API routes
  serverExternalPackages: [
    '@aws-sdk/client-bedrock-runtime',
    '@aws-sdk/client-dynamodb',
    '@aws-sdk/lib-dynamodb',
    '@aws-sdk/client-iot-data-plane',
    '@aws-sdk/client-location',
  ],

  // Proxy /api/nexus/* to the Express backend if BACKEND_URL is set
  // (Keeps the frontend working standalone without the Express server)
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL
    if (!backendUrl) return []
    return [
      {
        source: '/api/nexus/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',     value: 'nosniff' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',         value: 'geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
