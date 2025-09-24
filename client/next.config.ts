import type { NextConfig } from "next";

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "files.edgestore.dev",
        pathname: "/**",
      },
    ],
  },
  turbopack: {
    // Tell Next.js that THIS folder is the workspace root
    root: __dirname,
  },
} satisfies NextConfig;

export default nextConfig;
