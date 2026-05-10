import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Raise the HTTP header size limit so a large (but valid) cookie never causes 431.
  // Default is 16 KB; 32 KB is more than enough for any JWT we produce.
  serverOptions: {
    maxHeaderSize: 32 * 1024,
  },
};

export default nextConfig;
