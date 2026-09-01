import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@cursor-burner/shared'],
  reactStrictMode: true,
};

export default nextConfig;
