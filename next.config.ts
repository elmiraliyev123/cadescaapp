import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.165"],
  devIndicators: false,
  outputFileTracingRoot: process.cwd()
};

export default nextConfig;
