import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.165"],
  devIndicators: false,
  experimental: {
    middlewareClientMaxBodySize: "4.3mb",
    serverActions: {
      bodySizeLimit: "4.3mb"
    }
  },
  outputFileTracingRoot: process.cwd()
};

export default nextConfig;
