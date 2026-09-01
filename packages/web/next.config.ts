import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@cursor-throwaway/shared'],
  reactStrictMode: true,
};

export default nextConfig;
