import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.165"],
  devIndicators: false,
  experimental: {
    middlewareClientMaxBodySize: "15mb",
    serverActions: {
      bodySizeLimit: "15mb"
    }
  },
  outputFileTracingRoot: process.cwd()
};

export default nextConfig;
