import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true, // This allows the build to succeed even if there are TypeScript errors
  },
};

export default nextConfig;
