import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["mammoth", "pdfjs-dist"],
  },
};

export default nextConfig;
