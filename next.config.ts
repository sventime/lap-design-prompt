import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true, // This allows the build to succeed even if there are TypeScript errors
  },
  eslint: {
    ignoreDuringBuilds: true, // This allows the build to succeed even if there are ESLint errors
  },
  env: {
    BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
