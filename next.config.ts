import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Next 16.1+ enables this by default. The persistent dev cache can grow
    // disproportionately large and make Turbopack exhaust the Node heap while
    // compacting it. Keep Turbopack's in-memory incremental compilation, but
    // do not restore the problematic cache across dev-server restarts.
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: {
    // Prevent a lockfile or package installation in a parent directory from
    // making Turbopack watch and index files outside this application.
    root: process.cwd(),
  },
};

export default nextConfig;
