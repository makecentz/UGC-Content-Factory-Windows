import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb"
    }
  },
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    "/*": ["./prisma/**/*", "./workflows/**/*", "./storage/**/.gitkeep"]
  }
};

export default nextConfig;
