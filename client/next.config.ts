import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "files.edgestore.dev",
        pathname: "/**", // or narrow it if you want
      },
    ],
  },
};

export default nextConfig;