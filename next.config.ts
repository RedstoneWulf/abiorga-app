import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Nötig für Docker-Deployment
};

export default nextConfig;