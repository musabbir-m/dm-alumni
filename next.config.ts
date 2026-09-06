import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Photo + verification document can total ~10 MB; 12 MB leaves room
      // for multipart boundaries. Keep in sync with MAX_FILE_MB in
      // src/lib/actions/register.ts.
      bodySizeLimit: '12mb',
    },
  },
};

export default nextConfig;
